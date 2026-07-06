// probe_models.mjs — find which Gemini models are actually available
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read API key from .env
const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const match = env.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

if (!apiKey) { console.error('No GEMINI_API_KEY found'); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

console.log('\n=== Probing available Gemini models ===\n');

for (const model of CANDIDATES) {
  try {
    const result = await ai.models.generateContent({
      model,
      contents: 'Say only "ok"'
    });
    const text = result?.text?.trim() ?? '';
    console.log(`✅  ${model.padEnd(40)} → "${text.slice(0, 30)}"`);
  } catch (e) {
    const msg = (e?.message || String(e)).slice(0, 80);
    console.log(`❌  ${model.padEnd(40)} → ${msg}`);
  }
}

console.log('\n=== Done ===\n');
