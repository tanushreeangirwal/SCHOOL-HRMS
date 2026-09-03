const http = require('http');

async function testApiDirectly() {
  const loginReq = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const token = JSON.parse(data).token;
      
      const empReq = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/employees',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const parsed = JSON.parse(data2);
          console.log('Returned employees count:', parsed.data.length);
          console.log('First employee returned:', parsed.data[0]);
        });
      });
      empReq.end();
    });
  });

  loginReq.write(JSON.stringify({ email: 'admin@school.edu', password: 'SchoolDemo@2026' }));
  loginReq.end();
}

testApiDirectly();
