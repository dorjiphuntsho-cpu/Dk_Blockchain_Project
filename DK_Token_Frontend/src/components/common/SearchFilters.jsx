import { Box, Paper, Stack } from '@mui/material';

function SearchFilters({ children, actions }) {
  return (
    <Paper
      sx={{
        mb: 3.5,
        p: { xs: 2, md: 3 },
        backgroundColor: 'background.paper',
      }}
    >
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
            '& > *': {
              minWidth: 0,
            },
          }}
        >
          {children}
        </Box>
        {actions ? (
          <Stack alignItems={{ xs: 'stretch', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end">
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default SearchFilters;
