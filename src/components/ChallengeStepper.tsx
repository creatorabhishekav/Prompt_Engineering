import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';

export interface StepItem {
  id: string;
  number: string;
  label: string;
  status: 'completed' | 'current' | 'locked';
}

interface ChallengeStepperProps {
  steps: StepItem[];
}

export function ChallengeStepper({ steps }: ChallengeStepperProps) {
  return (
    <div className="w-full overflow-x-auto pb-2 select-none">
      <div className="flex items-center min-w-[720px] justify-between rounded-2xl border border-white/[0.08] bg-surface-900/80 px-4 py-3 backdrop-blur-xl">
        {steps.map((st, index) => {
          const isCompleted = st.status === 'completed';
          const isCurrent = st.status === 'current';
          const isLocked = st.status === 'locked';

          return (
            <div key={st.id} className="flex items-center flex-1 last:flex-initial">
              <div className="flex items-center gap-2 group">
                {/* Node icon */}
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-[10px] font-bold transition-all duration-200 ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : isCurrent
                      ? 'bg-brand-500 text-white shadow-glow border border-brand-400'
                      : 'bg-surface-800 text-zinc-500 border border-white/[0.06]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : (
                    <span>{st.number}</span>
                  )}
                </div>

                {/* Text Label */}
                <div className="flex flex-col">
                  <span
                    className={`font-mono text-[11px] font-bold tracking-tight whitespace-nowrap transition-colors ${
                      isCompleted
                        ? 'text-emerald-300/90'
                        : isCurrent
                        ? 'text-white'
                        : 'text-zinc-500'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              </div>

              {/* Connecting line to next step */}
              {index < steps.length - 1 && (
                <div className="mx-2 sm:mx-3 h-[1px] flex-1 bg-surface-750 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500/50'
                        : isCurrent
                        ? 'bg-gradient-to-r from-brand-500 to-transparent'
                        : 'bg-transparent'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
