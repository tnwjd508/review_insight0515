/**
 * Review Insight - Netlify Serverless Function
 * Express 앱을 serverless-http로 감싸서 Netlify에서 실행할 수 있게 합니다.
 */

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const router = express.Router();

// 1. OpenAI 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 2. Supabase 설정
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 미들웨어 설정
app.use(cors());
app.use(express.json());

/**
 * 감성 분석 API 엔드포인트
 */
router.post('/analyze', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ success: false, message: '텍스트가 입력되지 않았습니다.' });
    }

    try {
        console.log('--- Netlify Function: 감성 분석 시작 ---');
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `너는 텍스트의 감성을 분석하는 전문가야. 
                    사용자가 제공하는 문장을 분석해서 [positive, negative, neutral] 중 하나로 분류하고, 
                    그렇게 판단한 이유와 0에서 100 사이의 신뢰도 점수를 알려줘. 
                    반드시 아래와 같은 JSON 형식으로만 응답해야 해:
                    {
                        "sentiment": "positive | negative | neutral",
                        "confidence": number,
                        "reason": "분석 결과에 대한 상세한 이유"
                    }`
                },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" }
        });

        const analysisResult = JSON.parse(completion.choices[0].message.content);

        // Supabase 저장
        await supabase
            .from('sentiment_logs')
            .insert([{
                input_text: text,
                sentiment: analysisResult.sentiment,
                confidence: analysisResult.confidence,
                reason: analysisResult.reason
            }]);

        res.json({
            success: true,
            data: {
                ...analysisResult,
                icon: analysisResult.sentiment === 'positive' ? '😊' : (analysisResult.sentiment === 'negative' ? '😢' : '😐')
            }
        });

    } catch (error) {
        console.error('서버 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류 발생', error: error.message });
    }
});

// 기본 경로 대응 및 에러 핸들링
router.get('/', (req, res) => res.send('API is running...'));

// 모든 요청을 router로 연결 (경로를 유연하게 잡음)
app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router); // Netlify 환경에서 함수 자체가 루트로 잡힐 때 대응

module.exports.handler = serverless(app);
