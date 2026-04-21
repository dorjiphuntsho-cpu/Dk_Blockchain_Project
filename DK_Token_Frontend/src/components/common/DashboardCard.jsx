import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

function DashboardCard({ label, value, subtitle, icon, accent = 'primary.main' }) {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 22px 48px rgba(15, 23, 42, 0.08)',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Stack spacing={1.25} sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" variant="caption">
              {label}
            </Typography>
            <Typography variant="h3">{value}</Typography>
            <Typography color="text.secondary" variant="body2">
              {subtitle}
            </Typography>
          </Stack>
          {icon ? (
            <Box
              sx={{
                alignItems: 'center',
                backgroundColor: alpha(theme.palette.common.white, 0.75),
                border: `1px solid ${alpha(theme.palette.common.white, 0.45)}`,
                color: accent,
                display: 'inline-flex',
                height: 44,
                justifyContent: 'center',
                minWidth: 44,
              }}
            >
              {icon}
            </Box>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default DashboardCard;
