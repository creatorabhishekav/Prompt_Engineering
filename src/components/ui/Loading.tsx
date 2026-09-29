import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LoadingProps {
  label?: string;
  sublabel?: string;
  fullScreen?: boolean;
  className?: string;
}

export function Loading({
  label = 'Processing...',
  sublabel,
  fullScreen = false,
  className,
}: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 text-center select-none',
        fullScreen ? 'min-h-[70vh]' : 'py-12',
        className
      )}
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        {/* Outer pulse */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-2xl bg-brand-500/20 blur-md"
        />
        {/* Spinning technical ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="h-10 w-10 rounded-full border-2 border-brand-500/20 border-t-brand-400 border-r-cyan-400"
        />
        {/* Inner glowing dot */}
        <motion.div
          animate={{ scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-glow-cyan"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-wide text-zinc-200">{label}</p>
        {sublabel && <p className="text-xs text-zinc-500 max-w-xs">{sublabel}</p>}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
