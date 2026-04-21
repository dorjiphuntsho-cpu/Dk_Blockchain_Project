import { Card, CardContent, Stack, Typography } from '@mui/material';

function InfoPanel({ title, subtitle, action, children, contentSx }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, ...contentSx }}>
        <Stack spacing={2.5}>
          <Stack
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6">{title}</Typography>
              {subtitle ? (
                <Typography color="text.secondary" variant="body2">
                  {subtitle}
                </Typography>
              ) : null}
            </Stack>
            {action || null}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default InfoPanel;
