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
          <RouterLink className="text-sm text-zinc-400 hover:text-white" to={actionTo}>
            {actionLabel}
          </RouterLink>
        ) : null
      }
      subtitle={subtitle}
      title={title}
    >
      <div className="grid gap-2">
        {items.length ? (
          items.slice(0, 4).map((request) => (
            <button
              className="rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-left transition hover:bg-zinc-900/5"
              key={request.id}
              onClick={() => onSelect(request)}
              type="button"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">
                    {truncateMiddle(request.id, 10, 5)}
                  </span>
                  <StatusChip value={request.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <TypeChip value={request.requestType} />
                  <span className="text-sm text-zinc-500">
                    {formatAmount(request.amount)}
                  </span>
                </div>
              </div>
            </button>
          ))
        ) : (
          <p className="text-sm text-zinc-500">{emptyText}</p>
        )}
      </div>
    </InfoPanel>
  );
}

export default RequestListPanel;
