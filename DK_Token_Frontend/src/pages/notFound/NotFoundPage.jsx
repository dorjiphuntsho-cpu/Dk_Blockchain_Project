import { Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Stack spacing={2} sx={{ minHeight: '70vh' }} alignItems="center" justifyContent="center">
      <Typography variant="h3">Page Not Found</Typography>
      <Typography color="text.secondary">
        The page you requested is not available in this admin portal.
      </Typography>
      <Button onClick={() => navigate('/dashboard')} variant="contained">
        Return to Dashboard
      </Button>
    </Stack>
  );
}

export default NotFoundPage;
