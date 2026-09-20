import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  ImageIcon,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { resultsApi, getApiErrorMessage } from '@/lib/api';
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
            { key: 'semantic', label: 'Semantic / Overall Similarity', score: res.semantic_score, max: 32, color: 'from-brand-500 to-indigo-600' },
            { key: 'composition', label: 'Composition / Layout', score: res.composition_score, max: 20, color: 'from-blue-500 to-cyan-500' },
            { key: 'objects', label: 'Objects / Attributes', score: res.objects_score, max: 16, color: 'from-emerald-500 to-teal-500' },
            { key: 'color', label: 'Color / Lighting', score: res.color_score, max: 8, color: 'from-amber-500 to-orange-500' },
            { key: 'details', label: 'Fine Details', score: res.details_score, max: 4, color: 'from-purple-500 to-pink-500' },
          ];

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
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      Status: {res.submission_status}
                    </span>
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
                        src={res.target_image_url}
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
                      <Sparkles className="h-4 w-4 text-indigo-600" /> Your Generated Image
                    </p>
                    {res.uploaded_image_url ? (
                      <img
                        src={res.uploaded_image_url}
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

                {/* Prompt Used */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Your Prompt</p>
                  <p className="text-sm font-medium text-slate-800">{res.prompt_used || '(Empty prompt)'}</p>
                </div>

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
                    {/* Total Score Badge & CLIP Similarity */}
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-700 p-6 text-white shadow-md">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                          Automated AI Score
                        </span>
                        <h3 className="text-3xl font-black tracking-tight">AI Evaluation Complete</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {res.clip_similarity !== undefined && res.clip_similarity !== null && (
                            <span className="rounded-md bg-white/20 px-2.5 py-1 font-semibold backdrop-blur-sm">
                              Visual Similarity: {res.clip_similarity.toFixed(1)}%
                            </span>
                          )}
                          <span className="rounded-md bg-white/10 px-2.5 py-1 text-white/80">
                            Engine: {res.evaluation_method || 'CLIP (openai/clip-vit-base-patch32) + Computer Vision'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 rounded-2xl bg-white/10 px-6 py-3 backdrop-blur-sm ring-1 ring-white/20">
                        <span className="text-4xl font-extrabold">{res.total_score}</span>
                        <span className="text-lg text-white/80 font-bold">/ 80</span>
                      </div>
                    </div>

                    {/* Breakdown Progress Bars */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Score Breakdown (/80)
                      </h4>

                      {categories.map((cat) => {
                        const pct = Math.min(100, Math.max(0, (cat.score / cat.max) * 100));
                        return (
                          <div key={cat.key} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold text-slate-700">{cat.label}</span>
                              <span className="font-bold text-slate-900">
                                {cat.score} <span className="text-slate-400 font-normal">/ {cat.max}</span>
                              </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${cat.color} transition-all duration-500`}
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
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">MY SUBMISSIONS & RESULTS</h1>
      <p className="mt-1 text-slate-500">Reverse Prompt Engineering Challenge — Submission History</p>
    </div>
  );
}