import { GoogleGenAI } from '@google/genai';
import * as tools from '../tools/mcpTools.js';

// ── Gemini client initialisation ──────────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY || '';
const ai     = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (ai) {
  console.log('[AI] Gemini 2.5 Flash initialised — AI mode ACTIVE');
} else {
  console.warn('[AI] No GEMINI_API_KEY found — running in Demo (local) mode');
}

/**
 * Unified LLM caller.
 * Merges systemPrompt + userPrompt into a single turn (Gemini's generateContent
 * accepts plain text; we prepend the system persona so behaviour is identical
 * to the old claude system/user split).
 *
 * Strips markdown code-fences from the response so JSON.parse() always works.
 */
const callLLM = async (systemPrompt, userPrompt, tracker) => {
  if (!ai) {
    if (tracker) tracker.failCount = (tracker.failCount || 0) + 1;
    return null;
  }

  const maxRetries = 3;
  const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: combinedPrompt
      });
      let text = result.text;

      // Strip markdown code-fences (```json … ``` or ``` … ```)
      text = text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      }

      if (tracker) tracker.successCount = (tracker.successCount || 0) + 1;
      return text;
    } catch (e) {
      const msg = e?.message || String(e);
      console.warn(`[Gemini] Attempt ${attempt}/${maxRetries} failed: ${msg.slice(0, 120)}`);

      const is503 = msg.includes('503') ||
                    msg.toLowerCase().includes('overloaded') ||
                    msg.toLowerCase().includes('service unavailable') ||
                    msg.toLowerCase().includes('unavailable') ||
                    e?.status === 503 || e?.statusCode === 503;

      const is429 = msg.includes('429') ||
                    msg.toLowerCase().includes('quota') ||
                    msg.toLowerCase().includes('rate limit') ||
                    e?.status === 429 || e?.statusCode === 429;

      if ((is503 || is429) && attempt < maxRetries) {
        const waitMs = is429 ? 3000 : 2000;
        console.log(`[Gemini] Transient error (${is429 ? '429 rate-limit' : '503 overload'}). Waiting ${waitMs}ms then retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (tracker) tracker.failCount = (tracker.failCount || 0) + 1;
      return null;
    }
  }

  // All retries exhausted
  if (tracker) tracker.failCount = (tracker.failCount || 0) + 1;
  return null;
};


// Multi-Agent Personas and System Prompts
const AGENT_PROMPTS = {
  career: "You are the Career Recommendation Agent. Analyze the user profile (interests, skills, budget, preferred country) and suggest the best career paths from the database.",
  college: "You are the College Agent. Match and rank universities based on budget, career compatibility, PR pathways, and placement rates.",
  scholarship: "You are the Scholarship Agent. Evaluate the user's marks and income against scholarships, calculating eligibility odds and improvements.",
  salary: "You are the Salary Intelligence Agent. Forecast future salaries, inflation adjustments, and highlight potential AI automation risks.",
  country: "You are the Country Advisor Agent. Advise on visas, PR options, healthcare, and cost of living compared to savings potentials.",
  roadmap: "You are the Roadmap Planner Agent. Detail exact study milestones, training, and certifications required to achieve a career.",
  skillGap: "You are the Skill Gap Agent. Inspect user skills, calculate readiness, and advise on certificates and self-learning schedules.",
  costCalculator: "You are the Cost Calculator Agent. Calculate ROI, break-even timelines, and compute net ten-year values of degrees.",
  futureDemand: "You are the Future Demand Agent. Forecast automation risks and job stability factors for different careers."
};

// 1. Career Recommendation Agent
export const runCareerAgent = async (profile, tracker) => {
  // 1. Log the actual profile data
  console.log("=== [DEBUG] Profile Data Sent to Career Recommendation Agent ===");
  console.log(JSON.stringify({
    subjects: profile.subjects,
    activities: profile.interests,
    workStyle: profile.workStyle,
    expectedSalary: profile.expectedSalary,
    educationBudget: profile.budget,
    preferredDegree: profile.degree,
    studyAbroadPreference: profile.preferredCountry,
    workLifeBalance: profile.workLifeBalance,
    targetCountries: profile.preferredCountry
  }, null, 2));
  console.log("================================================================");

  const matchingCareers = tools.careerSearchTool({
    interests: profile.interests,
    difficulty: profile.difficulty
  });

  const systemPrompt = `${AGENT_PROMPTS.career}
You MUST output your response in JSON format. The JSON object should contain exactly two fields:
1. "recommendedCareers": An array of objects, each representing a recommended career from the matched database list, sorted by fit:
   - "id": The exact "id" of the career from the matched list (e.g. "software-engineer").
   - "matchScore": A number from 0 to 100 representing how well they match the student profile.
   - "reasoning": A 1-sentence explanation of why this career matches their specific profile inputs.
2. "analysis": A detailed analysis of their career options, suggestions, and tips in Markdown format.

Example JSON output structure:
{
  "recommendedCareers": [
    { "id": "financial-analyst", "matchScore": 95, "reasoning": "Fits commerce degree and interest in managing money." }
  ],
  "analysis": "Markdown analysis text here..."
}`;

  const userPrompt = `Student profile — Subjects: ${profile.subjects?.join(', ') || 'None'}. Activities enjoyed: ${profile.interests?.join(', ') || 'None'}. Work style: ${profile.workStyle || 'None'}. Budget: ${profile.budget ? `₹${profile.budget.toLocaleString()}` : 'None'}. Target countries: ${profile.preferredCountry || 'None'}. Preferred degree: ${profile.degree || 'None'}. Based on THIS specific profile, recommend the top 5 careers with match %, salary, demand, and reasoning tied directly to these inputs. Ensure that your suggestions are highly personalized to their budget, subjects, and work style preferences.`;

  const response = await callLLM(systemPrompt, userPrompt, tracker);

  let rankedCareers = matchingCareers;
  let analysisText = '';

  if (response) {
    try {
      let cleanText = response.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(cleanText);
      if (parsed.recommendedCareers && Array.isArray(parsed.recommendedCareers)) {
        const idOrder = parsed.recommendedCareers.map(c => c.id.toLowerCase());
        
        // Reorder matched careers based on LLM suggestions and inject scores
        const scoredCareers = matchingCareers.map(c => {
          const rec = parsed.recommendedCareers.find(rc => rc.id.toLowerCase() === c.id.toLowerCase());
          return {
            ...c,
            matchScore: rec ? rec.matchScore : 70,
            customReasoning: rec ? rec.reasoning : ''
          };
        });

        // Filter to only matching careers that are recommended, or sort all if all are recommended
        rankedCareers = scoredCareers.sort((a, b) => {
          const scoreA = a.matchScore || 0;
          const scoreB = b.matchScore || 0;
          return scoreB - scoreA;
        });

        analysisText = parsed.analysis || '';
      } else {
        analysisText = response;
      }
    } catch (err) {
      console.warn("Could not parse structured JSON from Career Agent:", err);
      analysisText = response;
    }
    
    return { analysis: analysisText, careers: rankedCareers };
  }

  // Graceful fallback ranking
  const fallbackRanked = [...matchingCareers].sort((a, b) => {
    const overlappingSkillsA = a.requiredSkills.filter(s => profile.skills?.includes(s)).length;
    const overlappingSkillsB = b.requiredSkills.filter(s => profile.skills?.includes(s)).length;
    return overlappingSkillsB - overlappingSkillsA;
  }).map(c => ({ ...c, matchScore: 85 }));

  const topMatch = fallbackRanked[0]?.name || "Chartered Accountant";
  const reasoning = `Based on your student profile, we highly recommend pursuing a career as a ${topMatch}. This aligns with your budget of ${profile.budget} and target country ${profile.preferredCountry}.`;
  
  return { analysis: reasoning, careers: fallbackRanked };
};

// 2. College Agent
export const runCollegeAgent = async (profile, careerId, tracker) => {
  const colleges = tools.collegeSearchTool({
    country: profile.preferredCountry,
    maxBudget: profile.budget
  });

  const analysis = await callLLM(
    AGENT_PROMPTS.college,
    `Career Goal: ${careerId}. Profile: ${JSON.stringify(profile)}. Available Colleges: ${JSON.stringify(colleges)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, colleges };
  }

  const matches = colleges.slice(0, 3).map(c => c.name).join(', ');
  const reasoning = `The top colleges matching your profile are ${matches || 'SRCC & University of Toronto'}. These provide solid placement opportunities within your budget constraints.`;
  return { analysis: reasoning, colleges };
};

// 3. Scholarship Agent
export const runScholarshipAgent = async (profile, tracker) => {
  const scholarships = tools.scholarshipSearchTool({
    country: profile.preferredCountry,
    minMarks: profile.marks || "90",
    income: profile.familyIncome || "300000"
  });

  const analysis = await callLLM(
    AGENT_PROMPTS.scholarship,
    `Profile: ${JSON.stringify(profile)}. Matches: ${JSON.stringify(scholarships)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, scholarships };
  }

  const eligibleNames = scholarships.map(s => s.name).join(', ');
  const reasoning = scholarships.length > 0
    ? `You qualify for ${scholarships.length} scholarships: ${eligibleNames}. Focus on maintaining a strong GPA and acquiring recommendations to boost selection odds.`
    : `No direct scholarships match your marks/income profile. We suggest looking at domestic state grants or university-specific need-based bursaries.`;
  
  return { analysis: reasoning, scholarships };
};

// 4. Salary Intelligence & Future Demand Agents
export const runSalaryAgent = async (careerId, tracker) => {
  const salaryData = tools.salaryLookupTool(careerId);

  const analysis = await callLLM(
    AGENT_PROMPTS.salary,
    `Analyze salary trends and AI disruption risk for ${careerId}: ${JSON.stringify(salaryData)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, salaryData };
  }

  const automationRiskText = salaryData
    ? `AI Automation Risk is ${Math.round(salaryData.automationRisk * 100)}%. Growth rate is ${salaryData.growthRate} annually.`
    : "Salary growth is stable around 12-15% annually with moderate AI disruption risk.";

  return { analysis: automationRiskText, salaryData };
};

// 5. Country Advisor Agent
export const runCountryAgent = async (countryName, tracker) => {
  const countryData = tools.countryInformationTool(countryName);

  const analysis = await callLLM(
    AGENT_PROMPTS.country,
    `Country Profile: ${JSON.stringify(countryData)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, countryData };
  }

  const prText = countryData
    ? `PR potential is ${countryData.prPossibility} via professional visa routes. Cost of living is ${countryData.livingCost} with avg salary of ${countryData.avgSalary}.`
    : "Visa processing times average 2-4 months with standard post-study work rights.";

  return { analysis: prText, countryData };
};

// 6. Roadmap Planner Agent & Skill Gap Agent
export const runRoadmapAndSkillsAgent = async (profile, careerId, tracker) => {
  const timeline = tools.roadmapBuilder(careerId);
  const gapAnalysis = tools.skillGapAnalyzer(profile.skills || [], careerId);

  const analysis = await callLLM(
    AGENT_PROMPTS.roadmap,
    `Career: ${careerId}. Profile Skills: ${JSON.stringify(profile.skills)}. Required steps: ${JSON.stringify(timeline)}. Gap: ${JSON.stringify(gapAnalysis)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, timeline, gapAnalysis };
  }

  const missing = gapAnalysis.missingSkills.join(', ');
  const advice = `Your career readiness for this path is ${gapAnalysis.readiness}%. To fill the skill gaps, we recommend acquiring proficiency in: ${missing || 'Excel, Auditing, Financial Modelling'}.`;

  return { analysis: advice, timeline, gapAnalysis };
};

// 7. Cost Calculator & ROI Agent
export const runRoiAgent = async (inputs, tracker) => {
  const roiData = tools.costRoiCalculator(inputs);
  
  const analysis = await callLLM(
    AGENT_PROMPTS.costCalculator,
    `Inputs: ${JSON.stringify(inputs)}. Results: ${JSON.stringify(roiData)}.`,
    tracker
  );

  if (analysis) {
    return { analysis, roiData };
  }

  const analysisText = `Based on a total investment of ₹${(roiData.totalInvestment).toLocaleString()}, you will achieve break-even in approximately ${roiData.breakEvenYears} years, yielding a 10-year Net Career Value of ₹${(roiData.netTenYearCareerValue).toLocaleString()}.`;

  return { analysis: analysisText, roiData };
};

// Helper to generate dynamic, contextual simulated replies in Demo Mode when Gemini is inactive
const generateDynamicDemoResponse = (profile, userQuery, careerResult, scholarshipResult, countryResult, collegeResult, salaryResult, roadmapResult) => {
  const query = userQuery.toLowerCase().trim();
  const name = profile.name || 'Student';

  // 1. Career Comparisons
  if (query.includes('compare') || query.includes(' vs ') || query.includes('versus')) {
    const career1 = careerResult.careers[0] || { name: 'Chartered Accountant', expectedSalary: '₹8.5 LPA', futureDemand: 'High', aiAutomationRiskPercent: 22 };
    const career2 = careerResult.careers[1] || { name: 'Investment Banker', expectedSalary: '₹12 LPA', futureDemand: 'Very High', aiAutomationRiskPercent: 18 };
    
    return `### ⚖️ Career Comparison: ${career1.name} vs. ${career2.name} (Demo Mode)

Here is a side-by-side comparison of your top recommended career paths based on your profile:

| Metric | ${career1.name} | ${career2.name} |
| :--- | :--- | :--- |
| **Match Score** | ${career1.matchScore || 95}% | ${career2.matchScore || 85}% |
| **Expected Salary (India)** | ${career1.avgSalaryIndia || '₹8.5 LPA'} | ${career2.avgSalaryIndia || '₹12 LPA'} |
| **Future Demand** | ${career1.futureDemand || 'High'} | ${career2.futureDemand || 'Very High'} |
| **AI Automation Risk**| ${career1.aiAutomationRiskPercent || 22}% | ${career2.aiAutomationRiskPercent || 18}% |
| **Education Budget** | Fits within budget | Fits within budget |

**Key Takeaway:**
- **${career1.name}** aligns well with your interest in *${(profile.interests || []).slice(0, 2).join(', ') || 'managing money'}*.
- **${career2.name}** has slightly higher salary potentials, but different preparation milestones.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // 2. Scholarships
  if (query.includes('scholarship') || query.includes('grant') || query.includes('financial aid')) {
    const list = scholarshipResult.scholarships;
    if (!list || list.length === 0) {
      return `### 🎓 Scholarship Matching (Demo Mode)

Based on your profile, we didn't find specific scholarships matching your criteria in our offline database.
- **Marks Range:** ${profile.marks || '80-89%'}
- **Family Income:** ₹${(profile.familyIncome || 500000).toLocaleString()}
- **Target Country:** ${profile.preferredCountry || 'India'}

**Recommendations:**
1. Check university-specific bursaries for international students.
2. Maintain a high GPA (above 85%) to qualify for merit-based awards.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
    }

    const items = list.slice(0, 3).map(s => `- **${s.name}**: Offers **${s.amount || 'Partial Tuition'}** (Target: ${s.country || 'Global'}). Eligibility: *${s.eligibility || 'Academic merit'}*.`).join('\n');
    return `### 🎓 Top Scholarship Recommendations for ${name} (Demo Mode)

Here are the top matches from our offline database based on your academic profile (${profile.marks || '80-89%'}):

${items}

**Next Steps:**
- Keep your transcripts and letters of recommendation ready.
- Apply 6-9 months before college admission.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // 3. Cost & ROI
  if (query.includes('roi') || query.includes('cost') || query.includes('fees') || query.includes('budget') || query.includes('money')) {
    const career = careerResult.careers[0] || { name: 'Chartered Accountant' };
    const college = collegeResult.colleges[0] || { name: 'SRCC, Delhi', fees: '₹30,000 / year', avgPackage: '₹10.5 LPA' };
    return `### 💰 ROI & Tuition Fee Cost Analysis (Demo Mode)

Here is the simulated financial outlook for pursuing **${career.name}** at **${college.name}**:

- **Estimated Tuition Fees:** ${college.fees || '₹30,000 / year'}
- **Average Package:** ${college.avgPackage || '₹10.5 LPA'}
- **Break-Even Period:** Very low, typically under 1 year due to highly subsidized fee structures.
- **Estimated ROI:** Excellent ROI ratio.

This fits perfectly within your stated education budget of **₹${(profile.budget || 500000).toLocaleString()}**.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // 4. AI Risk & Automation
  if (query.includes('automation') || query.includes('replace') || query.includes('risk') || query.includes('future demand')) {
    const career = careerResult.careers[0] || { name: 'Chartered Accountant', aiAutomationRiskPercent: 22 };
    const risk = career.aiAutomationRiskPercent || 22;
    const riskLevel = risk > 50 ? 'High Risk ⚠️' : risk > 25 ? 'Moderate Risk ⚖️' : 'Low Risk ✅';
    return `### 🤖 AI Automation & Future Demand Risk (Demo Mode)

For your target career path as a **${career.name}**:

- **AI Automation Risk:** **${risk}% (${riskLevel})**
- **10-Year Job Stability:** High (Domain-specific human decision making is highly valued).
- **Core Resilient Skills:** Analytical skills, client management, strategic advisory.

**How to stay resilient:**
- Focus on mastering advanced tools like Python for financial modeling, AI auditors, and cloud accounting systems rather than basic calculations.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // 5. Visa & Study Abroad
  if (query.includes('visa') || query.includes('pr') || query.includes('germany') || query.includes('canada') || query.includes('abroad') || query.includes('country') || query.includes('study in')) {
    const country = countryResult.countryData || { name: 'Canada', livingCost: 'High', prPossibility: 'Very High', visaDifficulty: 'Medium' };
    return `### 🌐 Study Abroad, Visa & PR Pathway Advisor (Demo Mode)

Here is the passport advice for your preferred destination: **${country.name || 'Canada'}**:

- **Cost of Living:** ${country.livingCost || 'Moderate/High'}
- **PR Pathways:** ${country.prPossibility || 'High via post-graduate pathways'}
- **Student Visa Difficulty:** ${country.visaDifficulty || 'Medium'}
- **Average Student Work Rights:** 20 hours/week during semesters.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // 6. Roadmaps / Gaps
  if (query.includes('roadmap') || query.includes('path') || query.includes('steps') || query.includes('how to') || query.includes('skills') || query.includes('gap')) {
    const career = careerResult.careers[0] || { name: 'Chartered Accountant' };
    const missing = roadmapResult.gapAnalysis?.missingSkills || ['Excel', 'Financial Modeling'];
    return `### 🗺️ Career Roadmap & Skills Training Path (Demo Mode)

To become a **${career.name}**, follow this simulated timeline:

1. **Phase 1: Academic Foundation** (Current/Next 2 Years)
   - Master subjects: *${(profile.subjects || []).join(', ') || 'Accountancy'}*.
2. **Phase 3: Professional Certification** (Years 2-4)
   - Prepare for professional exams and entrance tests.
3. **Phase 4: Industry Experience** (Years 4+)
   - Pursue internships and practical training.

**Skills Gap Analysis:**
- Your current skills match readiness is **${roadmapResult.gapAnalysis?.readiness || 70}%**.
- Recommended skills to learn next: *${missing.join(', ') || 'None'}*.

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
  }

  // Default Full Profile Report
  const topCareerName = careerResult.careers[0]?.name || 'Chartered Accountant';
  const readiness = roadmapResult.gapAnalysis?.readiness || 70;
  
  return `### 📊 Personalized Career Report for ${name} (Demo Mode)

Welcome! Because the Gemini AI key in your backend is currently inactive/exceeded quota, I am running in **Interactive Demo Mode** utilizing our structured local database. 

Here are your customized results based on your profile onboarding:
- **Top Career Match**: **${topCareerName}** (${readiness}% Skill Readiness)
- **Salary Prospects**: ${salaryResult.salaryData?.avgSalaryIndia || '₹8.5 LPA'} average starting salary.
- **Top University Recommendation**: ${collegeResult.colleges[0]?.name || 'SRCC, Delhi'}
- **Best Scholarship Match**: ${scholarshipResult.scholarships[0]?.name || 'Reliance Foundation Undergraduate Scholarship'}
- **Study Abroad Advisor**: ${countryResult.countryData?.name || 'Canada'} visa difficulty is ${countryResult.countryData?.visaDifficulty || 'Medium'}.
- **Action Plan**: Focus on closing skills gaps: *${(roadmapResult.gapAnalysis?.missingSkills || []).join(', ') || 'No gaps'}*.

---

💡 **Ask me specific questions in Chat!** I will simulate answers for queries regarding:
- *Compare CA vs CFA*
- *Scholarships in Canada*
- *ROI of MBA*
- *AI Automation Risks*
- *Germany Visa PR*

*Note: Since the Gemini API key has exceeded its free-tier quota (limit 0), we are using offline data in Demo Mode. Add a valid API key in \`server/.env\` to use the full AI features.*`;
};

// 8. Orchestrator Agent (Aggregates database tool outputs and queries the LLM exactly once)
export const orchestrateCareerQuery = async (profile, userQuery) => {
  console.log(`[Orchestrator] Routing query: "${userQuery}" for user: ${profile.name}`);

  // 1. Get Careers matching interests/difficulty locally (instant and offline)
  const matchingCareers = tools.careerSearchTool({
    interests: profile.interests,
    difficulty: profile.difficulty
  });
  
  // Rank careers locally based on skill overlap
  const rankedCareers = [...matchingCareers].sort((a, b) => {
    const overlappingSkillsA = a.requiredSkills.filter(s => profile.skills?.includes(s)).length;
    const overlappingSkillsB = b.requiredSkills.filter(s => profile.skills?.includes(s)).length;
    return overlappingSkillsB - overlappingSkillsA;
  }).map((c, index) => ({ 
    ...c, 
    matchScore: index === 0 ? 96 : index === 1 ? 91 : index === 2 ? 85 : 75 
  }));

  const primaryCareerId = rankedCareers[0]?.id || 'chartered-accountant';

  // 2. Fetch other database metrics locally (instant and offline)
  const scholarships = tools.scholarshipSearchTool({
    country: profile.preferredCountry,
    minMarks: profile.marks || "90",
    income: profile.familyIncome || "300000"
  });

  const countryData = tools.countryInformationTool(profile.preferredCountry || 'Canada');
  
  const colleges = tools.collegeSearchTool({
    country: profile.preferredCountry,
    maxBudget: profile.budget
  });

  const salaryData = tools.salaryLookupTool(primaryCareerId);
  
  const timeline = tools.roadmapBuilder(primaryCareerId);
  const gapAnalysis = tools.skillGapAnalyzer(profile.skills || [], primaryCareerId);

  // 3. Make exactly ONE call to the Gemini API to synthesize the response
  const tracker = { successCount: 0, failCount: 0 };
  let finalSummary = '';

  const orchestratorSystemPrompt = `You are the Lead Career Orchestrator Agent. Your job is to analyze the student's profile, the outputs of the specialized tools (Career recommendations, Colleges, Scholarships, Salary info, Country guidelines, Roadmap, and Skill Gaps), and the student's specific question/query.
Generate a comprehensive, beautifully structured report in Markdown. Make sure to:
1. Address the student's user query directly and comprehensively.
2. If they just completed onboarding or asked for general recommendations (e.g. "Generate full profile recommendations"), provide a cohesive overview of their top matches, roadmap, and next steps.
3. Ground your answer in the actual data returned by the sub-agents and tools.
4. Keep the tone professional, insightful, and motivating.
5. Do not invent careers or colleges that are not present in the provided listings.`;

  const orchestratorUserPrompt = `Student Profile:
${JSON.stringify(profile, null, 2)}

User Question/Query:
"${userQuery}"

Sub-Agent Data Summary:
- Recommended Careers: ${JSON.stringify(rankedCareers.slice(0, 5))}
- Colleges matched: ${JSON.stringify(colleges.slice(0, 5))}
- Scholarships matched: ${JSON.stringify(scholarships.slice(0, 5))}
- Salary Data: ${JSON.stringify(salaryData)}
- Country Info: ${JSON.stringify(countryData)}
- Roadmap and Skill Gaps: ${JSON.stringify(gapAnalysis)}

Write a highly engaging and personalized markdown response.`;

  const synthesizedSummary = await callLLM(orchestratorSystemPrompt, orchestratorUserPrompt, tracker);
  const isDemoMode = tracker.successCount === 0;

  if (isDemoMode) {
    // Dynamic simulated report if AI is unavailable (demo mode fallback)
    finalSummary = generateDynamicDemoResponse(
      profile,
      userQuery,
      { careers: rankedCareers },
      { scholarships },
      { countryData },
      { colleges },
      { salaryData },
      { timeline, gapAnalysis }
    );
  } else {
    finalSummary = synthesizedSummary;
  }

  return {
    summary: finalSummary,
    careers: rankedCareers,
    colleges,
    scholarships,
    country: countryData,
    salary: salaryData,
    roadmap: timeline,
    skills: gapAnalysis,
    isDemoMode,
    activeAgent: isDemoMode ? "Orchestrator Agent (Demo Mode — AI Unavailable)" : "Orchestrator Agent (Completed merging Specialized Sub-Agents' advice)"
  };
};
