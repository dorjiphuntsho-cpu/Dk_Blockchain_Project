import { cn } from '../../utils/cn';

function Card({ children, className, padded = true }) {
  return (
    <div
      className={cn(
        'fintech-panel',
        padded ? 'p-4 md:p-4' : '',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
