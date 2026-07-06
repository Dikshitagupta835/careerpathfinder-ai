// test_ai_live.mjs — log in first, then confirm gemini-2.5-flash works end-to-end via /api/chat
import http from 'http';

function request(url, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (body) {
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(url, opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(data);
    }
    req.end();
  });
}

async function run() {
  console.log('\n=== Live AI Test — gemini-2.5-flash via authenticated /api/chat ===\n');

  let token = '';

  // Attempt login
  console.log('Attempting login with test credentials...');
  let loginRes = await request('http://localhost:5000/api/auth/login', 'POST', {
    email: 'test@test.com',
    password: 'test123'
  });

  if (loginRes.status === 200 && loginRes.body?.token) {
    console.log('✅ Login successful!');
    token = loginRes.body.token;
  } else {
    console.log('User does not exist, registering new test user...');
    let registerRes = await request('http://localhost:5000/api/auth/signup', 'POST', {
      email: 'test@test.com',
      password: 'test123',
      fullName: 'Test User'
    });
    if (registerRes.status === 200 && registerRes.body?.token) {
      console.log('✅ Registration successful!');
      token = registerRes.body.token;
    } else {
      console.error('❌ Authentication failed:', JSON.stringify(loginRes.body || registerRes.body));
      process.exit(1);
    }
  }

  // Hit /api/chat with our authorization token
  console.log('\nSending chat query to AI Orchestrator...');
  const chatRes = await request('http://localhost:5000/api/chat', 'POST', {
    query: 'What are the top 3 careers for someone who loves computers?',
    profile: {
      interests: ['computers', 'technology'],
      subjects: ['Mathematics', 'Computer Science'],
      workStyle: 'Remote',
      budget: 500000,
      degree: "Bachelor's",
      preferredCountry: 'India',
      workLifeBalance: 'Balanced',
      expectedSalary: 800000,
      skills: ['programming', 'problem-solving']
    }
  }, {
    'Authorization': `Bearer ${token}`
  });

  console.log(`HTTP Status : ${chatRes.status}`);

  if (typeof chatRes.body === 'object') {
    const isDemoMode = chatRes.body?.isDemoMode;
    const activeAgent = chatRes.body?.activeAgent ?? '';
    const summarySnippet = (chatRes.body?.summary ?? '').slice(0, 300);

    console.log(`isDemoMode  : ${isDemoMode}`);
    console.log(`activeAgent : ${activeAgent}`);
    console.log(`Summary snippet:\n----------------------------------------\n${summarySnippet}\n----------------------------------------\n`);

    if (isDemoMode === false) {
      console.log('✅ PASS — AI is ACTIVE and responding using Gemini!');
    } else if (isDemoMode === true) {
      console.log('❌ FAIL — Still in Demo mode. Check API key status and model config.');
    } else {
      console.log('❌ FAIL — isDemoMode status is undefined, check full response.');
    }
  } else {
    console.log('Response:', String(chatRes.body).slice(0, 300));
  }

  console.log('\n=== Done ===\n');
}

run().catch(console.error);
