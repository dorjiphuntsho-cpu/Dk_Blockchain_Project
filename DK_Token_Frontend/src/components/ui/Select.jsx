import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { forwardRef } from 'react';

import { cn } from '../../utils/cn';

const Select = forwardRef(function Select({ children, className, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-white/10 bg-zinc-950 px-3 pr-10 text-sm text-white outline-none transition focus:border-white/15 focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
    </div>
  );
});

export default Select;
