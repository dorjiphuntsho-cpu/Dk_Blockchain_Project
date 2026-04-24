import { cn } from '../../utils/cn';

const STYLES = {
  slate: 'bg-zinc-900/5 text-zinc-300 ring-1 ring-inset ring-white/10',
  emerald: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20',
  blue: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20',
};

function Badge({ children, className, tone = 'slate' }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', STYLES[tone], className)}>
      {children}
    </span>
  );
}

export default Badge;
