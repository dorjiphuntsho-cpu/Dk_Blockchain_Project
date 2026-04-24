import Button from '../ui/Button';
import Card from '../ui/Card';

function ErrorState({
  title = 'Something went wrong',
  description = 'The requested data could not be loaded right now.',
  actionLabel = 'Try Again',
  onAction,
}) {
  return (
    <Card>
      <div className="flex flex-col items-start gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
        {onAction ? <Button onClick={onAction} variant="secondary">{actionLabel}</Button> : null}
      </div>
    </Card>
  );
}

export default ErrorState;
