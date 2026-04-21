import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

function AppDialog({ open, title, children, actions, onClose, maxWidth = 'sm' }) {
  return (
    <Dialog fullWidth maxWidth={maxWidth} onClose={onClose} open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions ? <DialogActions>{actions}</DialogActions> : null}
    </Dialog>
  );
}

export default AppDialog;
