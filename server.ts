import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  evaluateTargetVsCandidate,
  initMLModel,
  resolveLocalImagePath,
  resolveOrFetchImagePath,
  EVALUATOR_VERSION,
  EVALUATOR_MODEL,
  MLScoreBreakdown,
} from './server/mlEvaluator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '0.0.0.0';

// Ensure media, upload, and rounds directories exist
const MEDIA_DIR = path.resolve(__dirname, 'media');
const UPLOAD_DIR = path.resolve(MEDIA_DIR, 'uploads');
const ROUNDS_DIR = path.resolve(MEDIA_DIR, 'rounds');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ROUNDS_DIR, { recursive: true });

export async function ensureDefaultTargetImages(): Promise<void> {
  fs.mkdirSync(ROUNDS_DIR, { recursive: true });

  const cyberpunkPath = path.resolve(ROUNDS_DIR, 'round_cyberpunk.png');
  if (!fs.existsSync(cyberpunkPath)) {
    const targetSvg = Buffer.from(`
      <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="600" fill="#0b0b1a"/>
        <rect x="80" y="300" width="440" height="220" fill="#151530"/>
        <circle cx="180" cy="220" r="60" fill="#00f3ff"/>
        <rect x="330" y="150" width="150" height="120" fill="#ff007f"/>
        <line x1="0" y1="520" x2="600" y2="520" stroke="#00f3ff" stroke-width="8"/>
        <line x1="80" y1="300" x2="520" y2="300" stroke="#ff007f" stroke-width="6"/>
      </svg>
    `);
    await sharp(targetSvg).png().toFile(cyberpunkPath);
  }

  const forestPath = path.resolve(ROUNDS_DIR, 'round_crystal_forest.png');
  if (!fs.existsSync(forestPath)) {
    const forestSvg = Buffer.from(`
      <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="600" fill="#05141e"/>
        <circle cx="300" cy="250" r="100" fill="#00e5ff"/>
        <rect x="150" y="350" width="300" height="180" fill="#0d2b3a"/>
        <circle cx="200" cy="400" r="40" fill="#a855f7"/>
        <circle cx="400" cy="380" r="50" fill="#3b82f6"/>
      </svg>
    `);
    await sharp(forestSvg).png().toFile(forestPath);
  }
}

// Setup multer for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// Types & In-Memory Store
interface StoredUser {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: 'PARTICIPANT' | 'ADMIN';
  avatar_url: string | null;
  is_active: boolean;
  password?: string;
  created_at: string;
  updated_at: string;
}

interface StoredCompetition {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
  is_archived?: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredRound {
  id: string;
  competition_id: string;
  round_number: number;
  title: string;
  description: string | null;
  secret_prompt: string;
  time_limit_seconds: number;
  max_submissions: number;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
  is_archived?: boolean;
  target_image_url: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredScoreBreakdown {
  semantic_similarity?: number;
  semantic_score: number;
  composition_score: number;
  objects_score: number;
  color_score: number;
  image_quality_score?: number;
  fine_details_score?: number;
  details_score: number;
  total_score: number;
  clip_similarity?: number;
  calibrated_similarity_pct?: number;
  evaluation_method?: string;
  evaluator_version?: string;
  evaluation_time_ms?: number;
  evaluation_stage?: 'FIRST' | 'FINAL';
}

interface StoredSubmission {
  id: string;
  user_id: string;
  round_id: string;
  target_image_id: string | null;
  image_url: string | null;
  first_image_url?: string | null;
  final_image_url?: string | null;
  gemini_chat_link?: string | null;
  prompt_used: string;
  prompt_1?: string;
  prompt_2?: string;
  status: 'in_progress' | 'prompt1_submitted' | 'first_uploaded' | 'prompt2_submitted' | 'completed' | 'evaluated' | 'rejected';
  scoring_status?: 'pending' | 'scored' | 'failed' | null;
  started_at: string;
  submitted_at: string | null;
  first_stage_breakdown?: StoredScoreBreakdown | null;
  final_stage_breakdown?: StoredScoreBreakdown | null;
  total_score?: number | null;
  feedback?: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredScore {
  id: string;
  submission_id: string;
  round_id: string;
  user_id: string;
  stage: 'FIRST' | 'FINAL';
  semantic_similarity?: number;
  semantic_score: number;
  composition_score: number;
  objects_score: number;
  color_score: number;
  image_quality_score?: number;
  fine_details_score?: number;
  details_score: number;
  total_score: number;
  clip_similarity: number;
  evaluation_method: string;
  status: string;
  feedback: string | null;
  created_at: string;
}

// In-Memory Database
const users: Map<string, StoredUser> = new Map();
const competitions: Map<string, StoredCompetition> = new Map();
const rounds: Map<string, StoredRound> = new Map();
const submissions: Map<string, StoredSubmission> = new Map();
const scores: Map<string, StoredScore> = new Map();
const targetImages: Map<string, Array<{ id: string; round_id: string; image_url: string; alt_text: string | null; created_by: string | null; created_at: string; updated_at: string }>> = new Map();

// Helper to find existing sample image from /media
function findExistingMediaImage(): string {
  try {
    const subDirs = fs.readdirSync(path.resolve(MEDIA_DIR, 'submissions'));
    for (const sub of subDirs) {
      const fullSub = path.resolve(MEDIA_DIR, 'submissions', sub);
      if (fs.statSync(fullSub).isDirectory()) {
        const files = fs.readdirSync(fullSub).filter((f) => f.endsWith('.png') || f.endsWith('.jpg'));
        if (files.length > 0) {
          return `/media/submissions/${sub}/${files[0]}`;
        }
      }
    }
  } catch {
    // ignore
  }
  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
}

const sampleImgUrl = findExistingMediaImage();

// Seed initial data
const adminUser: StoredUser = {
  id: 'admin_primary',
  email: 'admin@example.com',
  username: 'admin',
  full_name: 'Lead Organizer',
  role: 'ADMIN',
  avatar_url: null,
  is_active: true,
  password: 'admin123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
users.set(adminUser.id, adminUser);
users.set(adminUser.email, adminUser);

const participant1: StoredUser = {
  id: 'user_alex',
  email: 'alex@example.com',
  username: 'alex_prompt',
  full_name: 'Alex Rivera',
  role: 'PARTICIPANT',
  avatar_url: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
users.set(participant1.id, participant1);

const participant2: StoredUser = {
  id: 'user_maya',
  email: 'maya@example.com',
  username: 'maya_synth',
  full_name: 'Maya Chen',
  role: 'PARTICIPANT',
  avatar_url: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
users.set(participant2.id, participant2);

const participant3: StoredUser = {
  id: 'user_david',
  email: 'david@example.com',
  username: 'david_k',
  full_name: 'David Kim',
  role: 'PARTICIPANT',
  avatar_url: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
users.set(participant3.id, participant3);

// Default Competition
const comp1: StoredCompetition = {
  id: 'comp_global_2026',
  title: 'Global Reverse Prompt Engineering Championship',
  description: 'Inspect the provided target image, reverse engineer the prompt, generate the image externally in Gemini, upload your rendition, and get evaluated out of 80 points.',
  slug: 'global-reverse-prompt-2026',
  status: 'active',
  scheduled_start: new Date().toISOString(),
  scheduled_end: null,
  started_at: new Date().toISOString(),
  paused_at: null,
  ended_at: null,
  created_by: adminUser.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
competitions.set(comp1.id, comp1);

// Default Rounds
const round1: StoredRound = {
  id: 'round_cyberpunk',
  competition_id: comp1.id,
  round_number: 1,
  title: 'Neon Cyberpunk Boulevard',
  description: 'A rain-slicked futuristic street at twilight, lined with neon holographic advertisements in electric cyan and magenta, floating hover-vehicles streaming light trails, and reflections in dark puddles.',
  secret_prompt: 'A futuristic cyberpunk boulevard in twilight rain, towering skyscrapers with vibrant neon holographic billboards in electric cyan and magenta, sleek hovercars leaving glowing light trails, glistening wet asphalt reflecting colorful city lights, cinematic octane render 8k',
  time_limit_seconds: 900,
  max_submissions: 1,
  status: 'active',
  target_image_url: '/media/rounds/round_cyberpunk.png',
  started_at: new Date().toISOString(),
  paused_at: null,
  ended_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
rounds.set(round1.id, round1);

const round2: StoredRound = {
  id: 'round_bioluminescence',
  competition_id: comp1.id,
  round_number: 2,
  title: 'Enchanted Crystal Grove',
  description: 'An ancient mystical forest bathed in twilight, filled with glowing bioluminescent crystal mushrooms, floating spore lanterns, moss-draped twisted oak trees, and a silver winding stream.',
  secret_prompt: 'Bioluminescent enchanted fantasy forest at dusk, glowing azure and violet crystal mushrooms, ethereal floating light spores, ancient twisted willow trees covered in luminescent emerald moss, crystalline stream reflecting moonlight, dreamy ethereal atmosphere 8k',
  time_limit_seconds: 900,
  max_submissions: 1,
  status: 'active',
  target_image_url: '/media/rounds/round_crystal_forest.png',
  started_at: new Date().toISOString(),
  paused_at: null,
  ended_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
rounds.set(round2.id, round2);

// Target images records
targetImages.set(round1.id, [
  {
    id: 'ti_round1',
    round_id: round1.id,
    image_url: round1.target_image_url || sampleImgUrl,
    alt_text: 'Cyberpunk street with glowing neon lights and reflective pavement',
    created_by: adminUser.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]);

targetImages.set(round2.id, [
  {
    id: 'ti_round2',
    round_id: round2.id,
    image_url: round2.target_image_url || sampleImgUrl,
    alt_text: 'Enchanted glowing crystal forest with bioluminescent mushrooms',
    created_by: adminUser.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]);

// Seed sample leaderboard submissions
function seedSampleSubmissions() {
  const mayaSub: StoredSubmission = {
    id: 'sub_maya_1',
    user_id: participant2.id,
    round_id: round1.id,
    target_image_id: 'ti_round1',
    image_url: sampleImgUrl,
    first_image_url: sampleImgUrl,
    final_image_url: sampleImgUrl,
    gemini_chat_link: 'https://gemini.google.com/share/c897f1f98bc1',
    prompt_used: 'Futuristic cyberpunk neon street with rain reflections, glowing cyan holograms, flying hovercars',
    prompt_1: 'Cyberpunk street with neon signs and rain',
    prompt_2: 'Futuristic cyberpunk neon street with rain reflections, glowing cyan holograms, flying hovercars',
    status: 'completed',
    scoring_status: 'scored',
    started_at: new Date(Date.now() - 3600000).toISOString(),
    submitted_at: new Date(Date.now() - 3000000).toISOString(),
    first_stage_breakdown: {
      semantic_similarity: 36.5,
      semantic_score: 36.5,
      composition_score: 9.6,
      objects_score: 8.0,
      color_score: 5.7,
      image_quality_score: 3.5,
      fine_details_score: 1.5,
      details_score: 1.5,
      total_score: 64.8,
      clip_similarity: 0.81,
      evaluation_method: 'CLIP ViT-B/32 + Multi-Signal Vision (Calibrated)',
    },
    final_stage_breakdown: {
      semantic_similarity: 42.5,
      semantic_score: 42.5,
      composition_score: 11.2,
      objects_score: 9.4,
      color_score: 6.6,
      image_quality_score: 3.8,
      fine_details_score: 1.8,
      details_score: 1.8,
      total_score: 75.3,
      clip_similarity: 0.94,
      evaluation_method: 'CLIP ViT-B/32 + Multi-Signal Vision (Calibrated)',
    },
    total_score: 75.3,
    feedback: 'Exceptional prompt alignment! Highly accurate color palette and holographic atmospheric details.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  submissions.set(mayaSub.id, mayaSub);

  scores.set('score_maya_1', {
    id: 'score_maya_1',
    submission_id: mayaSub.id,
    round_id: round1.id,
    user_id: participant2.id,
    stage: 'FINAL',
    ...mayaSub.final_stage_breakdown!,
    status: 'scored',
    feedback: mayaSub.feedback || null,
    created_at: new Date().toISOString(),
  });

  const alexSub: StoredSubmission = {
    id: 'sub_alex_1',
    user_id: participant1.id,
    round_id: round1.id,
    target_image_id: 'ti_round1',
    image_url: sampleImgUrl,
    first_image_url: sampleImgUrl,
    final_image_url: sampleImgUrl,
    gemini_chat_link: 'https://gemini.google.com/share/a123b456c789',
    prompt_used: 'Neon city street at night, wet asphalt, cyber aesthetic, glowing signs',
    status: 'completed',
    scoring_status: 'scored',
    started_at: new Date(Date.now() - 7200000).toISOString(),
    submitted_at: new Date(Date.now() - 6600000).toISOString(),
    final_stage_breakdown: {
      semantic_similarity: 39.5,
      semantic_score: 39.5,
      composition_score: 10.4,
      objects_score: 8.7,
      color_score: 6.1,
      image_quality_score: 3.6,
      fine_details_score: 1.4,
      details_score: 1.4,
      total_score: 69.7,
      clip_similarity: 0.87,
      evaluation_method: 'CLIP ViT-B/32 + Multi-Signal Vision (Calibrated)',
    },
    total_score: 69.7,
    feedback: 'Strong visual match and mood capture. Composition nicely mirrors the target image.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  submissions.set(alexSub.id, alexSub);

  scores.set('score_alex_1', {
    id: 'score_alex_1',
    submission_id: alexSub.id,
    round_id: round1.id,
    user_id: participant1.id,
    stage: 'FINAL',
    ...alexSub.final_stage_breakdown!,
    status: 'scored',
    feedback: alexSub.feedback || null,
    created_at: new Date().toISOString(),
  });

  const davidSub: StoredSubmission = {
    id: 'sub_david_1',
    user_id: participant3.id,
    round_id: round1.id,
    target_image_id: 'ti_round1',
    image_url: sampleImgUrl,
    first_image_url: sampleImgUrl,
    final_image_url: sampleImgUrl,
    gemini_chat_link: null,
    prompt_used: 'Cyberpunk metropolis highway in heavy rain with glowing purple billboards',
    status: 'completed',
    scoring_status: 'scored',
    started_at: new Date(Date.now() - 10800000).toISOString(),
    submitted_at: new Date(Date.now() - 10200000).toISOString(),
    final_stage_breakdown: {
      semantic_similarity: 37.5,
      semantic_score: 37.5,
      composition_score: 10.0,
      objects_score: 8.3,
      color_score: 5.9,
      image_quality_score: 3.5,
      fine_details_score: 1.3,
      details_score: 1.3,
      total_score: 66.5,
      clip_similarity: 0.83,
      evaluation_method: 'CLIP ViT-B/32 + Multi-Signal Vision (Calibrated)',
    },
    total_score: 66.5,
    feedback: 'Good color fidelity and futuristic lighting elements.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  submissions.set(davidSub.id, davidSub);

  scores.set('score_david_1', {
    id: 'score_david_1',
    submission_id: davidSub.id,
    round_id: round1.id,
    user_id: participant3.id,
    stage: 'FINAL',
    ...davidSub.final_stage_breakdown!,
    status: 'scored',
    feedback: davidSub.feedback || null,
    created_at: new Date().toISOString(),
  });
}
seedSampleSubmissions();

// Hardened ML Evaluation using CLIP ViT-B/32 & multi-factor visual analysis
async function evaluateSubmissionImages(
  targetImageUrl: string | null,
  candidateImagePathOrUrl: string,
  stage: 'FIRST' | 'FINAL'
): Promise<StoredScoreBreakdown> {
  await ensureDefaultTargetImages();

  console.log(`[EVALUATOR PIPELINE START] Stage: ${stage} | Target URL: ${targetImageUrl} | Candidate URL: ${candidateImagePathOrUrl}`);

  let targetPath = await resolveOrFetchImagePath(targetImageUrl || '', MEDIA_DIR);
  if (!targetPath || !fs.existsSync(targetPath)) {
    targetPath = path.resolve(MEDIA_DIR, 'rounds/round_cyberpunk.png');
  }

  let candidatePath = await resolveOrFetchImagePath(candidateImagePathOrUrl, MEDIA_DIR);
  if (!candidatePath || !fs.existsSync(candidatePath)) {
    candidatePath = candidateImagePathOrUrl;
  }

  console.log(`[EVALUATOR PATHS RESOLVED] targetPath: "${targetPath}" (exists: ${fs.existsSync(targetPath)}) | candidatePath: "${candidatePath}" (exists: ${fs.existsSync(candidatePath)})`);

  const result = await evaluateTargetVsCandidate(targetPath, candidatePath, { stage });

  console.log(`[EVALUATOR RESULT] Total: ${result.total_score}/80 | Sim: ${result.semantic_similarity}/45 | Comp: ${result.composition_score}/12 | Obj: ${result.objects_score}/10 | Col: ${result.color_score}/7 | Qual: ${result.image_quality_score}/4 | Det: ${result.fine_details_score}/2`);

  return {
    semantic_similarity: result.semantic_similarity,
    semantic_score: result.semantic_score,
    composition_score: result.composition_score,
    objects_score: result.objects_score,
    color_score: result.color_score,
    image_quality_score: result.image_quality_score,
    fine_details_score: result.fine_details_score,
    details_score: result.details_score,
    total_score: result.total_score,
    clip_similarity: result.clip_similarity,
    calibrated_similarity_pct: result.calibrated_similarity_pct,
    evaluation_method: result.evaluation_method,
    evaluator_version: result.evaluator_version,
    evaluation_time_ms: result.evaluation_time_ms,
    evaluation_stage: stage,
  };
}

// User extraction helper
function getAuthUser(req: Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // Direct ID or token lookup
  if (users.has(token)) {
    return users.get(token)!;
  }

  // Admin token check
  if (token.startsWith('admin') || token.includes('admin')) {
    return adminUser;
  }

  // Find user by id or email
  for (const user of users.values()) {
    if (user.id === token || user.email === token) {
      return user;
    }
  }

  // If token is a mock/client token (e.g. Firebase or demo guest token), auto-create or retrieve
  let fallbackId = 'participant_' + token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  if (fallbackId.length < 5) fallbackId = 'participant_guest';

  let guest = users.get(fallbackId);
  if (!guest) {
    guest = {
      id: fallbackId,
      email: `${fallbackId}@participant.challenge`,
      username: fallbackId,
      full_name: 'Challenge Participant',
      role: 'PARTICIPANT',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.set(guest.id, guest);
  }
  return guest;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Not authenticated.' });
  }
  (req as any).user = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Not authenticated.' });
  }
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ detail: 'Access denied. You do not have permission to perform this action.' });
  }
  (req as any).user = user;
  next();
}

export async function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Static media route
  app.use('/media', express.static(MEDIA_DIR));

  // --- API Routes ---

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth: me
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ detail: 'Not authenticated.' });
    }
    const { password, ...safeUser } = user;
    res.json({ status: 'success', data: safeUser, message: 'OK' });
  });

  // Auth: login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    let user = users.get(email) || users.get(email?.toLowerCase());

    if (!user && (email === 'admin@example.com' || email === 'admin')) {
      user = adminUser;
    }

    if (user && user.password && user.password !== password) {
      return res.status(400).json({ detail: 'Invalid email or password.' });
    }

    if (!user) {
      // Create participant on the fly
      user = {
        id: `user_${Date.now()}`,
        email: email || 'participant@example.com',
        username: email ? email.split('@')[0] : 'participant',
        full_name: 'Challenge Participant',
        role: 'PARTICIPANT',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.set(user.id, user);
      users.set(user.email, user);
    }

    const token = user.role === 'ADMIN' ? `admin-token-${user.id}` : `token-${user.id}`;
    const { password: _, ...safeUser } = user;
    res.json({
      status: 'success',
      data: {
        access_token: token,
        token_type: 'bearer',
        user: safeUser,
      },
      message: 'Logged in successfully',
    });
  });

  // Auth: register
  app.post('/api/auth/register', (req, res) => {
    const { email, username, full_name, password } = req.body;
    if (!email || !username) {
      return res.status(400).json({ detail: 'Email and username are required.' });
    }
    const id = `user_${Date.now()}`;
    const newUser: StoredUser = {
      id,
      email,
      username,
      full_name: full_name || null,
      role: 'PARTICIPANT',
      avatar_url: null,
      is_active: true,
      password,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.set(id, newUser);
    users.set(email, newUser);

    const token = `token-${id}`;
    const { password: _, ...safeUser } = newUser;
    res.json({
      status: 'success',
      data: {
        access_token: token,
        token_type: 'bearer',
        user: safeUser,
      },
      message: 'Registered successfully',
    });
  });

  // Auth: google-demo / fallback
  app.post('/api/auth/google-demo', (req, res) => {
    const { email, name } = req.body;
    const userEmail = email || 'creatorabhishekav@gmail.com';
    let user = users.get(userEmail);
    if (!user) {
      user = {
        id: `google_${Date.now()}`,
        email: userEmail,
        username: (name || userEmail.split('@')[0] || 'participant').replace(/\s+/g, '_').toLowerCase(),
        full_name: name || 'Reverse Prompt Engineer',
        role: 'PARTICIPANT',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.set(user.id, user);
      users.set(user.email, user);
    }
    const token = `token-${user.id}`;
    const { password: _, ...safeUser } = user;
    res.json({
      status: 'success',
      data: {
        access_token: token,
        token_type: 'bearer',
        user: safeUser,
      },
      message: 'Google login successful',
    });
  });

  // AI Status
  app.get('/api/ai/status', (_req, res) => {
    res.json({
      status: 'success',
      data: {
        mode: 'gemini_clip_hybrid',
        model: 'clip-vit-base-patch32 / gemini-2.5-flash',
        device: 'cloud',
        loaded: true,
        provider: 'AI Studio Engine',
        configured: true,
      },
      message: 'OK',
    });
  });

  // AI Generate demo
  app.post('/api/ai/generate', (req, res) => {
    const { prompt } = req.body;
    res.json({
      status: 'success',
      data: {
        url: sampleImgUrl,
        provider: 'Gemini Image Generation',
        demo: true,
        prompt: prompt || '',
      },
      message: 'Image generated.',
    });
  });

  // Competitions: active
  app.get('/api/competitions/active', requireAuth, (_req, res) => {
    const activeComps = Array.from(competitions.values()).filter(
      (c) => !c.is_archived && (c.status === 'active' || c.status === 'paused')
    );
    const result = activeComps.map((c) => {
      const compRounds = Array.from(rounds.values()).filter((r) => r.competition_id === c.id && !r.is_archived);
      const openRounds = compRounds.filter((r) => r.status === 'active' || r.status === 'paused');
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        round_count: compRounds.length,
        open_round_count: openRounds.length,
      };
    });
    res.json({ status: 'success', data: result, message: 'OK' });
  });

  // Rounds: active
  app.get('/api/rounds/active', requireAuth, (_req, res) => {
    const activeRounds = Array.from(rounds.values()).filter(
      (r) => !r.is_archived && (r.status === 'active' || r.status === 'paused')
    );
    const result = activeRounds.map((r) => {
      const comp = competitions.get(r.competition_id);
      return {
        id: r.id,
        competition_id: r.competition_id,
        competition_title: comp?.title || 'Championship',
        round_number: r.round_number,
        title: r.title,
        description: r.description,
        time_limit_seconds: r.time_limit_seconds,
        status: r.status,
        server_elapsed_seconds: 0,
        target_image_url: r.target_image_url,
      };
    });
    res.json({ status: 'success', data: result, message: 'OK' });
  });

  // Helper to validate HTTPS URLs for Google Gemini Chat Link
  function validateHttpsUrl(rawUrl: string): { valid: boolean; error?: string; cleanedUrl?: string } {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Please paste your Google Gemini chat link before submitting.' };
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: 'Please enter a valid HTTPS URL for your Google Gemini chat link.' };
      }
      return { valid: true, cleanedUrl: trimmed };
    } catch {
      return { valid: false, error: 'Please enter a valid HTTPS URL for your Google Gemini chat link.' };
    }
  }

  // Helper to construct ChallengeStatusRead response
  function formatChallengeStatus(sub: StoredSubmission, round: StoredRound, comp: StoredCompetition) {
    const now = Date.now();
    const started = new Date(sub.started_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000));
    const remainingSeconds = Math.max(0, round.time_limit_seconds - elapsedSeconds);

    return {
      id: sub.id,
      round_id: round.id,
      round_title: round.title,
      competition_title: comp.title,
      time_limit_seconds: round.time_limit_seconds,
      round_status: round.status,
      target_image_url: round.target_image_url,
      uploaded_image_url: sub.final_image_url || null,
      first_image_url: sub.first_image_url || null,
      final_image_url: sub.final_image_url || null,
      gemini_chat_link: sub.gemini_chat_link || null,
      status: sub.status,
      prompt: sub.prompt_used || '',
      prompt_1: sub.prompt_1 || sub.prompt_used || '',
      prompt_2: sub.prompt_2 || '',
      started_at_elapsed: elapsedSeconds,
      remaining_seconds: remainingSeconds,
      deadline_elapsed: round.time_limit_seconds,
      submitted_at: sub.submitted_at,
      scoring_status: sub.scoring_status || null,
      total_score: sub.total_score || null,
      first_scoring_status: sub.first_stage_breakdown ? 'scored' : null,
      first_score: sub.first_stage_breakdown?.total_score || null,
      first_score_breakdown: sub.first_stage_breakdown || null,
      final_score: sub.final_stage_breakdown?.total_score || null,
      final_score_breakdown: sub.final_stage_breakdown || null,
    };
  }

  // Start round challenge
  app.post('/api/rounds/:roundId/start', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { roundId } = req.params;
    const round = rounds.get(roundId);
    if (!round) {
      return res.status(404).json({ detail: 'Round not found.' });
    }
    const comp = competitions.get(round.competition_id) || comp1;

    // Check if user already has an active submission for this round
    let sub = Array.from(submissions.values()).find(
      (s) => s.user_id === user.id && s.round_id === round.id
    );

    if (!sub) {
      sub = {
        id: `sub_${user.id}_${round.id}`,
        user_id: user.id,
        round_id: round.id,
        target_image_id: `ti_${round.id}`,
        image_url: null,
        first_image_url: null,
        final_image_url: null,
        gemini_chat_link: null,
        prompt_used: '',
        prompt_1: '',
        prompt_2: '',
        status: 'in_progress',
        scoring_status: null,
        started_at: new Date().toISOString(),
        submitted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      submissions.set(sub.id, sub);
    }

    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Challenge active',
    });
  });

  // Get status for round
  app.get('/api/rounds/:roundId/status', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { roundId } = req.params;
    const round = rounds.get(roundId);
    if (!round) {
      return res.status(404).json({ detail: 'Round not found.' });
    }
    const comp = competitions.get(round.competition_id) || comp1;
    const sub = Array.from(submissions.values()).find(
      (s) => s.user_id === user.id && s.round_id === round.id
    );
    if (!sub) {
      return res.status(404).json({ detail: 'No active challenge found for this round.' });
    }
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'OK',
    });
  });

  // Protected Target Image Delivery (Requires authentication & active authorization)
  app.get('/api/rounds/:roundId/protected-target-image', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { roundId } = req.params;
    const round = rounds.get(roundId);
    if (!round) {
      return res.status(404).json({ detail: 'Round not found.' });
    }

    // Verify participant has access (Admin or active/scheduled round)
    if (user.role !== 'ADMIN') {
      if (round.status === 'draft' || round.is_archived) {
        return res.status(403).json({ detail: 'This challenge round is not open to participants.' });
      }
    }

    // Resolve authoritative target image path
    let localPath = resolveLocalImagePath(round.target_image_url || '', MEDIA_DIR);
    if (!localPath || !fs.existsSync(localPath)) {
      localPath = path.resolve(MEDIA_DIR, 'rounds/round_cyberpunk.png');
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ detail: 'Target image file not found.' });
    }

    // Set cache control for the active session, content type, and send file
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(localPath);
  });

  // Protected Target Image Delivery by Challenge ID (Matches user request GET /api/challenges/:id/target-image)
  app.get('/api/challenges/:challengeId/target-image', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { challengeId } = req.params;
    const sub = submissions.get(challengeId);
    if (!sub) {
      return res.status(404).json({ detail: 'Challenge submission not found.' });
    }

    // Verify authorized user: owner of submission or Admin
    if (user.role !== 'ADMIN' && sub.user_id !== user.id) {
      return res.status(403).json({ detail: 'Unauthorized to view this challenge target image.' });
    }

    const round = rounds.get(sub.round_id);
    if (!round) {
      return res.status(404).json({ detail: 'Associated round not found.' });
    }

    let localPath = resolveLocalImagePath(round.target_image_url || '', MEDIA_DIR);
    if (!localPath || !fs.existsSync(localPath)) {
      localPath = path.resolve(MEDIA_DIR, 'rounds/round_cyberpunk.png');
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ detail: 'Target image file not found.' });
    }

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(localPath);
  });

  // Save prompt draft
  app.put('/api/submissions/:submissionId/prompt', requireAuth, (req, res) => {
    const { submissionId } = req.params;
    const { prompt } = req.body;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    sub.prompt_used = prompt || '';
    sub.updated_at = new Date().toISOString();

    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Prompt updated',
    });
  });

  // Save or update Gemini Chat Link
  app.put('/api/submissions/:submissionId/gemini-link', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    if (user.role !== 'ADMIN' && sub.user_id !== user.id) {
      return res.status(403).json({ detail: 'Unauthorized to update this submission.' });
    }

    const rawLink = req.body.gemini_chat_link ?? req.body.link ?? '';
    const trimmed = typeof rawLink === 'string' ? rawLink.trim() : '';

    if (trimmed) {
      const val = validateHttpsUrl(trimmed);
      if (!val.valid) {
        return res.status(400).json({ detail: val.error });
      }
      sub.gemini_chat_link = val.cleanedUrl!;
    } else {
      sub.gemini_chat_link = null;
    }
    sub.updated_at = new Date().toISOString();

    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Gemini chat link updated',
    });
  });

  app.post('/api/submissions/:submissionId/gemini-link', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    if (user.role !== 'ADMIN' && sub.user_id !== user.id) {
      return res.status(403).json({ detail: 'Unauthorized to update this submission.' });
    }

    const rawLink = req.body.gemini_chat_link ?? req.body.link ?? '';
    const trimmed = typeof rawLink === 'string' ? rawLink.trim() : '';

    if (trimmed) {
      const val = validateHttpsUrl(trimmed);
      if (!val.valid) {
        return res.status(400).json({ detail: val.error });
      }
      sub.gemini_chat_link = val.cleanedUrl!;
    } else {
      sub.gemini_chat_link = null;
    }
    sub.updated_at = new Date().toISOString();

    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Gemini chat link updated',
    });
  });

  // Submit Prompt 1
  app.post('/api/submissions/:submissionId/prompt-1', requireAuth, (req, res) => {
    const { submissionId } = req.params;
    const { prompt } = req.body;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    sub.prompt_1 = prompt || '';
    sub.prompt_used = prompt || '';
    sub.status = 'prompt1_submitted';
    sub.updated_at = new Date().toISOString();

    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Prompt 1 submitted',
    });
  });

  // Upload First Image
  app.post('/api/submissions/:submissionId/upload-first-image', requireAuth, upload.single('file'), async (req, res) => {
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;

    const file = req.file;
    const imageUrl = file ? `/media/uploads/${file.filename}` : sub.first_image_url || sub.image_url;
    if (!imageUrl) {
      return res.status(400).json({ detail: 'No image uploaded.' });
    }

    sub.first_image_url = imageUrl;
    sub.image_url = imageUrl;
    sub.status = 'first_uploaded';

    try {
      // Evaluate first stage with CLIP ViT-B/32 + multi-factor computer vision
      const breakdown = await evaluateSubmissionImages(
        round.target_image_url,
        imageUrl,
        'FIRST'
      );
      sub.first_stage_breakdown = breakdown;
      sub.total_score = breakdown.total_score;
      sub.updated_at = new Date().toISOString();

      // Create score record
      scores.set(`score_${sub.id}_first`, {
        id: `score_${sub.id}_first`,
        submission_id: sub.id,
        round_id: round.id,
        user_id: sub.user_id,
        stage: 'FIRST',
        ...breakdown,
        status: 'scored',
        feedback: 'First stage evaluated. Refine your prompt in Round 2 for higher score.',
        created_at: new Date().toISOString(),
      });

      res.json({
        status: 'success',
        data: formatChallengeStatus(sub, round, comp),
        message: 'First image uploaded and evaluated',
      });
    } catch (evalErr: any) {
      console.error('[EVALUATION ERROR]', evalErr);
      return res.status(400).json({ detail: `Image evaluation error: ${evalErr.message}` });
    }
  });

  // Submit Prompt 2
  app.post('/api/submissions/:submissionId/prompt-2', requireAuth, (req, res) => {
    const { submissionId } = req.params;
    const { prompt } = req.body;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    sub.prompt_2 = prompt || '';
    sub.prompt_used = prompt || sub.prompt_1 || '';
    sub.status = 'prompt2_submitted';
    sub.updated_at = new Date().toISOString();

    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Prompt 2 submitted',
    });
  });

  // Upload Final Image
  app.post('/api/submissions/:submissionId/upload-final-image', requireAuth, upload.single('file'), async (req, res) => {
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;

    const file = req.file;
    const imageUrl = file ? `/media/uploads/${file.filename}` : sub.final_image_url || sub.image_url;
    if (!imageUrl) {
      return res.status(400).json({ detail: 'No final image uploaded.' });
    }

    sub.final_image_url = imageUrl;
    sub.image_url = imageUrl;
    sub.status = 'completed';
    sub.scoring_status = 'scored';
    sub.submitted_at = new Date().toISOString();

    try {
      // Evaluate final stage with CLIP ViT-B/32 + multi-factor computer vision
      const breakdown = await evaluateSubmissionImages(
        round.target_image_url,
        imageUrl,
        'FINAL'
      );
      sub.final_stage_breakdown = breakdown;
      sub.total_score = breakdown.total_score;
      sub.feedback = 'Final submission successfully evaluated. Strong prompt engineering and stylistic alignment.';
      sub.updated_at = new Date().toISOString();

      // Create score record
      scores.set(`score_${sub.id}_final`, {
        id: `score_${sub.id}_final`,
        submission_id: sub.id,
        round_id: round.id,
        user_id: sub.user_id,
        stage: 'FINAL',
        ...breakdown,
        status: 'scored',
        feedback: sub.feedback,
        created_at: new Date().toISOString(),
      });

      res.json({
        status: 'success',
        data: formatChallengeStatus(sub, round, comp),
        message: 'Final image uploaded and evaluated',
      });
    } catch (evalErr: any) {
      console.error('[EVALUATION ERROR]', evalErr);
      return res.status(400).json({ detail: `Image evaluation error: ${evalErr.message}` });
    }
  });

  // Upload image general fallback
  app.post('/api/submissions/:submissionId/upload-image', requireAuth, upload.single('file'), async (req, res) => {
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;

    const file = req.file;
    const imageUrl = file ? `/media/uploads/${file.filename}` : sub.final_image_url || sub.first_image_url || sub.image_url;
    if (!imageUrl) {
      return res.status(400).json({ detail: 'No image uploaded.' });
    }

    sub.image_url = imageUrl;
    sub.final_image_url = imageUrl;
    sub.updated_at = new Date().toISOString();

    try {
      const breakdown = await evaluateSubmissionImages(
        round.target_image_url,
        imageUrl,
        'FINAL'
      );
      sub.final_stage_breakdown = breakdown;
      sub.total_score = breakdown.total_score;

      res.json({
        status: 'success',
        data: formatChallengeStatus(sub, round, comp),
        message: 'Image uploaded and evaluated',
      });
    } catch (evalErr: any) {
      console.error('[EVALUATION ERROR]', evalErr);
      return res.status(400).json({ detail: `Image evaluation error: ${evalErr.message}` });
    }
  });

  // Submit challenge finalization
  app.post('/api/submissions/:submissionId/submit', requireAuth, async (req, res) => {
    const { submissionId } = req.params;
    const sub = submissions.get(submissionId);
    if (!sub) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    const round = rounds.get(sub.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;

    // Validate Google Gemini Chat Link is provided and valid HTTPS URL
    const rawLink = req.body?.gemini_chat_link !== undefined ? req.body.gemini_chat_link : sub.gemini_chat_link;
    const trimmed = typeof rawLink === 'string' ? rawLink.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ detail: 'Please paste your Google Gemini chat link before submitting.' });
    }
    const val = validateHttpsUrl(trimmed);
    if (!val.valid) {
      return res.status(400).json({ detail: val.error });
    }
    sub.gemini_chat_link = val.cleanedUrl!;

    sub.status = 'completed';
    sub.scoring_status = 'scored';
    if (!sub.submitted_at) {
      sub.submitted_at = new Date().toISOString();
    }
    if (!sub.final_stage_breakdown && (sub.final_image_url || sub.first_image_url || sub.image_url)) {
      const activeImg = sub.final_image_url || sub.first_image_url || sub.image_url || '';
      try {
        const breakdown = await evaluateSubmissionImages(
          round.target_image_url,
          activeImg,
          'FINAL'
        );
        sub.final_stage_breakdown = breakdown;
        sub.total_score = breakdown.total_score;
        sub.feedback = 'Submission complete and evaluated.';
      } catch (evalErr: any) {
        console.warn('[SUBMIT FINAL EVAL WARN]', evalErr);
      }
    }
    sub.updated_at = new Date().toISOString();

    res.json({
      status: 'success',
      data: formatChallengeStatus(sub, round, comp),
      message: 'Challenge submitted successfully',
    });
  });

  // Results: me
  app.get('/api/results/me', requireAuth, (req, res) => {
    const user: StoredUser = (req as any).user;
    const userSubs = Array.from(submissions.values()).filter((s) => s.user_id === user.id);

    const results = userSubs.map((s) => {
      const round = rounds.get(s.round_id) || round1;
      const comp = competitions.get(round.competition_id) || comp1;
      const breakdown = s.final_stage_breakdown || s.first_stage_breakdown || {
        semantic_score: 0,
        composition_score: 0,
        objects_score: 0,
        color_score: 0,
        details_score: 0,
        total_score: 0,
        clip_similarity: 0,
        evaluation_method: 'CLIP + Computer Vision',
      };

      return {
        submission_id: s.id,
        round_id: round.id,
        round_title: round.title,
        competition_title: comp.title,
        target_image_url: round.target_image_url,
        uploaded_image_url: s.final_image_url || s.image_url,
        first_image_url: s.first_image_url,
        final_image_url: s.final_image_url,
        gemini_chat_link: s.gemini_chat_link || null,
        prompt_used: s.prompt_used,
        prompt_1: s.prompt_1,
        prompt_2: s.prompt_2,
        submission_status: s.status,
        scoring_status: s.scoring_status || 'scored',
        semantic_similarity: breakdown.semantic_similarity ?? breakdown.semantic_score,
        semantic_score: breakdown.semantic_score,
        composition_score: breakdown.composition_score,
        objects_score: breakdown.objects_score,
        color_score: breakdown.color_score,
        image_quality_score: breakdown.image_quality_score ?? 4.0,
        fine_details_score: breakdown.fine_details_score ?? breakdown.details_score,
        details_score: breakdown.details_score,
        total_score: breakdown.total_score,
        feedback: s.feedback || 'Good attempt!',
        submitted_at: s.submitted_at || s.updated_at,
        clip_similarity: breakdown.clip_similarity,
        evaluation_method: breakdown.evaluation_method,
        first_scoring_status: s.first_stage_breakdown ? 'scored' : null,
        first_score: s.first_stage_breakdown?.total_score || null,
        first_score_breakdown: s.first_stage_breakdown || null,
        final_score: s.final_stage_breakdown?.total_score || null,
        final_score_breakdown: s.final_stage_breakdown || null,
      };
    });

    res.json({ status: 'success', data: results, message: 'OK' });
  });

  // Results: single submission
  app.get('/api/submissions/:submissionId/result', requireAuth, (req, res) => {
    const { submissionId } = req.params;
    const s = submissions.get(submissionId);
    if (!s) {
      return res.status(404).json({ detail: 'Submission not found.' });
    }
    const round = rounds.get(s.round_id) || round1;
    const comp = competitions.get(round.competition_id) || comp1;
    const breakdown = s.final_stage_breakdown || s.first_stage_breakdown || {
      semantic_score: 0,
      composition_score: 0,
      objects_score: 0,
      color_score: 0,
      details_score: 0,
      total_score: 0,
      clip_similarity: 0,
      evaluation_method: 'CLIP + Computer Vision',
    };

    res.json({
      status: 'success',
      data: {
        submission_id: s.id,
        round_id: round.id,
        round_title: round.title,
        competition_title: comp.title,
        target_image_url: round.target_image_url,
        uploaded_image_url: s.final_image_url || s.image_url,
        first_image_url: s.first_image_url,
        final_image_url: s.final_image_url,
        gemini_chat_link: s.gemini_chat_link || null,
        prompt_used: s.prompt_used,
        prompt_1: s.prompt_1,
        prompt_2: s.prompt_2,
        submission_status: s.status,
        scoring_status: s.scoring_status || 'scored',
        semantic_similarity: breakdown.semantic_similarity ?? breakdown.semantic_score,
        semantic_score: breakdown.semantic_score,
        composition_score: breakdown.composition_score,
        objects_score: breakdown.objects_score,
        color_score: breakdown.color_score,
        image_quality_score: breakdown.image_quality_score ?? 4.0,
        fine_details_score: breakdown.fine_details_score ?? breakdown.details_score,
        details_score: breakdown.details_score,
        total_score: breakdown.total_score,
        feedback: s.feedback || 'Evaluated successfully.',
        submitted_at: s.submitted_at || s.updated_at,
        clip_similarity: breakdown.clip_similarity,
        evaluation_method: breakdown.evaluation_method,
        first_scoring_status: s.first_stage_breakdown ? 'scored' : null,
        first_score: s.first_stage_breakdown?.total_score || null,
        first_score_breakdown: s.first_stage_breakdown || null,
        final_score: s.final_stage_breakdown?.total_score || null,
        final_score_breakdown: s.final_stage_breakdown || null,
      },
      message: 'OK',
    });
  });

  // Leaderboard
  app.get('/api/leaderboard', requireAuth, (req, res) => {
    const { round_id } = req.query;

    // Filter ONLY submissions that have an official, valid FINAL evaluation score
    let eligibleSubs = Array.from(submissions.values()).filter((s) => {
      // Must have final_stage_breakdown and a valid numerical total_score
      const finalScore = s.final_stage_breakdown?.total_score;
      if (typeof finalScore !== 'number' || isNaN(finalScore) || finalScore < 0) {
        return false;
      }
      return true;
    });

    if (round_id) {
      eligibleSubs = eligibleSubs.filter((s) => s.round_id === round_id);
    }

    // Group by user and take their latest authoritative FINAL submission
    // (If a participant replaces their final image or plays multiple rounds, their authoritative
    // current submission reflects their latest submitted attempt)
    const userSubmissionMap = new Map<string, StoredSubmission>();
    for (const sub of eligibleSubs) {
      const current = userSubmissionMap.get(sub.user_id);
      if (!current) {
        userSubmissionMap.set(sub.user_id, sub);
      } else {
        // Use latest submission timestamp
        const subTime = new Date(sub.submitted_at || sub.updated_at || sub.created_at).getTime();
        const currentTime = new Date(current.submitted_at || current.updated_at || current.created_at).getTime();
        if (subTime >= currentTime) {
          userSubmissionMap.set(sub.user_id, sub);
        }
      }
    }

    // Sort ALL participants by authoritative CURRENT FINAL score (descending numeric), with stable tie-breaking
    const sorted = Array.from(userSubmissionMap.values()).sort((a, b) => {
      const scoreA = Number(a.final_stage_breakdown?.total_score ?? 0);
      const scoreB = Number(b.final_stage_breakdown?.total_score ?? 0);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Tie-breaker 1: Earlier submission timestamp
      const timeA = new Date(a.submitted_at || a.created_at).getTime();
      const timeB = new Date(b.submitted_at || b.created_at).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // Tie-breaker 2: Alphabetical user_id for strict determinism
      return a.user_id.localeCompare(b.user_id);
    });

    // Competition standard ranking (1224) or ordinal ranking:
    // If scores are equal, they share the rank; the next different score skips ranks.
    let currentRank = 1;
    const entries = sorted.map((sub, index) => {
      const u = users.get(sub.user_id);
      const b = sub.final_stage_breakdown!;
      const finalScore = Number(b.total_score);

      if (index > 0) {
        const prevScore = Number(sorted[index - 1].final_stage_breakdown?.total_score ?? 0);
        if (finalScore < prevScore) {
          currentRank = index + 1;
        }
      }

      return {
        rank: currentRank,
        user_id: sub.user_id,
        username: u?.username || 'Participant',
        full_name: u?.full_name || null,
        total_score: finalScore,
        semantic_score: Number(b.semantic_score ?? 0),
        composition_score: Number(b.composition_score ?? 0),
        objects_score: Number(b.objects_score ?? 0),
        color_score: Number(b.color_score ?? 0),
        details_score: Number(b.details_score ?? 0),
        rounds_played: 1,
      };
    });

    res.json({ status: 'success', data: entries, message: 'OK' });
  });

  // Admin: Overview
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const allUsers = Array.from(users.values());
    const participants = allUsers.filter((u) => u.role === 'PARTICIPANT');
    const allComps = Array.from(competitions.values()).filter((c) => !c.is_archived);
    const allRounds = Array.from(rounds.values()).filter((r) => !r.is_archived);
    const allSubs = Array.from(submissions.values());

    res.json({
      status: 'success',
      data: {
        users: allUsers.length,
        participants: participants.length,
        competitions: allComps.length,
        rounds: allRounds.length,
        submissions: allSubs.length,
      },
      message: 'OK',
    });
  });

  // Admin: Users
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const list = Array.from(users.values())
      .filter((u) => u.role === 'PARTICIPANT')
      .map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        full_name: u.full_name,
        is_active: u.is_active,
        created_at: u.created_at,
      }));
    res.json({ status: 'success', data: list, message: 'OK' });
  });

  // Admin: Competitions list
  app.get('/api/admin/competitions', requireAdmin, (_req, res) => {
    const list = Array.from(competitions.values())
      .filter((c) => !c.is_archived)
      .map((c) => {
        const compRounds = Array.from(rounds.values()).filter(
          (r) => r.competition_id === c.id && !r.is_archived
        );
        return {
          ...c,
          rounds: compRounds,
        };
      });
    res.json({ status: 'success', data: list, message: 'OK' });
  });

  // Admin: Create competition
  app.post('/api/admin/competitions', requireAdmin, (req, res) => {
    const { title, description, slug, scheduled_start, scheduled_end } = req.body;
    const id = `comp_${Date.now()}`;
    const newComp: StoredCompetition = {
      id,
      title,
      description: description || null,
      slug: slug || title.toLowerCase().replace(/\s+/g, '-'),
      status: 'draft',
      scheduled_start: scheduled_start || null,
      scheduled_end: scheduled_end || null,
      started_at: null,
      paused_at: null,
      ended_at: null,
      created_by: (req as any).user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    competitions.set(id, newComp);
    res.json({ status: 'success', data: { ...newComp, rounds: [] }, message: 'Created' });
  });

  // Admin: Update competition
  app.patch('/api/admin/competitions/:id', requireAdmin, (req, res) => {
    const comp = competitions.get(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Competition not found.' });

    const { title, description, slug, scheduled_start, scheduled_end } = req.body;
    if (title) comp.title = title;
    if (description !== undefined) comp.description = description;
    if (slug) comp.slug = slug;
    if (scheduled_start !== undefined) comp.scheduled_start = scheduled_start;
    if (scheduled_end !== undefined) comp.scheduled_end = scheduled_end;
    comp.updated_at = new Date().toISOString();

    const compRounds = Array.from(rounds.values()).filter(
      (r) => r.competition_id === comp.id && !r.is_archived
    );
    res.json({ status: 'success', data: { ...comp, rounds: compRounds }, message: 'Updated' });
  });

  // Admin: Competition action (start, pause, resume, end)
  app.post('/api/admin/competitions/:id/:action', requireAdmin, (req, res) => {
    const comp = competitions.get(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Competition not found.' });

    const action = req.params.action;
    if (action === 'start') {
      comp.status = 'active';
      comp.started_at = new Date().toISOString();
    } else if (action === 'pause') {
      comp.status = 'paused';
      comp.paused_at = new Date().toISOString();
    } else if (action === 'resume') {
      comp.status = 'active';
      comp.paused_at = null;
    } else if (action === 'end') {
      comp.status = 'ended';
      comp.ended_at = new Date().toISOString();
    }
    comp.updated_at = new Date().toISOString();

    const compRounds = Array.from(rounds.values()).filter(
      (r) => r.competition_id === comp.id && !r.is_archived
    );
    res.json({ status: 'success', data: { ...comp, rounds: compRounds }, message: 'Status updated' });
  });

  // Admin: Archive/Restore competition
  app.post('/api/admin/competitions/:id/archive', requireAdmin, (req, res) => {
    const comp = competitions.get(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Competition not found.' });
    comp.is_archived = true;
    res.json({ status: 'success', data: comp, message: 'Archived' });
  });

  app.post('/api/admin/competitions/:id/restore', requireAdmin, (req, res) => {
    const comp = competitions.get(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Competition not found.' });
    comp.is_archived = false;
    res.json({ status: 'success', data: comp, message: 'Restored' });
  });

  // Admin: Rounds in competition
  app.get('/api/admin/competitions/:id/rounds', requireAdmin, (req, res) => {
    const compRounds = Array.from(rounds.values()).filter(
      (r) => r.competition_id === req.params.id && !r.is_archived
    );
    res.json({ status: 'success', data: compRounds, message: 'OK' });
  });

  // Admin: Create round
  app.post('/api/admin/competitions/:id/rounds', requireAdmin, (req, res) => {
    const compId = req.params.id;
    const { title, description, secret_prompt, time_limit_seconds, max_submissions, round_number } = req.body;
    const id = `round_${Date.now()}`;
    const newRound: StoredRound = {
      id,
      competition_id: compId,
      round_number: round_number || 1,
      title,
      description: description || null,
      secret_prompt: secret_prompt || '',
      time_limit_seconds: time_limit_seconds || 600,
      max_submissions: max_submissions || 1,
      status: 'active',
      target_image_url: sampleImgUrl,
      started_at: new Date().toISOString(),
      paused_at: null,
      ended_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rounds.set(id, newRound);
    res.json({ status: 'success', data: newRound, message: 'Round created' });
  });

  // Admin: Update round
  app.patch('/api/admin/rounds/:id', requireAdmin, (req, res) => {
    const round = rounds.get(req.params.id);
    if (!round) return res.status(404).json({ detail: 'Round not found.' });

    const { title, description, secret_prompt, time_limit_seconds, max_submissions } = req.body;
    if (title) round.title = title;
    if (description !== undefined) round.description = description;
    if (secret_prompt) round.secret_prompt = secret_prompt;
    if (time_limit_seconds) round.time_limit_seconds = time_limit_seconds;
    if (max_submissions) round.max_submissions = max_submissions;
    round.updated_at = new Date().toISOString();

    res.json({ status: 'success', data: round, message: 'Round updated' });
  });

  // Admin: Round action
  app.post('/api/admin/rounds/:id/:action', requireAdmin, (req, res) => {
    const round = rounds.get(req.params.id);
    if (!round) return res.status(404).json({ detail: 'Round not found.' });

    const action = req.params.action;
    if (action === 'start') {
      round.status = 'active';
      round.started_at = new Date().toISOString();
    } else if (action === 'pause') {
      round.status = 'paused';
      round.paused_at = new Date().toISOString();
    } else if (action === 'resume') {
      round.status = 'active';
      round.paused_at = null;
    } else if (action === 'end') {
      round.status = 'ended';
      round.ended_at = new Date().toISOString();
    }
    round.updated_at = new Date().toISOString();

    res.json({ status: 'success', data: round, message: 'Round status updated' });
  });

  // Admin: Archive/Restore round
  app.post('/api/admin/rounds/:id/archive', requireAdmin, (req, res) => {
    const round = rounds.get(req.params.id);
    if (!round) return res.status(404).json({ detail: 'Round not found.' });
    round.is_archived = true;
    res.json({ status: 'success', data: round, message: 'Round archived' });
  });

  app.post('/api/admin/rounds/:id/restore', requireAdmin, (req, res) => {
    const round = rounds.get(req.params.id);
    if (!round) return res.status(404).json({ detail: 'Round not found.' });
    round.is_archived = false;
    res.json({ status: 'success', data: round, message: 'Round restored' });
  });

  // Admin: Target image upload
  app.post('/api/admin/rounds/:id/target-images', requireAdmin, upload.single('file'), (req, res) => {
    const round = rounds.get(req.params.id);
    if (!round) return res.status(404).json({ detail: 'Round not found.' });

    const file = req.file;
    const imageUrl = file ? `/media/uploads/${file.filename}` : sampleImgUrl;
    round.target_image_url = imageUrl;
    round.updated_at = new Date().toISOString();

    const tiRecord = {
      id: `ti_${Date.now()}`,
      round_id: round.id,
      image_url: imageUrl,
      alt_text: (req.body.alt_text as string) || null,
      created_by: (req as any).user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const currentList = targetImages.get(round.id) || [];
    currentList.push(tiRecord);
    targetImages.set(round.id, currentList);

    res.json({ status: 'success', data: tiRecord, message: 'Target image uploaded' });
  });

  // Admin: Target images list
  app.get('/api/admin/rounds/:id/target-images', requireAdmin, (req, res) => {
    const list = targetImages.get(req.params.id) || [];
    res.json({ status: 'success', data: list, message: 'OK' });
  });

  // Admin: Submissions list for round
  app.get('/api/admin/rounds/:id/submissions', requireAdmin, (req, res) => {
    const roundSubs = Array.from(submissions.values()).filter((s) => s.round_id === req.params.id);
    const round = rounds.get(req.params.id);

    const list = roundSubs.map((s) => {
      const u = users.get(s.user_id);
      const b = s.final_stage_breakdown || s.first_stage_breakdown;
      const isFinal = s.status === 'completed' || s.status === 'evaluated' || Boolean(s.final_stage_breakdown);
      return {
        id: s.id,
        user_id: s.user_id,
        username: u?.username || 'Participant',
        full_name: u?.full_name || null,
        round_id: s.round_id,
        round_title: round?.title || '',
        prompt_used: s.prompt_used,
        prompt_1: s.prompt_1,
        prompt_2: s.prompt_2,
        image_url: s.final_image_url || s.image_url,
        first_image_url: s.first_image_url,
        final_image_url: s.final_image_url,
        gemini_chat_link: isFinal ? (s.gemini_chat_link || null) : null,
        status: s.status,
        started_at_elapsed: null,
        deadline_elapsed: null,
        submitted_at: s.submitted_at,
        created_at: s.created_at,
        scoring_status: s.scoring_status || 'scored',
        semantic_similarity: b?.semantic_similarity ?? b?.semantic_score ?? 0,
        semantic_score: b?.semantic_score || 0,
        composition_score: b?.composition_score || 0,
        objects_score: b?.objects_score || 0,
        color_score: b?.color_score || 0,
        image_quality_score: b?.image_quality_score ?? 4.0,
        fine_details_score: b?.fine_details_score ?? b?.details_score ?? 0,
        details_score: b?.details_score || 0,
        total_score: s.total_score || b?.total_score || 0,
        clip_similarity: b?.clip_similarity || 0,
        evaluation_method: b?.evaluation_method || 'CLIP + Computer Vision',
        first_scoring_status: s.first_stage_breakdown ? 'scored' : null,
        first_score: s.first_stage_breakdown?.total_score || null,
        first_score_breakdown: s.first_stage_breakdown || null,
        final_score: s.final_stage_breakdown?.total_score || null,
        final_score_breakdown: s.final_stage_breakdown || null,
      };
    });

    res.json({ status: 'success', data: list, message: 'OK' });
  });

  // Admin: Delete submission
  app.delete('/api/admin/submissions/:submissionId', requireAdmin, (req, res) => {
    submissions.delete(req.params.submissionId);
    res.json({ status: 'success', data: { id: req.params.submissionId }, message: 'Deleted' });
  });

  // Handle Multer and Upload Errors
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ detail: 'File too large. Maximum file size is 30MB.' });
      }
      return res.status(400).json({ detail: `Upload error: ${err.message}` });
    }
    if (err && err.status) {
      return res.status(err.status).json({ detail: err.message });
    }
    next(err);
  });

  // Vite Integration (Dev mode vs Production mode)
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  return app;
}

// Start Server
createExpressApp().then((app) => {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
    // Pre-warm CLIP ML model in background
    initMLModel()
      .then(() => console.log('[SERVER] CLIP ViT-B/32 vision model pre-warmed and ready.'))
      .catch((e) => console.error('[SERVER] CLIP ViT-B/32 model pre-warm error:', e));
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
