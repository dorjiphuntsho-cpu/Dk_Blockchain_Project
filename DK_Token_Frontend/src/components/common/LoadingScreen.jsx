import { Box, CircularProgress, Stack, Typography } from '@mui/material';

function LoadingScreen({ message = 'Loading...' }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{ minHeight: '60vh' }}
    >
      <CircularProgress />
      <Typography color="text.secondary">{message}</Typography>
    </Stack>
  );
}

export default LoadingScreen;
