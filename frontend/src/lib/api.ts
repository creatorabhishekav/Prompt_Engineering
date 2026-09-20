import axios from 'axios';
import type {
  ActiveCompetition,
  ActiveRound,
  AdminSubmission,
  AdminUserListItem,
  AiStatusResponse,
  AuthResponse,
  ChallengeStatus,
  Competition,
  CreateCompetitionRequest,
  CreateRoundRequest,
  GeneratedImageResponse,
  HealthResponse,
  LoginRequest,
  OverviewStats,
  RegisterRequest,
  Round,
  TargetImage,
  UpdateCompetitionRequest,
  UpdateRoundRequest,
  LeaderboardEntry,
  ResultItem,
  User,
} from '@/types';

const TOKEN_KEY = 'match_that_image_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

interface Envelope<T> {
  status: string;
  data: T;
  message?: string;
}

const unwrap = <T>(response: { data: Envelope<T> }): T => response.data.data;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

import { auth } from '@/lib/firebase';

api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('[AXIOS INTERCEPTOR] Failed to retrieve Firebase token:', e);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('[AXIOS 401 INTERCEPTOR TRIGGERED ON]', error.config?.url);
      tokenStorage.clear();
    }
    return Promise.reject(error);
  }
);

// sendFormData avoids the default application/json header so the browser
// sets the correct multipart boundary.
const sendFormData = (endpoint: string, formData: FormData) =>
  api
    .post<Envelope<TargetImage>>(endpoint, formData, {
      headers: { 'Content-Type': undefined },
    })
    .then(unwrap<TargetImage>);

export const authApi = {
  register: (payload: RegisterRequest) =>
    api.post('/auth/register', payload).then(unwrap<AuthResponse>),
  login: (payload: LoginRequest) =>
    api.post('/auth/login', payload).then(unwrap<AuthResponse>),
  me: () => api.get<Envelope<User>>('/auth/me').then(unwrap<User>),
};

export const healthApi = {
  check: () =>
    api
      .get<HealthResponse>('/health')
      .then((r) => r.data)
      .catch(() => ({ status: 'down' as const })),
};

export const aiApi = {
  status: () => api.get('/ai/status').then(unwrap<AiStatusResponse>),
  generate: (prompt: string) =>
    api.post('/ai/generate', { prompt }).then(unwrap<GeneratedImageResponse>),
};

export const challengeApi = {
  activeCompetitions: () =>
    api.get('/competitions/active').then(unwrap<ActiveCompetition[]>),
  activeRounds: () => api.get('/rounds/active').then(unwrap<ActiveRound[]>),
  start: (roundId: string) =>
    api.post(`/rounds/${roundId}/start`).then(unwrap<ChallengeStatus>),
  status: (roundId: string) =>
    api.get(`/rounds/${roundId}/status`).then(unwrap<ChallengeStatus>),
  savePrompt: (submissionId: string, prompt: string) =>
    api
      .put(`/submissions/${submissionId}/prompt`, { prompt })
      .then(unwrap<ChallengeStatus>),
  uploadImage: (submissionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<Envelope<ChallengeStatus>>(`/submissions/${submissionId}/upload-image`, formData, {
        headers: { 'Content-Type': undefined },
      })
      .then(unwrap<ChallengeStatus>);
  },
  submit: (submissionId: string) =>
    api.post(`/submissions/${submissionId}/submit`).then(unwrap<ChallengeStatus>),
};

export const resultsApi = {
  me: () => api.get('/results/me').then(unwrap<ResultItem[]>),
  get: (submissionId: string) =>
    api.get(`/submissions/${submissionId}/result`).then(unwrap<ResultItem>),
};

export const leaderboardApi = {
  list: (roundId?: string) =>
    api
      .get('/leaderboard', { params: roundId ? { round_id: roundId } : {} })
      .then(unwrap<LeaderboardEntry[]>),
};

export const adminApi = {
  overview: () => api.get('/admin/overview').then(unwrap<OverviewStats>),
  users: () => api.get('/admin/users').then(unwrap<AdminUserListItem[]>),
  competitions: () => api.get('/admin/competitions').then(unwrap<Competition[]>),
  createCompetition: (payload: CreateCompetitionRequest) =>
    api.post('/admin/competitions', payload).then(unwrap<Competition>),
  updateCompetition: (id: string, payload: UpdateCompetitionRequest) =>
    api.patch(`/admin/competitions/${id}`, payload).then(unwrap<Competition>),
  getCompetition: (id: string) =>
    api.get(`/admin/competitions/${id}`).then(unwrap<Competition>),
  competitionAction: (action: 'start' | 'pause' | 'resume' | 'end' | 'schedule', id: string) =>
    api.post(`/admin/competitions/${id}/${action}`).then(unwrap<Competition>),
  rounds: (competitionId: string) =>
    api.get(`/admin/competitions/${competitionId}/rounds`).then(unwrap<Round[]>),
  createRound: (competitionId: string, payload: CreateRoundRequest) =>
    api.post(`/admin/competitions/${competitionId}/rounds`, payload).then(unwrap<Round>),
  updateRound: (id: string, payload: UpdateRoundRequest) =>
    api.patch(`/admin/rounds/${id}`, payload).then(unwrap<Round>),
  roundAction: (action: 'start' | 'pause' | 'resume' | 'end', id: string) =>
    api.post(`/admin/rounds/${id}/${action}`).then(unwrap<Round>),
  uploadTargetImage: (roundId: string, file: File, altText?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (altText) formData.append('alt_text', altText);
    return sendFormData(`/admin/rounds/${roundId}/target-images`, formData);
  },
  targetImages: (roundId: string) =>
    api.get(`/admin/rounds/${roundId}/target-images`).then(unwrap<TargetImage[]>),
  submissions: (roundId: string) =>
    api.get(`/admin/rounds/${roundId}/submissions`).then(unwrap<AdminSubmission[]>),
  archiveCompetition: (id: string) =>
    api.post(`/admin/competitions/${id}/archive`).then(unwrap<Competition>),
  restoreCompetition: (id: string) =>
    api.post(`/admin/competitions/${id}/restore`).then(unwrap<Competition>),
  archiveRound: (id: string) =>
    api.post(`/admin/rounds/${id}/archive`).then(unwrap<Round>),
  restoreRound: (id: string) =>
    api.post(`/admin/rounds/${id}/restore`).then(unwrap<Round>),
};

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg).join(', ');
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the server. Is the backend running?';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export default api;