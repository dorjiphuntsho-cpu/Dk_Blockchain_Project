import { Box, Container, Paper } from '@mui/material';
import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 3,
      }}
    >
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, md: 5 } }}>
          <Outlet />
        </Paper>
      </Container>
    </Box>
  );
}

export default AuthLayout;
