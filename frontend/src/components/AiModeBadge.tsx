import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { aiApi } from '@/lib/api';

interface AiModeBadgeProps {
  className?: string;
}

export function AiModeBadge({ className }: AiModeBadgeProps) {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    aiApi
      .status()
      .then((res) => {
        if (active) setMode(res.mode);
      })
      .catch(() => {
        if (active) setMode(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDemo = mode === 'demo';

  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ' +
        (isDemo
          ? 'bg-accent-50 text-accent-700 ring-accent-200'
          : 'bg-emerald-50 text-emerald-700 ring-emerald-200') +
        (className ? ` ${className}` : '')
      }
    >
      <Sparkles className="h-3.5 w-3.5" />
      {mode ? `AI Mode: ${mode}` : 'AI Mode: demo'}
    </motion.span>
  );
}