import AppDialog from './AppDialog';
import Button from '../ui/Button';

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onClose,
  onConfirm,
  isLoading,
}) {
  return (
    <AppDialog
      actions={
        <>
          <Button disabled={isLoading} onClick={onClose} variant="outline">Cancel</Button>
          <Button disabled={isLoading} onClick={onConfirm} variant="danger">
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <div className="space-y-2">
        <p className="text-sm leading-6 text-zinc-400">{description}</p>
      </div>
    </AppDialog>
  );
}

export default ConfirmDialog;
