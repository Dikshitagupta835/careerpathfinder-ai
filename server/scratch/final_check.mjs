import http from 'http';

const tests = [
  { url: 'http://localhost:5000/api/careers',        label: 'API  /api/careers',        expectJson: true,  minLen: 100 },
  { url: 'http://localhost:5000/api/colleges',       label: 'API  /api/colleges',       expectJson: true,  minLen: 100 },
  { url: 'http://localhost:5000/api/health',         label: 'API  /api/health',         expectJson: true,  minLen: 1   },
  { url: 'http://localhost:3000/colleges',           label: 'PAGE /colleges',            expectJson: false, minLen: 100 },
  { url: 'http://localhost:3000/comparison',         label: 'PAGE /comparison',          expectJson: false, minLen: 100 },
  { url: 'http://localhost:3000/career-discovery',   label: 'PAGE /career-discovery',    expectJson: false, minLen: 100 },
];

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', (e) => resolve({ status: 0, body: '', err: e.message }));
  });
}

let passed = 0, failed = 0;

console.log('\n============================  FINAL ROUTE CHECK  ============================\n');

for (const t of tests) {
  const { status, body, err } = await get(t.url);

  let count = '?';
  if (t.expectJson && body) {
    try { count = JSON.parse(body)?.length ?? '?'; } catch {}
  } else {
    count = body.length + ' chars';
  }

  const ok = !err && status === 200 && body.length >= t.minLen;
  if (ok) passed++; else failed++;

  const icon = ok ? '✅' : '❌';
  const info = err ? `ERROR: ${err}` : `HTTP ${status}  | ${t.expectJson ? count + ' records' : body.length + ' chars'}`;
  console.log(`${icon}  ${t.label.padEnd(34)} ${info}`);
}

console.log(`\n=============================================================================`);
console.log(`  Result: ${passed} passed, ${failed} failed`);
console.log(`=============================================================================\n`);
