import { cn } from '../../utils/cn';

function Card({ children, className, padded = true }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-zinc-900',
        padded ? 'p-4 md:p-5' : '',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
