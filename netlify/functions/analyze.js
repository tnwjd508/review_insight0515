/**
 * Review Insight - Netlify Standard Serverless Function
 * Express를 거치지 않고 Netlify 핸들러를 직접 사용하여 안정성을 극대화합니다.
 */

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // CORS 처리를 위한 헤더
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS 요청 처리 (Preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) 
        };
    }

    try {
        const { text } = JSON.parse(event.body);

        if (!text) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ success: false, message: '텍스트가 입력되지 않았습니다.' }) 
            };
        }

        // 환경 변수 확인
        if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { 
                statusCode: 500, 
                headers, 
                body: JSON.stringify({ success: false, message: '서버 환경 변수 설정이 누락되었습니다.' }) 
            };
        }

        // 1. OpenAI 분석
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "감성 분석 전문가로서 JSON으로만 응답하라. 형식: {sentiment: 'positive'|'negative'|'neutral', confidence: 0-100, reason: '이유'}" },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content);

        // 2. Supabase 저장 (성공 여부와 관계없이 진행)
        try {
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            await supabase.from('sentiment_logs').insert([{
                input_text: text,
                sentiment: analysis.sentiment,
                confidence: analysis.confidence,
                reason: analysis.reason
            }]);
        } catch (dbError) {
            console.error('DB 저장 실패:', dbError.message);
        }

        // 3. 결과 반환
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    ...analysis,
                    icon: analysis.sentiment === 'positive' ? '😊' : (analysis.sentiment === 'negative' ? '😢' : '😐')
                }
            })
        };

    } catch (error) {
        console.error('에러 발생:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: '분석 중 오류가 발생했습니다.', 
                debug: error.message 
            })
        };
    }
};
