/**
 * Review Insight - Netlify Serverless Function (Optimized)
 */

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// API 라우터 설정
const router = express.Router();

/**
 * 감성 분석 API 엔드포인트
 */
router.post('/analyze', async (req, res) => {
    const { text } = req.body;

    // 1. 입력값 검증
    if (!text) {
        return res.status(400).json({ success: false, message: '분석할 텍스트가 없습니다.' });
    }

    // 2. 환경 변수 존재 확인 (502 에러 방지용)
    if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('환경 변수가 누락되었습니다. Netlify 설정을 확인하세요.');
        return res.status(500).json({ 
            success: false, 
            message: '서버 환경 설정(API Key 등)이 완료되지 않았습니다.' 
        });
    }

    try {
        console.log('분석 요청 시작:', text.substring(0, 20) + '...');

        // 3. OpenAI 초기화 및 호출
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `너는 감성 분석 전문가야. JSON 형식으로만 답해. 
                    형식: {"sentiment": "positive|negative|neutral", "confidence": 0-100, "reason": "이유"}`
                },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" },
            timeout: 15000 // 15초 타임아웃 설정
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('AI 분석 완료:', result.sentiment);

        // 4. Supabase 초기화 및 로그 저장 (비동기로 진행하여 응답 속도 최적화 가능)
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        // 저장을 기다리되, 실패해도 사용자에게 결과를 보여주기 위해 에러 처리 분리
        try {
            await supabase.from('sentiment_logs').insert([{
                input_text: text,
                sentiment: result.sentiment,
                confidence: result.confidence,
                reason: result.reason
            }]);
            console.log('DB 저장 성공');
        } catch (dbError) {
            console.error('DB 저장 중 오류 발생 (무시하고 진행):', dbError.message);
        }

        // 5. 성공 응답 반환
        return res.json({
            success: true,
            data: {
                ...result,
                icon: result.sentiment === 'positive' ? '😊' : (result.sentiment === 'negative' ? '😢' : '😐')
            }
        });

    } catch (error) {
        console.error('분석 과정 중 에러 발생:', error);
        return res.status(500).json({
            success: false,
            message: '분석 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 기본 경로 테스트용
router.get('/', (req, res) => res.json({ status: 'API is working' }));

// 라우팅 연결
app.use('/api', router);
app.use('/.netlify/functions/api', router);

module.exports.handler = serverless(app);
