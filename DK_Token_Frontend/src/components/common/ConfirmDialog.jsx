import { Button, Stack, Typography } from '@mui/material';

import AppDialog from './AppDialog';

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
          <Button disabled={isLoading} onClick={onClose}>Cancel</Button>
          <Button color="error" disabled={isLoading} onClick={onConfirm} variant="contained">
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <Stack spacing={1.5}>
        <Typography color="text.secondary">{description}</Typography>
      </Stack>
    </AppDialog>
  );
}

export default ConfirmDialog;
