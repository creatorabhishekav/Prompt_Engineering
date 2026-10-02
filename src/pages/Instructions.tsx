import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
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
  'Target image is protected during the event: direct saving, dragging, and copying are disabled.',
  'Supported formats: PNG, JPG, JPEG, WEBP (max 20MB).',
  'Generate images using your own external Gemini account.',
  'AI score is calculated out of 80 points by the backend evaluator.',
  'Teacher / judge offline 20 marks are added separately offline.',
];

export function InstructionsPage() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <PageTransition>
      <div className="space-y-12">
        {/* Hero Section — clean presentation letting global 3D rotating background provide depth */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 sm:p-10 shadow-sm backdrop-blur-md">
          <div className="relative z-10 max-w-3xl">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              {/* Sequence 1: Brand Kicker */}
              <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-slate-900 font-bold tracking-wide">Competition Arena</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>15 Minutes Per Round</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>80 Marks Automated Vision Evaluation</span>
              </motion.div>

              {/* Sequence 2: Heading */}
              <motion.h1
                variants={itemVariants}
                className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              >
                Can you reverse-engineer the <span className="text-brand-600">target image</span>?
              </motion.h1>

              {/* Sequence 3: Description */}
              <motion.p
                variants={itemVariants}
                className="text-base sm:text-lg leading-relaxed text-slate-600"
              >
                Inspect the reference artwork, craft an effective descriptive prompt, generate the image using your <strong>own Google Gemini account</strong>, and submit. The neural vision evaluator scores your attempt automatically out of 80 points.
              </motion.p>

              {/* Sequence 4: CTAs */}
              <motion.div
                variants={itemVariants}
                className="pt-2 flex flex-wrap items-center gap-3"
              >
                <Link to="/challenge">
                  <Button size="lg" className="hover:-translate-y-0.5 transition-transform shadow-sm">
                    <Trophy className="h-4 w-4" /> Start Challenge
                  </Button>
                </Link>
                <a href="https://gemini.google.com" target="_blank" rel="noreferrer">
                  <Button size="lg" variant="outline" className="hover:-translate-y-0.5 transition-transform border-slate-300 hover:bg-slate-50 text-slate-700">
                    Open Gemini <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* 10-Step Workflow */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Competition Workflow
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Follow the two-stage iterative prompt refinement process.
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="h-full rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between backdrop-blur-sm">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="text-slate-600">
                        {step.icon}
                      </div>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{step.title.replace(/^\d+\.\s*/, '')}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Rules & Score Breakdown */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  Rules & Guidelines
                </h3>
              </div>
              <ul className="space-y-3">
                {rules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Official Scoring Breakdown
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">80 pts max</span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-slate-700">
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Overall Visual Similarity</span>
                    <span className="text-[11px] text-slate-400">CLIP ViT-B/32 + Perceptual SSIM</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">45 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Composition & Layout</span>
                    <span className="text-[11px] text-slate-400">Framing, spatial balance & aspect ratio</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">12 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Objects & Attributes</span>
                    <span className="text-[11px] text-slate-400">Salient regions & structural patterns</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">10 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Color & Lighting</span>
                    <span className="text-[11px] text-slate-400">Hue distribution & contrast harmony</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">7 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Image Quality</span>
                    <span className="text-[11px] text-slate-400">Sharpness, dynamic range & clarity</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">4 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                  <div>
                    <span className="font-medium text-slate-800 block">Fine Details</span>
                    <span className="text-[11px] text-slate-400">High-frequency edge textures</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">2 marks</span>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-sm mt-3">
                  <span>Automated AI Evaluation</span>
                  <span className="font-mono font-bold text-base">80 marks</span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1 text-center">
                  +20 marks evaluated offline by judges / teachers for the final 100-mark total.
                </p>
              </div>
            </CardBody>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}