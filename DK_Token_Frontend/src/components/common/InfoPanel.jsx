import { Paper, Stack, Typography } from '@mui/material';

function InfoPanel({ title, subtitle, action, children, contentSx }) {
  return (
    <Paper
      sx={{
        height: '100%',
        px: { xs: 2.25, md: 2.75 },
        py: { xs: 2.25, md: 2.5 },
        backgroundColor: '#ffffff',
      }}
    >
      <Stack spacing={2.25} sx={contentSx}>
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.25}
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
    </Paper>
  );
}

export default InfoPanel;
