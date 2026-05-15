/**
 * Review Insight - Netlify Serverless Function (Ultra-Stable Version)
 */

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const router = express.Router();

/**
 * 감성 분석 API
 */
router.post('/analyze', async (req, res) => {
    console.log('--- API 요청 수신 ---');
    const { text } = req.body;

    // 1. 초기 검증
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: '분석할 텍스트를 입력해주세요.' });
    }

    // 2. 환경 변수 체크 (상세 로그 남김)
    const hasEnv = !!(process.env.OPENAI_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasEnv) {
        console.error('CRITICAL: 환경 변수 누락됨');
        return res.status(500).json({ success: false, message: '서버 설정 오류: 환경 변수가 등록되지 않았습니다.' });
    }

    try {
        // 3. OpenAI 분석 (타임아웃 및 에러 방어)
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        console.log('OpenAI 호출 중...');
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "감성 분석 전문가로서 JSON으로만 응답하라. 형식: {sentiment: 'positive'|'negative'|'neutral', confidence: 0-100, reason: '이유'}" },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" },
            timeout: 8000 // 8초 타임아웃
        }).catch(err => {
            throw new Error(`OpenAI 호출 실패: ${err.message}`);
        });

        const content = completion.choices[0].message.content;
        let analysis;
        try {
            analysis = JSON.parse(content);
        } catch (e) {
            throw new Error('AI 응답 데이터 파싱 실패');
        }

        console.log('분석 완료:', analysis.sentiment);

        // 4. Supabase 저장 (비동기로 진행, 응답 지연 방지)
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        // 저장을 기다리지 않고 즉시 응답을 보내기 위해 then/catch 사용
        supabase.from('sentiment_logs').insert([{
            input_text: text,
            sentiment: analysis.sentiment,
            confidence: analysis.confidence,
            reason: analysis.reason
        }]).then(({ error }) => {
            if (error) console.error('DB 저장 에러 (백그라운드):', error.message);
            else console.log('DB 저장 완료 (백그라운드)');
        }).catch(e => console.error('DB 작업 중 예외 발생:', e));

        // 5. 최종 결과 즉시 반환
        return res.status(200).json({
            success: true,
            data: {
                ...analysis,
                icon: analysis.sentiment === 'positive' ? '😊' : (analysis.sentiment === 'negative' ? '😢' : '😐')
            }
        });

    } catch (error) {
        console.error('최종 에러 핸들러:', error.message);
        return res.status(500).json({
            success: false,
            message: '분석 중 문제가 발생했습니다.',
            debug: error.message // 사용자에게 구체적인 힌트 제공
        });
    }
});

// 헬스체크 및 경로 대응
router.get('/', (req, res) => res.json({ message: 'Review Insight Serverless API is ready' }));

app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router);

module.exports.handler = serverless(app);
