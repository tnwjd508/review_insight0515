-- 001_create_sentiment_logs.sql
-- 감성 분석 로그를 저장하기 위한 테이블 생성

CREATE TABLE IF NOT EXISTS sentiment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_text TEXT NOT NULL,           -- 사용자가 입력한 원본 텍스트
    sentiment VARCHAR(20),              -- 분석된 감정 (positive, negative, neutral)
    confidence INTEGER,                 -- 분석 신뢰도 (0-100)
    reason TEXT,                        -- 분석 이유 (JSON 또는 텍스트)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- 생성 일시
);

-- 보안을 위한 인덱스 추가 (선택 사항)
CREATE INDEX IF NOT EXISTS idx_sentiment_logs_created_at ON sentiment_logs(created_at);
