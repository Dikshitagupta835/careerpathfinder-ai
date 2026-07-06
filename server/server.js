import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { orchestrateCareerQuery, runRoiAgent } from './agents/multiAgentSystem.js';
import * as tools from './tools/mcpTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

const USERS_PATH = path.join(__dirname, 'data', 'users.json');

const getUsers = () => {
  try {
    if (!fs.existsSync(USERS_PATH)) {
      fs.writeFileSync(USERS_PATH, '[]');
    }
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
};

const hashPassword = (password) => {
  return crypto.pbkdf2Sync(password, 'salt-career-pathfinder', 1000, 64, 'sha512').toString('hex');
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  const users = getUsers();
  const user = users.find(u => u.token === token);
  if (!user) return res.status(403).json({ error: 'Invalid or expired session token' });
  
  req.user = user;
  next();
};

// Heartbeat
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Sign Up
app.post('/api/auth/signup', (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  
  const token = crypto.randomUUID();
  const newUser = {
    userId: crypto.randomUUID(),
    email: email.toLowerCase(),
    password: hashPassword(password),
    fullName,
    token,
    onboardingComplete: false,
    profile: null,
    savedCareers: [],
    savedColleges: [],
    savedScholarships: [],
    chatHistory: [
      {
        id: 'welcome',
        sender: 'ai',
        text: `👋 Hello ${fullName}! I'm your CareerPathFinder AI Career Coach. Ask me anything about studies, entrance exams, or global colleges!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agent: "AI Coach"
      }
    ],
    recommendations: null,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  
  const { password: _, ...userWithoutPassword } = newUser;
  res.json({ token, user: userWithoutPassword });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const users = getUsers();
  const userIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (userIdx === -1) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const user = users[userIdx];
  if (user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const token = crypto.randomUUID();
  user.token = token;
  users[userIdx] = user;
  saveUsers(users);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
});

// Get Current User (silent auth check)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// Sync User Data (Profile, Onboarding, Saved Items)
app.post('/api/user/sync', authenticateToken, (req, res) => {
  const { profile, onboardingComplete, savedCareers, savedColleges, savedScholarships, chatHistory, recommendations } = req.body;
  
  const users = getUsers();
  const userIdx = users.findIndex(u => u.userId === req.user.userId);
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = users[userIdx];
  if (profile !== undefined) user.profile = profile;
  if (onboardingComplete !== undefined) user.onboardingComplete = onboardingComplete;
  if (savedCareers !== undefined) user.savedCareers = savedCareers;
  if (savedColleges !== undefined) user.savedColleges = savedColleges;
  if (savedScholarships !== undefined) user.savedScholarships = savedScholarships;
  if (chatHistory !== undefined) user.chatHistory = chatHistory;
  if (recommendations !== undefined) user.recommendations = recommendations;
  
  if (profile && profile.name) {
    user.fullName = profile.name;
  }
  
  users[userIdx] = user;
  saveUsers(users);
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const users = getUsers();
  const userIdx = users.findIndex(u => u.userId === req.user.userId);
  if (userIdx !== -1) {
    users[userIdx].token = null;
    saveUsers(users);
  }
  res.json({ success: true });
});

// Career data — simple, direct API endpoint reading directly from careers.json
app.get('/api/careers', (req, res) => {
  try {
    const careersPath = path.join(__dirname, 'data', 'careers.json');
    const careersData = JSON.parse(fs.readFileSync(careersPath, 'utf8'));
    res.json(careersData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// College data — simple, direct API endpoint reading directly from colleges.json
app.get('/api/colleges', (req, res) => {
  try {
    const collegesPath = path.join(__dirname, 'data', 'colleges.json');
    const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
    res.json(collegesData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scholarships', (req, res) => {
  try {
    const scholarships = tools.scholarshipSearchTool({});
    res.json(scholarships);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/countries', (req, res) => {
  try {
    const countriesPath = path.join(__dirname, 'data', 'countries.json');
    const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
    res.json(countriesData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Core AI Orchestration Endpoint
app.post('/api/recommendations', authenticateToken, async (req, res) => {
  const { profile } = req.body;
  if (!profile) {
    return res.status(400).json({ error: 'Profile is required' });
  }

  try {
    const result = await orchestrateCareerQuery(profile, "Generate full profile recommendations");
    
    // Save to user object
    const users = getUsers();
    const userIdx = users.findIndex(u => u.userId === req.user.userId);
    if (userIdx !== -1) {
      users[userIdx].profile = profile;
      users[userIdx].recommendations = result;
      saveUsers(users);
    }
    
    res.json(result);
  } catch (err) {
    console.error("Recommendations error:", err);
    res.status(500).json({ error: err.message });
  }
});

// AI Chat Workspace Endpoint
app.post('/api/chat', authenticateToken, async (req, res) => {
  const { profile, query } = req.body;
  if (!profile || !query) {
    return res.status(400).json({ error: 'Profile and query are required' });
  }

  try {
    const result = await orchestrateCareerQuery(profile, query);
    res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ROI Calculation Endpoint
app.post('/api/roi', async (req, res) => {
  const { inputs } = req.body;
  if (!inputs) {
    return res.status(400).json({ error: 'ROI Inputs are required' });
  }

  try {
    const result = await runRoiAgent(inputs);
    res.json(result);
  } catch (err) {
    console.error("ROI calculation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static assets in production
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  console.log(`[Server] Serving static frontend files from ${clientBuildPath}`);
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  console.warn(`[Server] Static frontend build path not found at ${clientBuildPath}. API-only mode.`);
}

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
