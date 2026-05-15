/**
 * Review Insight - Backend Server
 * OpenAI를 활용한 감성 분석 및 Supabase 데이터베이스 연동을 담당합니다.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. OpenAI 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 2. Supabase 설정 (Service Role Key를 사용하여 서버 측 작업 수행)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (루트 폴더)
app.use(express.static(path.join(__dirname, '.')));

// 기본 라우트 - index.html 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * 감성 분석 API 엔드포인트
 * POST /api/analyze
 */
app.post('/api/analyze', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ success: false, message: '텍스트가 입력되지 않았습니다.' });
    }

    try {
        console.log('--- 감성 분석 시작 ---');
        console.log('입력 텍스트:', text);

        // A. OpenAI API를 사용하여 감성 분석 진행
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
                {
                    role: "user",
                    content: text
                }
            ],
            response_format: { type: "json_object" } // JSON 응답 강제
        });

        // 분석 결과 추출
        const analysisResult = JSON.parse(completion.choices[0].message.content);
        console.log('OpenAI 분석 결과:', analysisResult);

        // B. Supabase 데이터베이스에 로그 저장
        const { data, error } = await supabase
            .from('sentiment_logs')
            .insert([
                {
                    input_text: text,
                    sentiment: analysisResult.sentiment,
                    confidence: analysisResult.confidence,
                    reason: analysisResult.reason
                }
            ])
            .select();

        if (error) {
            console.error('Supabase 저장 오류:', error);
            // 저장 실패 시에도 분석 결과는 반환 (사용자 경험 우선)
        } else {
            console.log('Supabase 저장 완료:', data[0].id);
        }

        // C. 최종 결과 반환
        res.json({
            success: true,
            data: {
                ...analysisResult,
                // 프론트엔드 아이콘 처리를 위한 매핑
                icon: analysisResult.sentiment === 'positive' ? '😊' : (analysisResult.sentiment === 'negative' ? '😢' : '😐')
            }
        });

    } catch (error) {
        console.error('분석 처리 중 서버 오류 발생:', error);
        res.status(500).json({
            success: false,
            message: '서버 내부 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`Review Insight 서버가 실행 중입니다: http://localhost:${PORT}`);
});
