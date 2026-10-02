import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, CheckCircle2 } from 'lucide-react';
import type { ScoreBreakdown } from '@/types';

interface ScoreDisplayProps {
  score: number;
  maxScore?: number;
  breakdown?: ScoreBreakdown | null;
  stageName?: string;
  subtitle?: string;
  isOfficialLeaderboardScore?: boolean;
}

export function ScoreDisplay({
  score,
  maxScore = 80,
  breakdown,
  stageName = 'AI EVALUATION',
  subtitle = 'Automated Multi-Vector Computer Vision Scoring',
  isOfficialLeaderboardScore = false,
}: ScoreDisplayProps) {
  // Animated score counter from 0 to actual score
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200; // 1.2s smooth score roll
    const target = Number(score) || 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Number((ease * target).toFixed(1)));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setAnimatedScore(target);
      }
    };

    window.requestAnimationFrame(step);
  }, [score]);

  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  const strokeDashoffset = 283 - (283 * percentage) / 100;

  const simScore = breakdown?.semantic_similarity ?? breakdown?.semantic_score ?? 0;
  const compScore = breakdown?.composition_score ?? 0;
  const objScore = breakdown?.objects_score ?? 0;
  const colScore = breakdown?.color_score ?? 0;
  const qualScore = breakdown?.image_quality_score ?? 0;
  const detScore = breakdown?.fine_details_score ?? breakdown?.details_score ?? 0;

  const metrics = [
    { label: 'VISUAL SIMILARITY', score: simScore, max: 45, color: 'bg-indigo-500', barPercent: (simScore / 45) * 100 },
    { label: 'COMPOSITION', score: compScore, max: 12, color: 'bg-cyan-500', barPercent: (compScore / 12) * 100 },
    { label: 'OBJECTS', score: objScore, max: 10, color: 'bg-emerald-500', barPercent: (objScore / 10) * 100 },
    { label: 'COLOR & LIGHTING', score: colScore, max: 7, color: 'bg-amber-500', barPercent: (colScore / 7) * 100 },
    { label: 'QUALITY', score: qualScore, max: 4, color: 'bg-pink-500', barPercent: (qualScore / 4) * 100 },
    { label: 'DETAILS', score: detScore, max: 2, color: 'bg-purple-500', barPercent: (detScore / 2) * 100 },
  ];

  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${
        isOfficialLeaderboardScore
          ? 'border-emerald-500/40 bg-slate-900 text-white shadow-lg'
          : 'border-slate-800 bg-slate-900 text-white shadow-lg'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              isOfficialLeaderboardScore
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'bg-brand-500/20 border-brand-500/30 text-brand-400'
            }`}
          >
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-mono text-xs font-bold tracking-wider text-white uppercase">
              {stageName}
            </h4>
            <p className="text-[10px] text-zinc-400">{subtitle}</p>
          </div>
        </div>

        {isOfficialLeaderboardScore ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> OFFICIAL LEADERBOARD
          </span>
        ) : (
          <span className="rounded-full bg-brand-500/15 border border-brand-500/30 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-brand-300">
            PRACTICE STAGE
          </span>
        )}
      </div>

      {/* Main Score Ring & Breakdown Grid */}
      <div className="grid gap-6 sm:grid-cols-12 items-center py-5">
        {/* Animated Score Gauge (Col 5) */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex h-32 w-32 items-center justify-center">
            {/* SVG Circular Progress */}
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="stroke-slate-800 fill-none"
                strokeWidth="7"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                className={`fill-none ${
                  isOfficialLeaderboardScore ? 'stroke-emerald-400' : 'stroke-brand-400'
                }`}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="283"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>

            {/* Score Text in Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-3xl font-black text-white tracking-tight">
                {animatedScore}
              </span>
              <span className="font-mono text-[11px] font-bold text-zinc-400">
                / {maxScore}
              </span>
            </div>
          </div>
          <span className="mt-2 text-center font-mono text-[10px] tracking-wider text-zinc-400 uppercase">
            Aggregate AI Score
          </span>
        </div>

        {/* 6 Sub-Dimensions Breakdown (Col 7) */}
        <div className="sm:col-span-7 space-y-2.5">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400">{m.label}</span>
                <span className="font-bold text-zinc-200">
                  {m.score} <span className="text-zinc-500 font-normal">/ {m.max}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className={`h-full rounded-full ${m.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.max(m.barPercent, 0), 100)}%` }}
                  transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Footnote */}
      {breakdown && (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[10px] font-mono text-zinc-400">
          <span>Engine: {breakdown.evaluation_method || 'CLIP ViT-B/32 Neural Latent'}</span>
          {breakdown.clip_similarity && (
            <span>Raw Cosine: {breakdown.clip_similarity}</span>
          )}
        </div>
      )}
    </div>
  );
}
