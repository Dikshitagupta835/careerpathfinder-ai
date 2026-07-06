import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function testAll() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found in .env');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash'
  ];
  
  for (const model of models) {
    console.log(`\n--- Testing ${model} ---`);
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: 'Say Hello',
      });
      console.log(`SUCCESS: ${model} ->`, response.text.trim());
    } catch (err) {
      console.error(`FAILED: ${model} ->`, err.message);
    }
  }
}

testAll();
