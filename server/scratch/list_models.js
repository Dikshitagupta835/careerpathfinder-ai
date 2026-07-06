import { GoogleGenerativeAI } from '@google/generative-ai';

async function listAllModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    console.log("Listing models...");
    // The listModels method is available on the genAI client in newer SDKs, 
    // or we can request it via the generative language API.
    // Let's call the REST API directly to check model support and see what's active.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Models listed:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Error:", err.message);
  }
}

listAllModels();
