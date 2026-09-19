export type UserRole = 'PARTICIPANT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  username: string;
  full_name?: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface HealthResponse {
  status: string;
}

export interface AiStatusResponse {
  mode: string;
  provider: string;
  configured: boolean;
}

export interface GeneratedImageResponse {
  url: string;
  provider: string;
  demo: boolean;
  prompt: string;
}

export interface ApiError {
  detail?: string | Array<{ msg: string; loc: string[]; type: string }>;
}

export type LifecycleStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'ended';

export type SubmissionStatus =
  | 'in_progress'
  | 'submitted'
  | 'scored'
  | 'rejected';

export interface Round {
  id: string;
  competition_id: string;
  round_number: number;
  title: string;
  description: string | null;
  secret_prompt: string;
  time_limit_seconds: number;
  max_submissions: number;
  status: LifecycleStatus;
  elapsed_seconds: number;
  server_elapsed_seconds: number;
  remaining_seconds: number;
  target_image_url: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Competition {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: LifecycleStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  rounds: Round[];
}

export interface CreateCompetitionRequest {
  title: string;
  description?: string | null;
  slug?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}

export interface UpdateCompetitionRequest {
  title?: string;
  description?: string | null;
  slug?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}

export interface CreateRoundRequest {
  round_number?: number | null;
  title: string;
  description?: string | null;
  secret_prompt: string;
  time_limit_seconds?: number;
  max_submissions?: number;
}

export interface UpdateRoundRequest {
  title?: string;
  description?: string | null;
  secret_prompt?: string;
  time_limit_seconds?: number;
  max_submissions?: number;
}

export interface TargetImage {
  id: string;
  round_id: string;
  image_url: string;
  alt_text: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  round_id: string;
  target_image_id: string | null;
  image_url: string | null;
  prompt_used: string;
  status: SubmissionStatus;
  started_at_elapsed: number | null;
  deadline_elapsed: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSubmission {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  round_id: string;
  round_title: string;
  prompt_used: string;
  image_url: string | null;
  status: SubmissionStatus;
  started_at_elapsed: number | null;
  deadline_elapsed: number | null;
  submitted_at: string | null;
  created_at: string;
  scoring_status?: string | null;
  semantic_score?: number | null;
  composition_score?: number | null;
  objects_score?: number | null;
  color_score?: number | null;
  details_score?: number | null;
  total_score?: number | null;
}

export interface AdminUserListItem {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OverviewStats {
  users: number;
  participants: number;
  competitions: number;
  rounds: number;
  submissions: number;
}

export interface ActiveCompetition {
  id: string;
  title: string;
  description: string | null;
  status: LifecycleStatus;
  round_count: number;
  open_round_count: number;
}

export interface ActiveRound {
  id: string;
  competition_id: string;
  competition_title: string;
  round_number: number;
  title: string;
  description: string | null;
  time_limit_seconds: number;
  status: LifecycleStatus;
  server_elapsed_seconds: number;
  target_image_url: string | null;
}

export interface ChallengeStatus {
  id: string;
  round_id: string;
  round_title: string;
  competition_title: string;
  time_limit_seconds: number;
  round_status: LifecycleStatus;
  target_image_url: string | null;
  uploaded_image_url: string | null;
  status: string;
  prompt: string;
  started_at_elapsed: number | null;
  remaining_seconds: number;
  deadline_elapsed: number | null;
  submitted_at: string | null;
  scoring_status?: string | null;
  total_score?: number | null;
}

export interface Score {
  id: string;
  submission_id: string;
  round_id: string;
  user_id: string;
  semantic_score: number;
  composition_score: number;
  objects_score: number;
  color_score: number;
  details_score: number;
  total_score: number;
  status: string;
  feedback: string | null;
  created_at: string;
}

export interface ResultItem {
  submission_id: string;
  round_id: string;
  round_title: string;
  competition_title: string;
  target_image_url: string | null;
  uploaded_image_url: string | null;
  prompt_used: string;
  submission_status: string;
  scoring_status: string;
  semantic_score: number;
  composition_score: number;
  objects_score: number;
  color_score: number;
  details_score: number;
  total_score: number;
  feedback: string | null;
  submitted_at: string | null;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  status: 'started' | 'completed' | 'abandoned';
  rounds_completed: number;
  final_score: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  full_name: string | null;
  total_score: number;
  semantic_score?: number;
  composition_score?: number;
  objects_score?: number;
  color_score?: number;
  details_score?: number;
  rounds_played: number;
}