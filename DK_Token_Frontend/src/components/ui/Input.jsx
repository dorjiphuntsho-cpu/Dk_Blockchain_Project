import { forwardRef } from 'react';

import { cn } from '../../utils/cn';

const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/15 focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});

export default Input;
