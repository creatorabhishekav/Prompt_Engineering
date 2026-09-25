import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Lock,
  Play,
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

  const [uploadingFirst, setUploadingFirst] = useState(false);
  const [uploadingFinal, setUploadingFinal] = useState(false);
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

    // Synchronize prompt text from server response (authoritative)
    // If backend returns prompt_1 or prompt_2, ensure local state matches
    if (data.prompt_1 !== undefined && data.prompt_1 !== null) {
      setPrompt1(data.prompt_1);
    } else if (data.prompt) {
      setPrompt1(data.prompt);
    }

    if (data.prompt_2 !== undefined && data.prompt_2 !== null) {
      setPrompt2(data.prompt_2);
    }

    if (next === 'in_progress') {
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

  // Poll server state periodically without running a countdown timer
  useEffect(() => {
    if (phase !== 'playing') return;
    const poll = setInterval(() => void resync(), 10000);
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

  const handleFirstFileUpload = async (file: File) => {
    if (!challenge || challenge.status !== 'in_progress') return;
    setUploadingFirst(true);
    setError(null);
    try {
      const data = await challengeApi.uploadFirstImage(challenge.id, file);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploadingFirst(false);
    }
  };

  const handleFinalFileUpload = async (file: File) => {
    if (!challenge || challenge.status !== 'in_progress') return;
    setUploadingFinal(true);
    setError(null);
    try {
      const data = await challengeApi.uploadFinalImage(challenge.id, file);
      applyChallenge(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploadingFinal(false);
    }
  };

  const submitFinal = async () => {
    if (!challenge || challenge.status !== 'in_progress') return;
    const p1Submitted = Boolean(challenge.prompt_1 || (challenge.prompt && !challenge.prompt_2));
    const firstEvalDone = Boolean(challenge.first_image_url || challenge.first_score !== undefined);
    const p2Submitted = Boolean(challenge.prompt_2);
    const finalImageUploaded = Boolean(challenge.final_image_url || challenge.uploaded_image_url);

    if (!p1Submitted) {
      setError('You must submit First Prompt before submitting final challenge.');
      return;
    }
    if (!firstEvalDone) {
      setError('You must upload First Image & complete Stage 1 ML Evaluation before submitting final challenge.');
      return;
    }
    if (!p2Submitted) {
      setError('You must submit Follow-up Prompt before submitting final challenge.');
      return;
    }
    if (!finalImageUploaded) {
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
  const firstImageUploaded = Boolean(challenge?.first_image_url);
  const firstScoreDone = challenge?.first_score !== undefined && challenge?.first_score !== null;
  const p2Unlocked = p1Submitted && (firstImageUploaded || firstScoreDone);
  const p2Submitted = Boolean(challenge?.prompt_2);
  const finalImageUploaded = Boolean(challenge?.final_image_url || challenge?.uploaded_image_url);
  const finalScoreDone = challenge?.final_score !== undefined && challenge?.final_score !== null;

  // playing | locked
  return (
    <PageTransition>
      <div className="space-y-6">
        <Header />

        {/* Challenge Status Header (No Countdown Timer) */}
        <Card className="overflow-hidden">
          <div
            className={`h-1.5 ${phase === 'playing' ? 'bg-gradient-to-r from-brand-500 to-accent-600' : 'bg-emerald-500'}`}
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {activeRound?.competition_title}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">
                Round {activeRound?.round_number}: {activeRound?.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColor(challenge?.status ?? '')}`}>
                {challenge?.status?.replace('_', ' ') ?? ''}
              </span>
              {phase === 'locked' && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <Lock className="h-3.5 w-3.5" /> Locked
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        {error && <ErrorBanner message={error} />}

        {/* Gemini & Challenge Instructions Banner */}
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-indigo-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-brand-900">
                Reverse Prompt Engineering: Two-Stage Competition Flow
              </h3>
              <p className="text-sm text-brand-700">
                Submit Prompt 1 $\rightarrow$ Upload First Image $\rightarrow$ See Practice Score (/80) $\rightarrow$ Submit Follow-up Prompt 2 $\rightarrow$ Upload Final Image $\rightarrow$ Final Leaderboard Score (/80).
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

        {/* Target Image & Sequential Challenge Steps Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Target image */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-brand-600" />
                Target Image
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
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
              <p className="text-xs text-slate-500">
                Write Prompt 1, upload your first generated image to receive practice ML feedback, then refine with Follow-up Prompt 2 for your final leaderboard attempt!
              </p>
            </CardBody>
          </Card>

          {/* STAGE 1: FIRST ATTEMPT */}
          <div className="space-y-6">
            {/* STEP 1 — FIRST PROMPT */}
            <Card className={p1Submitted ? 'border-emerald-200 bg-emerald-50/20' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
                    STEP 1 — FIRST PROMPT
                  </span>
                  {p1Submitted && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Prompt 1 Submitted & Locked
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
                  rows={4}
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

            {/* FIRST GENERATED IMAGE & STAGE 1 ML EVALUATION */}
            <Card className={!p1Submitted ? 'opacity-60 pointer-events-none' : firstScoreDone ? 'border-emerald-200 bg-emerald-50/20' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-brand-600" />
                    FIRST GENERATED IMAGE
                  </span>
                  {firstScoreDone && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Stage 1 Evaluated
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-xs text-slate-500">
                  Upload the image generated from Prompt 1 to receive your Practice / Intermediate ML Evaluation.
                </p>

                {uploadingFirst && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-xl bg-brand-50/50 border border-brand-100">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-xs font-semibold text-brand-800">Evaluating image...</p>
                    <p className="text-[11px] text-slate-500">Calculating semantic, composition, objects, color, and detail scores.</p>
                  </div>
                )}

                {!uploadingFirst && challenge?.first_image_url ? (
                  <div className="space-y-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img
                        src={resolveMediaUrl(challenge.first_image_url) || undefined}
                        alt="First attempt generated image"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute top-2 right-2 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                        First Image
                      </div>
                    </div>

                    {firstScoreDone && (
                      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Practice / Intermediate Score</p>
                            <p className="text-xs text-slate-500">Intermediate score — not on leaderboard</p>
                          </div>
                          <div className="text-2xl font-black text-brand-900">
                            {challenge.first_score} <span className="text-xs text-brand-600 font-bold">/ 80</span>
                          </div>
                        </div>
                        {challenge.first_score_breakdown && (
                          <div className="grid grid-cols-5 gap-1 pt-2 border-t border-brand-200 text-center text-[10px]">
                            <div><span className="text-slate-400 block">Sem</span><strong className="text-slate-700">{challenge.first_score_breakdown.semantic_score}/32</strong></div>
                            <div><span className="text-slate-400 block">Comp</span><strong className="text-slate-700">{challenge.first_score_breakdown.composition_score}/20</strong></div>
                            <div><span className="text-slate-400 block">Obj</span><strong className="text-slate-700">{challenge.first_score_breakdown.objects_score}/16</strong></div>
                            <div><span className="text-slate-400 block">Col</span><strong className="text-slate-700">{challenge.first_score_breakdown.color_score}/8</strong></div>
                            <div><span className="text-slate-400 block">Det</span><strong className="text-slate-700">{challenge.first_score_breakdown.details_score}/4</strong></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  !uploadingFirst && (
                    <div>
                      <label
                        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                          !p1Submitted || phase === 'locked'
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'cursor-pointer border-brand-300 bg-brand-50/40 text-brand-700 hover:border-brand-500 hover:bg-brand-50'
                        }`}
                      >
                        <Upload className="h-6 w-6 text-brand-500" />
                        <div>
                          <p className="font-semibold text-sm">Click to upload First Generated Image</p>
                          <p className="mt-1 text-xs text-slate-500">Triggers Stage 1 ML Evaluation & Unlocks Step 2</p>
                        </div>
                        {phase === 'playing' && p1Submitted && (
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            disabled={uploadingFirst}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleFirstFileUpload(f);
                            }}
                          />
                        )}
                      </label>
                    </div>
                  )
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* STAGE 2: FINAL ATTEMPT (ALWAYS DISTINCT AND SEPARATE) */}
        <div className="grid gap-6 lg:grid-cols-2 pt-6 border-t border-slate-200">
          {/* STEP 2 — FOLLOW-UP PROMPT */}
          <Card className={!p2Unlocked ? 'opacity-60 pointer-events-none' : p2Submitted ? 'border-emerald-200 bg-emerald-50/20' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
                  STEP 2 — FOLLOW-UP PROMPT
                </span>
                {p2Submitted && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Prompt 2 Submitted & Locked
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-slate-500">
                Review your Stage 1 feedback, then write one follow-up prompt to refine details and achieve maximum visual similarity.
              </p>
              <textarea
                value={prompt2}
                onChange={(e) => setPrompt2(e.target.value)}
                disabled={!p2Unlocked || p2Submitted || phase === 'locked'}
                readOnly={!p2Unlocked || p2Submitted || phase === 'locked'}
                rows={4}
                placeholder={p2Unlocked ? "Enter your follow-up prompt to refine the image..." : "Complete Stage 1 ML Evaluation to unlock Step 2"}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-70 disabled:bg-slate-50"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{prompt2.length} / 4000 characters</span>
                {p2Unlocked && !p2Submitted && phase === 'playing' && (
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

          {/* FINAL GENERATED IMAGE & STAGE 2 ML EVALUATION */}
          <Card className={!p2Submitted ? 'opacity-60 pointer-events-none' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-brand-600" />
                FINAL GENERATED IMAGE
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-slate-500">
                Upload the NEW image generated from Prompt 2. This image gets evaluated for your Official Leaderboard Score.
              </p>

              {uploadingFinal && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-xs font-semibold text-indigo-900">Evaluating image...</p>
                  <p className="text-[11px] text-slate-500">Calculating official competition score out of 80 points.</p>
                </div>
              )}

              {!uploadingFinal && finalImageUploaded ? (
                <div className="space-y-3">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
                    <img
                      src={resolveMediaUrl(challenge?.final_image_url || challenge?.uploaded_image_url) || undefined}
                      alt="Your uploaded final generated image"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                      Final Image
                    </div>
                  </div>

                  {finalScoreDone && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Official Leaderboard Score</p>
                          <p className="text-xs text-emerald-600 font-medium">Used for leaderboard ranking</p>
                        </div>
                        <div className="text-2xl font-black text-emerald-900">
                          {challenge.final_score} <span className="text-xs text-emerald-700 font-bold">/ 80</span>
                        </div>
                      </div>
                      {challenge.final_score_breakdown && (
                        <div className="grid grid-cols-5 gap-1 pt-2 border-t border-emerald-200 text-center text-[10px]">
                          <div><span className="text-slate-500 block">Sem</span><strong className="text-slate-800">{challenge.final_score_breakdown.semantic_score}/32</strong></div>
                          <div><span className="text-slate-500 block">Comp</span><strong className="text-slate-800">{challenge.final_score_breakdown.composition_score}/20</strong></div>
                          <div><span className="text-slate-500 block">Obj</span><strong className="text-slate-800">{challenge.final_score_breakdown.objects_score}/16</strong></div>
                          <div><span className="text-slate-500 block">Col</span><strong className="text-slate-800">{challenge.final_score_breakdown.color_score}/8</strong></div>
                          <div><span className="text-slate-500 block">Det</span><strong className="text-slate-800">{challenge.final_score_breakdown.details_score}/4</strong></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                !uploadingFinal && (
                  <div>
                    <label
                      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                        !p2Submitted || phase === 'locked'
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : 'cursor-pointer border-brand-300 bg-brand-50/40 text-brand-700 hover:border-brand-500 hover:bg-brand-50'
                      }`}
                    >
                      <Upload className="h-6 w-6 text-brand-500" />
                      <div>
                        <p className="font-semibold text-sm">Click to upload Final Generated Image</p>
                        <p className="mt-1 text-xs text-slate-500">Runs Stage 2 ML Evaluation for your Leaderboard Score</p>
                      </div>
                      {phase === 'playing' && p2Submitted && (
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          disabled={uploadingFinal}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleFinalFileUpload(f);
                          }}
                        />
                      )}
                    </label>
                  </div>
                )
              )}

              {phase === 'playing' && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <Button
                    fullWidth
                    loading={busy}
                    disabled={!p1Submitted || !firstScoreDone || !p2Submitted || !finalImageUploaded || busy}
                    onClick={() => void submitFinal()}
                  >
                    <Send className="h-4 w-4" />
                    Submit Final Challenge
                  </Button>
                  <p className="text-center text-xs text-slate-400">
                    Only your Stage 2 Final Score is recorded on the Leaderboard.
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
                      View Both Stage 1 & Stage 2 Results
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