import { Button, Paper, Stack, Typography } from '@mui/material';

function ErrorState({
  title = 'Something went wrong',
  description = 'The requested data could not be loaded right now.',
  actionLabel = 'Try Again',
  onAction,
}) {
  return (
    <Paper sx={{ p: { xs: 4, md: 5 } }}>
      <Stack alignItems="flex-start" spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
          {description}
        </Typography>
        {onAction ? <Button onClick={onAction} variant="contained">{actionLabel}</Button> : null}
      </Stack>
    </Paper>
  );
}

export default ErrorState;
