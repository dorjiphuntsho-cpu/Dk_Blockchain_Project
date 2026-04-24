import Button from '../ui/Button';
import Card from '../ui/Card';

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Card className="border-dashed text-center" padded={false}>
      <div className="flex flex-col items-center gap-3 px-6 py-10 md:px-10 md:py-12">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
        {actionLabel ? <Button onClick={onAction} variant="secondary">{actionLabel}</Button> : null}
      </div>
    </Card>
  );
}

export default EmptyState;
