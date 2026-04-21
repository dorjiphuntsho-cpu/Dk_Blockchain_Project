import { Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

function SearchFilters({ children, actions }) {
  return (
    <Box
      sx={{
        mb: 3.5,
        p: { xs: 1.5, md: 2 },
        backgroundColor: alpha('#ffffff', 0.55),
        borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
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
          <Stack
            alignItems={{ xs: 'stretch', sm: 'center' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="flex-end"
            spacing={1}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

export default SearchFilters;
