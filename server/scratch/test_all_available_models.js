import { GoogleGenerativeAI } from '@google/generative-ai';

async function testAllActiveModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const models = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-pro'
  ];
  
  for (const modelName of models) {
    console.log(`\nTesting model: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hi! Just reply with "Model active: [modelName]"');
      console.log(`🟢 [Success] ${modelName}:`, result.response.text().trim());
    } catch (err) {
      console.log(`🔴 [Error] ${modelName}:`, err.message);
    }
  }
}

testAllActiveModels();
