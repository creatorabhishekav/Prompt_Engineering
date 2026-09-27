import { Loader2 } from 'lucide-react';

export interface LoadingProps {
  label?: string;
  fullScreen?: boolean;
}

export function Loading({ label = 'Loading...', fullScreen = false }: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'flex min-h-[60vh] flex-col items-center justify-center gap-3'
          : 'flex flex-col items-center justify-center gap-3 py-12'
      }
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      <p className="text-sm text-slate-500">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}