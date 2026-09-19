import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AiModeBadge } from '@/components/AiModeBadge';
import { getApiErrorMessage, aiApi } from '@/lib/api';
import type { GeneratedImageResponse } from '@/types';

const samplePrompts = [
  'A cozy reading nook by a rainy window, warm lamp light, coffee mug, photorealistic',
  'A neon-lit cyberpunk city street at night with holographic signs, cinematic wide shot',
  'An astronaut watering a tiny garden on Mars, soft light, whimsical illustration',
  'A majestic white tiger walking through a misty bamboo forest, golden hour',
];

export function PracticePage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<GeneratedImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async (text?: string) => {
    const value = (text ?? prompt).trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await aiApi.generate(value);
      setResult(res);
      setPrompt(value);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Practice mode
            </h1>
            <p className="mt-1 text-slate-500">
              Experiment with prompts without the pressure of scoring.
            </p>
          </div>
          <AiModeBadge />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Prompt input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-brand-600" />
                Your prompt
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void generate();
                }}
                className="space-y-4"
              >
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-slate-700"
                >
                  Describe the image you want to create
                </label>
                <textarea
                  id="prompt"
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A minimalist studio photo of a single yellow umbrella, soft shadows, clean background"
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <Button type="submit" fullWidth size="lg" loading={busy}>
                  {!busy && <Sparkles className="h-4 w-4" />}
                  Generate with AI
                </Button>
              </form>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Or try one:
                </p>
                <div className="flex flex-wrap gap-2">
                  {samplePrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => void generate(p)}
                      disabled={busy}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                    >
                      {p.length > 42 ? `${p.slice(0, 42)}...` : p}
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-brand-600" />
                Generated result
              </CardTitle>
            </CardHeader>
            <CardBody>
              {result ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img
                      src={result.url}
                      alt={result.prompt}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur">
                      provider: {result.provider}
                      {result.demo ? ' · demo' : ''}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Prompt used
                    </p>
                    <p className="text-sm text-slate-700">{result.prompt}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => void generate()}>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate variation
                  </Button>
                </motion.div>
              ) : busy ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                  <p className="text-sm">Generating...</p>
                </div>
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <Sparkles className="h-10 w-10 text-slate-300" />
                  <p className="max-w-xs text-sm text-slate-500">
                    Your generated image will appear here. Craft a detailed
                    prompt and click <span className="font-medium">Generate</span>.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Practice is powered by the <strong>demo AI provider</strong> — no
            paid API key is required. Images are deterministic placeholders so
            you can test the full flow locally. In later phases, the real image
            generation and scoring engine replace this provider automatically.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}