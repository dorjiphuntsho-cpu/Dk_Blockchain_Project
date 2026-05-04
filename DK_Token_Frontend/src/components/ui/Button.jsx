import { forwardRef } from 'react';

import { cn } from '../../utils/cn';

const VARIANTS = {
  primary: 'bg-white text-zinc-950 ring-1 ring-white/10 hover:bg-zinc-200 focus-visible:ring-white/20',
  secondary: 'bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10 focus-visible:ring-white/20',
  outline: 'bg-zinc-900 text-zinc-200 ring-1 ring-white/10 hover:bg-zinc-800 focus-visible:ring-white/20',
  ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-900/5 hover:text-white focus-visible:ring-white/20',
  danger: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 focus-visible:ring-red-400/30',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
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
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
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
