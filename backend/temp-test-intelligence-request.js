const http = require('http');
const login = JSON.stringify({ school_code: 'BFA001', email: 'kofi@bfa.edu.gh', password: 'Password1' });
const doReq = (opts, body) => new Promise((resolve, reject) => {
  const req = http.request(opts, r => {
    let data = '';
    r.on('data', chunk => data += chunk);
    r.on('end', () => resolve({ status: r.statusCode, body: data }));
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

(async () => {
  try {
    const loginRes = await doReq({ host: 'localhost', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(login) } }, login);
    console.log('login', loginRes.status, loginRes.body);
    const token = JSON.parse(loginRes.body).token;
    const resp = await doReq({ host: 'localhost', port: 5001, path: '/api/intelligence/student/aaef941d-2bea-4e4a-9d8f-26efcaeb5fff/term/e4a8b9cb-6764-4507-8a41-4e5e03d75e31', method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    console.log('int', resp.status, resp.body);
  } catch (e) {
    console.error(e.stack || e);
  }
})();
