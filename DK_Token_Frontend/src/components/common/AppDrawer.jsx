import { Drawer, Stack, Typography } from '@mui/material';

function AppDrawer({ open, title, children, onClose, anchor = 'right' }) {
  return (
    <Drawer anchor={anchor} onClose={onClose} open={open}>
      <Stack spacing={2} sx={{ p: 3, width: { xs: 320, md: 420 } }}>
        <Typography variant="h6">{title}</Typography>
        {children}
      </Stack>
    </Drawer>
  );
}

export default AppDrawer;
