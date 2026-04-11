const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testLoginFlow() {
  console.log('=== 测试登录流程 ===\n');
  
  // Step 1: 登录
  console.log('Step 1: 发送登录请求...');
  const loginBody = JSON.stringify({ username: 'admin', password: 'admin123' });
  
  const loginResponse = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  }, loginBody);
  
  console.log('登录状态码:', loginResponse.statusCode);
  
  // 提取 cookies
  const setCookies = loginResponse.headers['set-cookie'];
  console.log('Set-Cookie 头:', setCookies);
  
  if (!setCookies) {
    console.log('❌ 没有收到 Set-Cookie 头！');
    return;
  }
  
  // 解析 auth_token
  const authTokenCookie = setCookies.find(c => c.startsWith('auth_token='));
  if (!authTokenCookie) {
    console.log('❌ 没有找到 auth_token cookie！');
    return;
  }
  
  const authToken = authTokenCookie.split(';')[0];
  console.log('✅ 获取到 auth_token:', authToken.substring(0, 50) + '...');
  
  // Step 2: 使用 cookie 访问受保护页面
  console.log('\nStep 2: 使用 cookie 访问 /chat...');
  const chatResponse = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/chat',
    method: 'GET',
    headers: {
      'Cookie': authToken,
      'Accept': 'text/html'
    }
  });
  
  console.log('访问 /chat 状态码:', chatResponse.statusCode);
  console.log('响应头:', JSON.stringify(chatResponse.headers, null, 2));
  
  if (chatResponse.statusCode === 200) {
    console.log('✅ 成功访问 /chat 页面！');
  } else if (chatResponse.statusCode === 302 || chatResponse.statusCode === 307) {
    console.log('❌ 被重定向到:', chatResponse.headers['location']);
  } else {
    console.log('❌ 访问失败');
  }
  
  // Step 3: 测试 API 路由
  console.log('\nStep 3: 使用 cookie 访问 /api/auth/me...');
  const meResponse = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Cookie': authToken,
      'Accept': 'application/json'
    }
  });
  
  console.log('访问 /api/auth/me 状态码:', meResponse.statusCode);
  console.log('响应:', meResponse.body);
}

testLoginFlow().catch(console.error);
