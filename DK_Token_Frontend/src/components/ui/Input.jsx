import { forwardRef } from 'react';

import { cn } from '../../utils/cn';

const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] outline-none transition duration-150 ease-out placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold-dim)] focus:ring-2 focus:ring-[var(--accent-gold)]/10 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});

export default Input;
