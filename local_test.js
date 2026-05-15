const http = require('http');

const data = JSON.stringify({
  text: "오늘 정말 기분이 좋네요!"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('--- 로컬 테스트 결과 ---');
    console.log('상태 코드:', res.statusCode);
    console.log('응답 본문:', body);
  });
});

req.on('error', (e) => {
  console.error(`테스트 실패: ${e.message}`);
});

req.write(data);
req.end();
