import { Link as RouterLink } from 'react-router-dom';

import InfoPanel from '../common/InfoPanel';
import { formatDateTime } from '../../utils/date';
import { truncateMiddle } from '../../utils/format';

function AuditActivityPanel({ items = [] }) {
  return (
    <InfoPanel
      action={
        items.length ? (
          <RouterLink className="text-sm text-zinc-400 hover:text-white" to="/audit-logs">
            View logs
          </RouterLink>
        ) : null
      }
      subtitle="Most recent system activity across users, wallets, and token requests."
      title="Audit Activity"
    >
      <div className="grid gap-2">
        {items.length ? (
          items.slice(0, 4).map((log) => (
            <div className="rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2" key={log.id}>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">
                    {log.action}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">
                  {log.actorUser?.fullName || 'System'} | {log.entityType} | {truncateMiddle(log.entityId, 10, 5)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Recent audit activity will appear here once the system is in use.</p>
        )}
      </div>
    </InfoPanel>
  );
}

export default AuditActivityPanel;
