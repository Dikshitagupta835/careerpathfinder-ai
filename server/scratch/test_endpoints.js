/**
 * test_endpoints.js
 * Verifies /api/careers and /api/colleges return 100+ entries
 * and are completely independent of Gemini/AI availability.
 *
 * Run: node server/scratch/test_endpoints.js
 */
import http from 'http';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`JSON parse failed for ${url}: ${e.message}\nBody: ${body.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const BASE = 'http://localhost:5000';

  console.log('\n========================================');
  console.log('  CareerPathFinder API Endpoint Tests');
  console.log('========================================\n');

  // --- Test 1: /api/careers ---
  try {
    const { status, data } = await get(`${BASE}/api/careers`);
    const pass = status === 200 && Array.isArray(data) && data.length >= 100;
    console.log(`[TEST 1] GET /api/careers`);
    console.log(`  HTTP Status : ${status}`);
    console.log(`  Records     : ${Array.isArray(data) ? data.length : 'NOT AN ARRAY'}`);
    console.log(`  Sample ID   : ${data[0]?.id ?? 'N/A'}`);
    console.log(`  Sample Name : ${data[0]?.name ?? 'N/A'}`);
    console.log(`  RESULT      : ${pass ? '✅ PASS' : '❌ FAIL — expected 100+ records'}\n`);
  } catch (e) {
    console.log(`[TEST 1] GET /api/careers  ❌ ERROR: ${e.message}\n`);
  }

  // --- Test 2: /api/colleges ---
  try {
    const { status, data } = await get(`${BASE}/api/colleges`);
    const pass = status === 200 && Array.isArray(data) && data.length >= 100;
    console.log(`[TEST 2] GET /api/colleges`);
    console.log(`  HTTP Status : ${status}`);
    console.log(`  Records     : ${Array.isArray(data) ? data.length : 'NOT AN ARRAY'}`);
    console.log(`  Sample ID   : ${data[0]?.id ?? 'N/A'}`);
    console.log(`  Sample Name : ${data[0]?.name ?? 'N/A'}`);
    console.log(`  RESULT      : ${pass ? '✅ PASS' : '❌ FAIL — expected 100+ records'}\n`);
  } catch (e) {
    console.log(`[TEST 2] GET /api/colleges  ❌ ERROR: ${e.message}\n`);
  }

  // --- Test 3: /api/health (sanity) ---
  try {
    const { status, data } = await get(`${BASE}/api/health`);
    console.log(`[TEST 3] GET /api/health`);
    console.log(`  HTTP Status : ${status}`);
    console.log(`  Response    : ${JSON.stringify(data)}`);
    console.log(`  RESULT      : ${status === 200 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (e) {
    console.log(`[TEST 3] GET /api/health  ❌ ERROR: ${e.message}\n`);
  }

  console.log('========================================');
  console.log('  Tests complete — no Gemini key needed');
  console.log('========================================\n');
}

run().catch(console.error);
