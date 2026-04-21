import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

function DashboardCard({ label, value, subtitle, icon, accent = 'primary.main' }) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        height: '100%',
        px: 2.75,
        py: 2.5,
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 3,
          backgroundColor: alpha(theme.palette.primary.main, 0.5),
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)',
          backgroundColor: '#fcfdff',
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Stack spacing={1.1} sx={{ minWidth: 0 }}>
          <Typography color="text.secondary" variant="caption">
            {label}
          </Typography>
          <Typography sx={{ fontSize: { xs: '1.8rem', xl: '2rem' }, fontWeight: 800, letterSpacing: '-0.04em' }}>
            {value}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {subtitle}
          </Typography>
        </Stack>
        {icon ? (
          <Box
            sx={{
              alignItems: 'center',
              color: accent,
              display: 'inline-flex',
              height: 36,
              justifyContent: 'center',
              minWidth: 36,
              opacity: 0.85,
            }}
          >
            {icon}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default DashboardCard;
