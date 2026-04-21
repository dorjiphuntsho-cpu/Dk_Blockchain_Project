import { Stack, Typography } from '@mui/material';

function PageSection({ title, subtitle, action, children, spacing = 2.5 }) {
  return (
    <Stack spacing={spacing}>
      {(title || subtitle || action) ? (
        <Stack
          alignItems={{ xs: 'flex-start', md: 'center' }}
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          spacing={1.25}
        >
          <Stack spacing={0.5}>
            {title ? <Typography variant="h6">{title}</Typography> : null}
            {subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {action || null}
        </Stack>
      ) : null}
      {children}
    </Stack>
  );
}

export default PageSection;
