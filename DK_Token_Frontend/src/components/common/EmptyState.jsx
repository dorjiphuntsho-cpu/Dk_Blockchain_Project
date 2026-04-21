import { Button, Paper, Stack, Typography } from '@mui/material';

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 4, md: 5 },
        textAlign: 'center',
        backgroundColor: 'background.paper',
        boxShadow: 'none',
      }}
    >
      <Stack alignItems="center" spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
          {description}
        </Typography>
        {actionLabel ? <Button variant="contained" onClick={onAction}>{actionLabel}</Button> : null}
      </Stack>
    </Paper>
  );
}

export default EmptyState;
