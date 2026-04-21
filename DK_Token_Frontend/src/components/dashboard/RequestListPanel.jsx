import { Link, List, ListItemButton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import InfoPanel from '../common/InfoPanel';
import StatusChip from '../common/StatusChip';
import TypeChip from '../common/TypeChip';
import { formatAmount, truncateMiddle } from '../../utils/format';

function RequestListPanel({
  title,
  subtitle,
  items = [],
  emptyText,
  actionLabel,
  actionTo,
  onSelect,
}) {
  return (
    <InfoPanel
      action={
        actionLabel && items.length ? (
          <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to={actionTo}>
            {actionLabel}
          </Link>
        ) : null
      }
      subtitle={subtitle}
      title={title}
    >
      <List disablePadding sx={{ display: 'grid', gap: 1 }}>
        {items.length ? (
          items.slice(0, 4).map((request) => (
            <ListItemButton
              key={request.id}
              onClick={() => onSelect(request)}
              sx={{ alignItems: 'flex-start', px: 1.25, py: 1 }}
            >
              <Stack spacing={1.05} sx={{ width: '100%' }}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 700 }} variant="body2">
                    {truncateMiddle(request.id, 10, 5)}
                  </Typography>
                  <StatusChip value={request.status} />
                </Stack>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                  <TypeChip value={request.requestType} />
                  <Typography color="text.secondary" variant="body2">
                    {formatAmount(request.amount)}
                  </Typography>
                </Stack>
              </Stack>
            </ListItemButton>
          ))
        ) : (
          <Typography color="text.secondary" variant="body2">
            {emptyText}
          </Typography>
        )}
      </List>
    </InfoPanel>
  );
}

export default RequestListPanel;
