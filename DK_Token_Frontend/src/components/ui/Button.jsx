import { forwardRef } from 'react';

import { cn } from '../../utils/cn';

const VARIANTS = {
  primary: 'border-0 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] ring-0 hover:bg-[#f8c92b] hover:shadow-[0_0_8px_rgba(240,185,11,0.4)] focus-visible:ring-[var(--accent-gold)]/30',
  secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] ring-1 ring-[var(--border)] hover:bg-[#252b33] focus-visible:ring-white/20',
  outline: 'bg-transparent text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:border-transparent hover:bg-[var(--accent-gold)] hover:text-black focus-visible:ring-[var(--accent-gold)]/20',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:ring-white/20',
  danger: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 focus-visible:ring-red-400/30',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs font-medium',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
};

const Button = forwardRef(function Button(
  { as: Component = 'button', className, variant = 'primary', size = 'md', type = 'button', disabled = false, ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[6px] font-medium transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={Component === 'button' ? disabled : undefined}
      type={Component === 'button' ? type : undefined}
      {...props}
    />
  );
});

export default Button;
