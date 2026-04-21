import { Box } from '@mui/material';

import DashboardCard from '../common/DashboardCard';

function DashboardMetricGrid({ items = [] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.75,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
          xl: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {items.map((item) => (
        <DashboardCard
          key={item.key}
          accent={item.accent}
          icon={item.icon}
          label={item.label}
          subtitle={item.subtitle}
          value={item.value}
        />
      ))}
    </Box>
  );
}

export default DashboardMetricGrid;
