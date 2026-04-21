import { Link, List, ListItemButton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import InfoPanel from '../common/InfoPanel';
import { formatDateTime } from '../../utils/date';
import { truncateMiddle } from '../../utils/format';

function AuditActivityPanel({ items = [] }) {
  return (
    <InfoPanel
      action={
        items.length ? (
          <Link component={RouterLink} sx={{ fontWeight: 700, textDecoration: 'none' }} to="/audit-logs">
            View logs
          </Link>
        ) : null
      }
      subtitle="Most recent system activity across users, wallets, and token requests."
      title="Audit Activity"
    >
      <List disablePadding sx={{ display: 'grid', gap: 1 }}>
        {items.length ? (
          items.slice(0, 4).map((log) => (
            <ListItemButton key={log.id} sx={{ alignItems: 'flex-start', px: 1.25, py: 1 }}>
              <Stack spacing={0.45} sx={{ width: '100%' }}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 700 }} variant="body2">
                    {log.action}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {formatDateTime(log.createdAt)}
                  </Typography>
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {log.actorUser?.fullName || 'System'} | {log.entityType} | {truncateMiddle(log.entityId, 10, 5)}
                </Typography>
              </Stack>
            </ListItemButton>
          ))
        ) : (
          <Typography color="text.secondary" variant="body2">
            Recent audit activity will appear here once the system is in use.
          </Typography>
        )}
      </List>
    </InfoPanel>
  );
}

export default AuditActivityPanel;
