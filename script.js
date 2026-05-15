/**
 * Review Insight - Interaction Logic
 * 실제 백엔드 API와 통신하여 분석 결과를 가져옵니다.
 */

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const inputText = document.getElementById('inputText');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');
    
    const resultModal = document.getElementById('resultModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    const sentimentIcon = document.getElementById('sentimentIcon');
    const sentimentText = document.getElementById('sentimentText');
    const confidenceValue = document.getElementById('confidenceValue');
    const confidenceBar = document.getElementById('confidenceBar');
    const reasonText = document.getElementById('reasonText');

    /**
     * 분석 버튼 클릭 이벤트
     */
    analyzeBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();

        if (!text) {
            alert('분석할 문장을 입력해 주세요!');
            return;
        }

        // 로딩 상태 시작
        setLoading(true);

        try {
            // 실제 백엔드 API 호출
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            const result = await response.json();

            if (result.success) {
                // 분석 결과 표시
                showResult(result.data);
            } else {
                throw new Error(result.message || '분석 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('API 호출 에러:', error);
            alert(`에러 발생: ${error.message}`);
        } finally {
            // 로딩 상태 종료
            setLoading(false);
        }
    });

    /**
     * 모달 닫기
     */
    closeModalBtn.addEventListener('click', () => {
        resultModal.classList.remove('active');
        confidenceBar.style.width = '0%';
    });

    /**
     * 배경 클릭 시 닫기
     */
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.remove('active');
            confidenceBar.style.width = '0%';
        }
    });

    function setLoading(isLoading) {
        if (isLoading) {
            analyzeBtn.disabled = true;
            btnSpinner.style.display = 'inline-block';
            btnText.textContent = 'AI 분석 중...';
        } else {
            analyzeBtn.disabled = false;
            btnSpinner.style.display = 'none';
            btnText.textContent = '감성 분석 시작';
        }
    }

    function showResult(data) {
        sentimentIcon.textContent = data.icon;
        sentimentText.textContent = `분석 결과: ${data.sentiment.toUpperCase()}`;
        confidenceValue.textContent = data.confidence;
        reasonText.textContent = data.reason;

        resultModal.classList.add('active');

        // 신뢰도 바 애니메이션
        setTimeout(() => {
            confidenceBar.style.width = `${data.confidence}%`;
        }, 400);
    }
});
