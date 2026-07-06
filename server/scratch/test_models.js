import { GoogleGenerativeAI } from '@google/generative-ai';

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  
  for (const modelName of models) {
    console.log(`Testing model: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hello, say test');
      console.log(`[Success] ${modelName}:`, result.response.text().trim());
    } catch (err) {
      console.log(`[Error] ${modelName}:`, err.message);
    }
  }
}

testModels();
