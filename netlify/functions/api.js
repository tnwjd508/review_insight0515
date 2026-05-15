/**
 * Review Insight - Netlify Serverless Function (Final Ultimate Version)
 */

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 모든 요청을 하나로 처리하는 통합 핸들러
 * Netlify의 복잡한 경로 문제를 해결하기 위해 어떤 경로로 들어오든 분석 로직으로 연결합니다.
 */
app.all('*', async (req, res) => {
    // POST /analyze 요청만 처리
    if (req.method === 'POST' && req.path.includes('analyze')) {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: '분석할 텍스트를 입력해주세요.' });
        }

        const hasEnv = !!(process.env.OPENAI_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
        if (!hasEnv) {
            return res.status(500).json({ success: false, message: '서버 설정 오류: 환경 변수가 등록되지 않았습니다.' });
        }

        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "감성 분석 전문가로서 JSON으로만 응답하라. 형식: {sentiment: 'positive'|'negative'|'neutral', confidence: 0-100, reason: '이유'}" },
                    { role: "user", content: text }
                ],
                response_format: { type: "json_object" },
                timeout: 10000 
            });

            const analysis = JSON.parse(completion.choices[0].message.content);

            // Supabase 저장 (비동기)
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            supabase.from('sentiment_logs').insert([{
                input_text: text,
                sentiment: analysis.sentiment,
                confidence: analysis.confidence,
                reason: analysis.reason
            }]).then(() => console.log('DB 저장 완료')).catch(e => console.error('DB 저장 실패', e));

            return res.status(200).json({
                success: true,
                data: {
                    ...analysis,
                    icon: analysis.sentiment === 'positive' ? '😊' : (analysis.sentiment === 'negative' ? '😢' : '😐')
                }
            });

        } catch (error) {
            return res.status(500).json({ success: false, message: '분석 중 문제가 발생했습니다.', debug: error.message });
        }
    }

    // GET 요청 또는 기타 경로에 대한 헬스체크
    if (req.method === 'GET') {
        return res.json({ status: 'API is alive', path: req.path });
    }

    return res.status(404).json({ success: false, message: `지원하지 않는 요청입니다: ${req.method} ${req.path}` });
});

module.exports.handler = serverless(app);
