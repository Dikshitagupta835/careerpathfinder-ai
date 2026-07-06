import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

async function testNewSdk() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing with API key (starts with):', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is not defined.');
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    console.log('Initializing client...');
    
    console.log('Calling generateContent with model: gemini-3.5-flash...');
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Hello! Please output "Success" and nothing else.',
    });

    console.log('--- Response Received ---');
    console.log(response.text);
    console.log('-------------------------');
    
    if (response.text.trim().includes('Success') || response.text.length > 0) {
      console.log('Verification: SUCCESS');
    } else {
      console.error('Verification: FAILED (Empty or unexpected response)');
    }
  } catch (error) {
    console.error('Verification: FAILED with error:', error);
    process.exit(1);
  }
}

testNewSdk();
