import { REQUEST_STATUSES } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';

import StatusChip from './StatusChip';

function RequestTimeline({ items = [], request }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div className="relative flex gap-3" key={item.key}>
          <div className="flex w-4 shrink-0 flex-col items-center">
            <span className={`size-3 rounded-sm ${item.completed ? 'bg-emerald-400' : 'bg-white/15'}`} />
            {index < items.length - 1 ? (
              <span className={`mt-1 min-h-8 w-px flex-1 ${item.completed ? 'bg-emerald-400' : 'bg-white/10'}`} />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-1 pb-2">
            <p className="text-sm font-medium text-white">{item.label}</p>
            <p className="text-sm text-zinc-400">
              {item.timestamp ? formatDateTime(item.timestamp) : item.completed ? 'Completed' : 'Pending'}
            </p>
            {request?.status === item.key || (item.key === 'FINAL_DECISION' && [REQUEST_STATUSES.APPROVED, REQUEST_STATUSES.REJECTED, REQUEST_STATUSES.CANCELLED].includes(request?.status)) ? (
              <StatusChip value={request.status} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default RequestTimeline;
