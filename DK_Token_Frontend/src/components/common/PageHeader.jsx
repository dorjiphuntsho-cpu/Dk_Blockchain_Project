import { Button, Stack, Typography } from '@mui/material';

function PageHeader({ title, subtitle, action, breadcrumbs, eyebrow }) {
  return (
    <Stack spacing={1} sx={{ mb: 4 }}>
      {breadcrumbs || null}
      {eyebrow ? (
        <Typography color="text.secondary" sx={{ textTransform: 'uppercase' }} variant="caption">
          {eyebrow}
        </Typography>
      ) : null}
      <Stack
        alignItems={{ xs: 'flex-start', md: 'center' }}
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack spacing={0.5}>
          <Typography sx={{ letterSpacing: '-0.045em' }} variant="h4">{title}</Typography>
          {subtitle ? (
            <Typography color="text.secondary" sx={{ maxWidth: 700 }} variant="body1">
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {action ? <Button variant={action.variant || 'contained'} onClick={action.onClick}>{action.label}</Button> : null}
      </Stack>
    </Stack>
  );
}

export default PageHeader;
