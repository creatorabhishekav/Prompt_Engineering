import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { resultsApi, getApiErrorMessage, resolveMediaUrl } from '@/lib/api';
import type { ResultItem } from '@/types';

interface MetricCategory {
  key: string;
  label: string;
  score: number;
  max: number;
  color: string;
}

export function ResultPage() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await resultsApi.me();
        setResults(data);
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Loading label="Loading your competition results..." />
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-slate-600">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardBody>
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (results.length === 0) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <Header />
          <Card>
            <CardBody className="py-14 text-center">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"
              >
                <BarChart3 className="h-8 w-8" />
              </motion.div>
              <h2 className="text-xl font-semibold text-slate-900">No submitted rounds yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Complete a challenge round to view your automated AI score breakdown out of 80 points.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/challenge">
                  <Button>Go to Challenges</Button>
                </Link>
                <Link to="/leaderboard">
                  <Button variant="outline">View Leaderboard</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <Header />

        {results.map((res) => {
          const categories: MetricCategory[] = [
            { key: 'semantic', label: 'Overall Visual Similarity', score: res.semantic_similarity ?? res.semantic_score, max: 45, color: 'bg-slate-900' },
            { key: 'composition', label: 'Composition & Layout', score: res.composition_score, max: 12, color: 'bg-slate-800' },
            { key: 'objects', label: 'Objects & Attributes', score: res.objects_score, max: 10, color: 'bg-slate-700' },
            { key: 'color', label: 'Color & Lighting', score: res.color_score, max: 7, color: 'bg-slate-600' },
            { key: 'quality', label: 'Image Quality', score: res.image_quality_score ?? 0, max: 4, color: 'bg-slate-600' },
            { key: 'details', label: 'Fine Details', score: res.fine_details_score ?? res.details_score, max: 2, color: 'bg-slate-500' },
          ];

          const simPct = res.calibrated_similarity_pct !== undefined && res.calibrated_similarity_pct !== null
            ? Number(res.calibrated_similarity_pct)
            : res.clip_similarity !== undefined && res.clip_similarity !== null
            ? (res.clip_similarity > 1 ? Number(res.clip_similarity) : Number(res.clip_similarity) * 100)
            : null;

          return (
            <Card key={res.submission_id} className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {res.competition_title}
                    </span>
                    <CardTitle className="text-xl">{res.round_title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <span>Status:</span>
                    <span className="font-semibold text-slate-900">{res.submission_status}</span>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-8 p-6">
                {/* Images Comparison */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <ImageIcon className="h-4 w-4 text-brand-600" /> Target Image
                    </p>
                    {res.target_image_url ? (
                      <img
                        src={resolveMediaUrl(res.target_image_url) || undefined}
                        alt="Target Image"
                        className="aspect-square w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <Sparkles className="h-4 w-4 text-brand-600" /> Your Generated Image
                    </p>
                    {res.uploaded_image_url ? (
                      <img
                        src={resolveMediaUrl(res.uploaded_image_url) || undefined}
                        alt="Your Generated Image"
                        className="aspect-square w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        No upload
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompts Used */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Step 1: First Prompt</p>
                    <p className="text-sm font-medium text-slate-800">{res.prompt_1 || res.prompt_used || '(Empty prompt)'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-600">Step 2: Follow-up Prompt</p>
                    <p className="text-sm font-medium text-slate-800">{res.prompt_2 || '(No follow-up prompt)'}</p>
                  </div>
                </div>

                {/* Google Gemini Chat Link (if submitted) */}
                {res.gemini_chat_link && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-brand-600" />
                      Google Gemini Chat Link
                    </p>
                    <a
                      href={res.gemini_chat_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline break-all inline-flex items-center gap-1.5"
                    >
                      <span className="truncate max-w-[280px] sm:max-w-[550px]">{res.gemini_chat_link}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}

                {/* Score Section */}
                {res.scoring_status === 'PROCESSING' && (
                  <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-800 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    AI evaluation is in progress...
                  </div>
                )}

                {res.scoring_status === 'FAILED' && (
                  <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    AI evaluation could not be completed.
                  </div>
                )}

                {(res.scoring_status === 'SCORED' || res.total_score > 0) && (
                  <div className="space-y-6">
                    {/* Total Score Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-900 p-6 text-white shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Automated Vision Scoring</span>
                          <span aria-hidden="true">·</span>
                          <span>Stage: {res.evaluation_stage || 'FINAL'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{res.evaluation_method || 'CLIP ViT-B/32'}</span>
                        </div>
                        <h3 className="mt-1 text-2xl font-bold tracking-tight text-white">Evaluation Complete</h3>
                        {simPct !== null && (
                          <div className="mt-2 font-mono text-xs text-slate-300 tabular-nums">
                            Calibrated Visual Similarity: {simPct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 rounded-xl bg-white/10 px-5 py-3 border border-white/10">
                        <span className="font-mono text-3xl font-black text-white tabular-nums">{res.total_score}</span>
                        <span className="font-mono text-sm text-slate-400 font-bold">/ 80</span>
                      </div>
                    </div>

                    {/* Breakdown Progress Bars */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Score Breakdown (/80)
                      </h4>

                      {categories.map((cat) => {
                        const pct = Math.min(100, Math.max(0, (cat.score / cat.max) * 100));
                        return (
                          <div key={cat.key} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{cat.label}</span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {Number(cat.score).toFixed(1)} / {cat.max}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${cat.color}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        <div className="flex justify-center gap-4">
          <Link to="/leaderboard">
            <Button size="lg">
              <Trophy className="h-4 w-4" /> View Leaderboard
            </Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">My Submissions</h1>
      <p className="mt-1 text-xs sm:text-sm text-slate-500">Reverse Prompt Engineering Challenge — Submission History & Vision Scores</p>
    </div>
  );
}