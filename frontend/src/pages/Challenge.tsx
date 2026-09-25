import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Send,
  Trophy,
  Upload,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { challengeApi, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import type { ActiveRound, ChallengeStatus } from '@/types';

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'in_progress':
      return 'bg-brand-100 text-brand-700';
    case 'submitted':
    case 'scored':
      return 'bg-emerald-100 text-emerald-700';
    case 'rejected':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

type Phase = 'loading' | 'lobby' | 'playing' | 'locked' | 'error' | 'empty';

export function ChallengePage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [rounds, setRounds] = useState<ActiveRound[]>([]);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [challenge, setChallenge] = useState<ChallengeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prompt1, setPrompt1] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [submittingP1, setSubmittingP1] = useState(false);
  const [submittingP2, setSubmittingP2] = useState(false);

  const [remaining, setRemaining] = useState(0);
  const lastSyncRef = useRef({ remaining: 0, at: 0 });

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRounds = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const list = await challengeApi.activeRounds();
      setRounds(list);
      setPhase(list.length === 0 ? 'empty' : 'lobby');
    } catch (e) {
      setError(getApiErrorMessage(e));
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  const applyChallenge = useCallback((data: ChallengeStatus) => {
    setChallenge(data);
    const next = data.status;
    setPrompt1(data.prompt_1 || data.prompt || '');
    setPrompt2(data.prompt_2 || '');
    if (next === 'in_progress') {
      setRemaining(data.remaining_seconds);
      lastSyncRef.current = { remaining: data.remaining_seconds, at: Date.now() };
      setPhase('playing');
    } else {
      setPhase('locked');
    }
  }, []);

  const startRound = async (round: ActiveRound) => {
    setBusy(true);
    setError(null);
    try {
      const data = await challengeApi.start(round.id);
      setActiveRound({ ...round, target_image_url: data.target_image_url ?? round.target_image_url });
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resync = useCallback(async () => {
    if (!activeRound) return;
    try {
      const data = await challengeApi.status(activeRound.id);
      applyChallenge(data);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg.toLowerCase().includes('not open')) {
        setPhase('empty');
      } else {
        setError(msg);
      }
    }
  }, [activeRound, applyChallenge]);

  // Overall round duration timer (not AI processing timer)
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = setInterval(() => {
      const sync = lastSyncRef.current;
      const elapsed = Math.floor((Date.now() - sync.at) / 1000);
      const next = Math.max(0, sync.remaining - elapsed);
      setRemaining(next);
      if (next === 0) {
        lastSyncRef.current = { remaining: 0, at: Date.now() };
        void resync();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, resync]);

  // Poll server state
  useEffect(() => {
    if (phase !== 'playing') return;
    const poll = setInterval(() => void resync(), 5000);
    return () => clearInterval(poll);
  }, [phase, resync]);

  const handlePrompt1Submit = async () => {
    if (!challenge || !prompt1.trim()) {
      setError('Please enter a valid First Prompt before submitting.');
      return;
    }
    setSubmittingP1(true);
    setError(null);
    try {
      const data = await challengeApi.submitPrompt1(challenge.id, prompt1);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingP1(false);
    }
  };

  const handlePrompt2Submit = async () => {
    if (!challenge || !prompt2.trim()) {
      setError('Please enter a valid Follow-up Prompt before submitting.');
      return;
    }
    setSubmittingP2(true);
    setError(null);
    try {
      const data = await challengeApi.submitPrompt2(challenge.id, prompt2);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmittingP2(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!challenge || challenge.status !== 'in_progress') return;
    setUploading(true);
    setError(null);
    try {
      const data = await challengeApi.uploadImage(challenge.id, file);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submitFinal = async () => {
    if (!challenge || challenge.status !== 'in_progress') return;
    const p1Submitted = Boolean(challenge.prompt_1 || (challenge.prompt && !challenge.prompt_2));
    const p2Submitted = Boolean(challenge.prompt_2);
    if (!p1Submitted) {
      setError('You must submit First Prompt before submitting final challenge.');
      return;
    }
    if (!p2Submitted) {
      setError('You must submit Follow-up Prompt before submitting final challenge.');
      return;
    }
    if (!challenge.uploaded_image_url) {
      setError('Please upload your final generated image before submitting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await challengeApi.submit(challenge.id);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Loading label="Looking for live rounds..." />
        </div>
      </PageTransition>
    );
  }

  if (phase === 'error') {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-slate-600">{error ?? 'Something went wrong.'}</p>
              <Button onClick={() => void loadRounds()}>Try again</Button>
            </CardBody>
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (phase === 'empty') {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-16 text-center">
              <Trophy className="h-12 w-12 text-brand-400" />
              <h2 className="text-xl font-bold text-slate-900">No live rounds right now</h2>
              <p className="max-w-md text-sm text-slate-500">
                An admin must start a round before you can play. Check back soon.
              </p>
              <Button variant="outline" onClick={() => void loadRounds()}>
                Refresh
              </Button>
            </CardBody>
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (phase === 'lobby') {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">Pick a live round</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rounds.map((round, i) => (
                <motion.div
                  key={round.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card hover className="flex h-full flex-col">
                    <CardBody className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {round.competition_title}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Round {round.round_number}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{round.title}</h3>
                      {round.description && (
                        <p className="text-sm text-slate-500">{round.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="h-4 w-4 text-brand-500" />
                        {formatClock(round.time_limit_seconds)} limit
                      </div>
                      {!round.target_image_url && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          No target image uploaded for this round yet.
                        </div>
                      )}
                    </CardBody>
                    <CardFooter>
                      <Button
                        fullWidth
                        disabled={!round.target_image_url || busy}
                        loading={busy}
                        onClick={() => void startRound(round)}
                      >
                        <Play className="h-4 w-4" />
                        Start challenge
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
          {error && <ErrorBanner message={error} />}
        </div>
      </PageTransition>
    );
  }

  const p1Submitted = Boolean(challenge?.prompt_1 || (challenge?.prompt && !challenge?.prompt_2));
  const p2Submitted = Boolean(challenge?.prompt_2);

  // playing | locked
  return (
    <PageTransition>
      <div className="space-y-6">
        <Header />

        {/* Timer + status bar */}
        <Card className="overflow-hidden">
          <div
            className={`h-1.5 ${phase === 'playing' ? 'bg-gradient-to-r from-brand-500 to-accent-600' : 'bg-emerald-500'}`}
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {activeRound?.competition_title}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">
                Round {activeRound?.round_number}: {activeRound?.title}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor(challenge?.status ?? '')}`}>
                  {challenge?.status?.replace('_', ' ') ?? ''}
                </span>
                {phase === 'locked' && (
                  <span className="text-xs text-slate-400">Submission locked</span>
                )}
              </div>
            </div>
            {phase === 'playing' && (
              <div
                className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-2xl font-extrabold tabular-nums ${
                  remaining <= 30 ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'
                }`}
              >
                <Clock className="h-6 w-6" />
                {formatClock(remaining)}
              </div>
            )}
            {phase === 'locked' && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-5 py-3 font-bold text-emerald-700">
                <Lock className="h-5 w-5" />
                Submission locked
              </div>
            )}
          </CardBody>
        </Card>

        {error && <ErrorBanner message={error} />}

        {/* Gemini Instructions Banner */}
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-indigo-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-brand-900">
                Two-Prompt Flow: Step 1 First Prompt &nbsp;➔&nbsp; Step 2 Follow-up Prompt &nbsp;➔&nbsp; Step 3 Upload Final Image
              </h3>
              <p className="text-sm text-brand-700">
                Submit Prompt 1, generate in Gemini, submit Prompt 2 to refine, then upload the image generated from Prompt 2.
              </p>
            </div>
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Open Gemini <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Target Image + Prompt 1 + Prompt 2 + Final Upload Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Target image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-brand-600" />
                Target Image
              </CardTitle>
            </CardHeader>
            <CardBody>
              {activeRound?.target_image_url ? (
                <img
                  src={resolveMediaUrl(activeRound.target_image_url) || undefined}
                  alt="Target image to describe"
                  className="aspect-square w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                  No target image
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Write two prompts (initial + follow-up) to reproduce this target image as closely as possible.
              </p>
            </CardBody>
          </Card>

          {/* Step 1: First Prompt */}
          <Card className={p1Submitted ? 'border-emerald-200 bg-emerald-50/20' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
                  STEP 1 — FIRST PROMPT
                </span>
                {p1Submitted && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> First Prompt Submitted
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <textarea
                value={prompt1}
                onChange={(e) => setPrompt1(e.target.value)}
                disabled={p1Submitted || phase === 'locked'}
                readOnly={p1Submitted || phase === 'locked'}
                rows={5}
                placeholder="Enter your initial prompt describing the target image..."
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-70 disabled:bg-slate-50"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{prompt1.length} / 4000 characters</span>
                {!p1Submitted && phase === 'playing' && (
                  <Button
                    size="sm"
                    loading={submittingP1}
                    disabled={!prompt1.trim() || submittingP1}
                    onClick={() => void handlePrompt1Submit()}
                  >
                    Submit First Prompt
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Step 2: Follow-up Prompt */}
          <Card className={!p1Submitted ? 'opacity-60 pointer-events-none' : p2Submitted ? 'border-emerald-200 bg-emerald-50/20' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
                  STEP 2 — FOLLOW-UP PROMPT
                </span>
                {p2Submitted && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Follow-up Prompt Submitted
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-slate-500">
                Review the AI response from your first prompt, then write one follow-up prompt to refine or improve the result.
              </p>
              <textarea
                value={prompt2}
                onChange={(e) => setPrompt2(e.target.value)}
                disabled={!p1Submitted || p2Submitted || phase === 'locked'}
                readOnly={!p1Submitted || p2Submitted || phase === 'locked'}
                rows={5}
                placeholder={p1Submitted ? "Enter your follow-up prompt to refine the AI image..." : "Submit First Prompt to unlock Step 2"}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-70 disabled:bg-slate-50"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{prompt2.length} / 4000 characters</span>
                {p1Submitted && !p2Submitted && phase === 'playing' && (
                  <Button
                    size="sm"
                    loading={submittingP2}
                    disabled={!prompt2.trim() || submittingP2}
                    onClick={() => void handlePrompt2Submit()}
                  >
                    Submit Follow-up Prompt
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Final Image Upload & Submission */}
          <Card className={!p2Submitted ? 'opacity-60 pointer-events-none' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-brand-600" />
                Final Image Upload & Evaluation
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-slate-500">
                Upload the image generated from your second/follow-up prompt. Only the final image will be evaluated.
              </p>
              {challenge?.uploaded_image_url ? (
                <div className="space-y-3">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
                    <img
                      src={resolveMediaUrl(challenge.uploaded_image_url) || undefined}
                      alt="Your uploaded final generated image"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                      Final Image Uploaded
                    </div>
                  </div>
                  {phase === 'playing' && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                      Replace final image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleFileUpload(f);
                        }}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div>
                  <label
                    className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                      !p2Submitted || phase === 'locked'
                        ? 'border-slate-200 bg-slate-50 text-slate-400'
                        : 'cursor-pointer border-brand-300 bg-brand-50/40 text-brand-700 hover:border-brand-500 hover:bg-brand-50'
                    }`}
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    ) : (
                      <Upload className="h-8 w-8 text-brand-500" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">
                        {uploading ? 'Uploading image...' : 'Click to select final generated image'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">PNG, JPG, JPEG or WEBP (max 5MB)</p>
                    </div>
                    {phase === 'playing' && p2Submitted && (
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        disabled={uploading}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleFileUpload(f);
                        }}
                      />
                    )}
                  </label>
                </div>
              )}

              {phase === 'playing' && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <Button
                    fullWidth
                    loading={busy}
                    disabled={!p1Submitted || !p2Submitted || !challenge?.uploaded_image_url || busy}
                    onClick={() => void submitFinal()}
                  >
                    <Send className="h-4 w-4" />
                    Submit final challenge
                  </Button>
                  <p className="text-center text-xs text-slate-400">
                    Only the final image generated after the second prompt will be evaluated.
                  </p>
                </div>
              )}

              {phase === 'locked' && (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-800 font-semibold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    Submitted & Evaluated
                  </div>
                  <Link to="/result">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      View AI Score /80 Result
                    </Button>
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">PROMPT ENGINEERING</h1>
        <p className="mt-1 text-slate-500">Reverse Prompt Engineering Challenge</p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}