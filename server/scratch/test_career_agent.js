import 'dotenv/config';
import { orchestrateCareerQuery } from '../agents/multiAgentSystem.js';

const mockProfile = {
  name: "dg",
  age: 17,
  educationLevel: "Class 12",
  degree: "Commerce",
  subjects: ["Accountancy", "Computer Science"],
  skills: ["Accounting", "Programming"],
  budget: 400000,
  preferredCountry: "India",
  familyIncome: 1050000,
  marks: "80% - 89%",
  interests: ["Travelling", "Managing Money", "Research", "Coding"],
  careerGoals: ["Excel in Coding"],
  workStyle: "Entrepreneurship",
  workLifeBalance: "Balanced Life first"
};

async function test() {
  console.log("Running orchestrateCareerQuery test with gemini-2.5-flash...");
  try {
    const result = await orchestrateCareerQuery(mockProfile, "Compare Chartered Accountant vs CFA.");
    console.log("\n=================== TEST RESULT ===================");
    console.log("isDemoMode:", result.isDemoMode);
    console.log("activeAgent:", result.activeAgent);
    console.log("\nSummary response:\n");
    console.log(result.summary);
    console.log("====================================================");
  } catch (err) {
    console.error("FAIL:", err);
  }
}

test();
