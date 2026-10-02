import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glow';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-brand-600 via-indigo-600 to-accent-600 text-white font-semibold shadow-glow hover:shadow-glow hover:brightness-110 border border-white/20 focus-visible:ring-2 focus-visible:ring-brand-400',
  glow:
    'bg-brand-600 text-white font-semibold shadow-glow hover:bg-brand-500 border border-brand-400/40 focus-visible:ring-2 focus-visible:ring-brand-400',
  secondary:
    'bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 border border-slate-200/80 focus-visible:ring-2 focus-visible:ring-slate-400 shadow-sm',
  outline:
    'border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-400 shadow-sm',
  ghost:
    'bg-transparent text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400',
  danger:
    'bg-rose-50 border border-rose-200 text-rose-700 font-semibold hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500 shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3.5 text-xs gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
