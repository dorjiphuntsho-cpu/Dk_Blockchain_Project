import { Box, Stack, Typography } from '@mui/material';

import { formatDateTime } from '../../utils/date';
import StatusChip from './StatusChip';

function RequestTimeline({ items = [], request }) {
  return (
    <Stack spacing={1.5}>
      {items.map((item, index) => (
        <Stack direction="row" key={item.key} spacing={2} sx={{ position: 'relative' }}>
          <Stack alignItems="center" sx={{ width: 18 }}>
            <Box
              sx={(theme) => ({
                width: 12,
                height: 12,
                backgroundColor: item.completed ? theme.palette.primary.main : theme.palette.divider,
              })}
            />
            {index < items.length - 1 ? (
              <Box
                sx={(theme) => ({
                  flex: 1,
                  width: 2,
                  minHeight: 32,
                  backgroundColor: item.completed ? theme.palette.primary.main : theme.palette.divider,
                })}
              />
            ) : null}
          </Stack>
          <Stack spacing={0.5} sx={{ pb: 2 }}>
            <Typography variant="subtitle2">{item.label}</Typography>
            <Typography color="text.secondary" variant="body2">
              {item.timestamp ? formatDateTime(item.timestamp) : item.completed ? 'Completed' : 'Pending'}
            </Typography>
            {request?.status === item.key ? <StatusChip value={request.status} /> : null}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

export default RequestTimeline;
