import Badge from '../ui/Badge';

import { requestTypeConfig, statusConfig } from '../../utils/requestStatus';

function StatusChip({ value, kind = 'status' }) {
  const config = kind === 'type' ? requestTypeConfig[value] : statusConfig[value];
  const tone = config?.tone || 'neutral';

  const toneStyles = {
    neutral: 'slate',
    warning: 'amber',
    primary: 'blue',
    secondary: 'blue',
    success: 'emerald',
    error: 'rose',
    rejected: 'rose',
    burn: 'amber',
  };

  return (
    <Badge className={kind === 'status' ? 'min-w-36 justify-center' : 'min-w-24 justify-center'} tone={toneStyles[tone] || toneStyles.neutral}>
      {config?.label || value}
    </Badge>
  );
}

export default StatusChip;
