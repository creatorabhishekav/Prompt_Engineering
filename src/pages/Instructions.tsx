import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Keyboard,
  Lightbulb,
  Medal,
  Play,
  Rocket,
  Sparkles,
  Trophy,
  Upload,
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const steps = [
  { icon: <ImageIcon className="h-5 w-5" />, title: '1. Target Image', description: 'Inspect the provided target image carefully.' },
  { icon: <Keyboard className="h-5 w-5" />, title: '2. Write Prompt', description: 'Craft ONE detailed prompt to recreate the image.' },
  { icon: <ExternalLink className="h-5 w-5" />, title: '3. Open Gemini', description: 'Open your own Gemini account externally.' },
  { icon: <Sparkles className="h-5 w-5" />, title: '4. Generate Image', description: 'Paste your prompt into Gemini to generate the image.' },
  { icon: <Download className="h-5 w-5" />, title: '5. Download Image', description: 'Download the generated image file to your device.' },
  { icon: <Upload className="h-5 w-5" />, title: '6. Upload Image', description: 'Return to this site and upload your generated image.' },
  { icon: <Play className="h-5 w-5" />, title: '7. Submit Challenge', description: 'Submit before the server timer expires.' },
  { icon: <Brain className="h-5 w-5" />, title: '8. AI Evaluation', description: 'The website automatically scores your submission.' },
  { icon: <Medal className="h-5 w-5" />, title: '9. AI Score /80', description: 'Receive your score breakdown out of 80 max points.' },
  { icon: <Trophy className="h-5 w-5" />, title: '10. Leaderboard', description: 'Rank against other participants on the leaderboard.' },
];

const rules = [
  'One final submission per round.',
  'Timer is server-authoritative; browser refreshes do NOT reset the clock.',
  'Supported formats: PNG, JPG, JPEG, WEBP (max 5MB).',
  'Generate images using your own external Gemini account.',
  'AI score is calculated out of 80 points by the backend evaluator.',
  'Teacher / judge offline 20 marks are added separately offline.',
];

export function InstructionsPage() {
  return (
    <PageTransition>
      <div className="space-y-12">
        {/* Hero */}
        <section className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50 px-6 py-12 sm:px-12 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl"
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                <Brain className="h-3.5 w-3.5" />
                PROMPT ENGINEERING
              </span>
              <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
                Reverse Prompt Engineering Challenge
              </span>
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Can you match <span className="gradient-text">that image</span>?
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              You are shown an AI-generated image. Your goal is to write a prompt, generate the image using your <strong>own Gemini account</strong>, upload it, and get evaluated automatically out of 80 points.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/challenge">
                <Button size="lg">
                  <Trophy className="h-4 w-4" /> Start Challenge
                </Button>
              </Link>
              <a href="https://gemini.google.com" target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">
                  Open Gemini <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </motion.div>
        </section>

        {/* 10-Step Workflow */}
        <section>
          <div className="mb-6 flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-brand-600" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Competition Workflow
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card hover className="h-full">
                  <CardBody className="flex h-full flex-col justify-between p-4">
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{step.description}</p>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Rules & Score Breakdown */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2.5">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Rules & Guidelines
                </h3>
              </div>
              <ul className="space-y-3">
                {rules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2.5">
                <Rocket className="h-5 w-5 text-brand-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Automated AI Score /80 Breakdown
                </h3>
              </div>
              <div className="space-y-2.5 text-sm text-slate-700">
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Semantic / Overall Similarity</span>
                  <span className="font-bold text-brand-600">32 marks</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Composition / Layout</span>
                  <span className="font-bold text-blue-600">20 marks</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Objects / Attributes</span>
                  <span className="font-bold text-emerald-600">16 marks</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Color / Lighting</span>
                  <span className="font-bold text-amber-600">8 marks</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Fine Details</span>
                  <span className="font-bold text-purple-600">4 marks</span>
                </div>
                <div className="flex justify-between rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-sm mt-3">
                  <span>Total Website AI Score</span>
                  <span>80 marks</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}