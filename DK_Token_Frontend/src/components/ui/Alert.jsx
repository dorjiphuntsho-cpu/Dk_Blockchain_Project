import { ExclamationTriangleIcon, InformationCircleIcon, ShieldCheckIcon, XCircleIcon } from '@heroicons/react/24/outline';

import { cn } from '../../utils/cn';

const STYLES = {
  info: {
    wrapper: 'border-white/10 bg-zinc-900 text-zinc-200',
    icon: InformationCircleIcon,
  },
  success: {
    wrapper: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    icon: ShieldCheckIcon,
  },
  warning: {
    wrapper: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    icon: ExclamationTriangleIcon,
  },
  error: {
    wrapper: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
    icon: XCircleIcon,
  },
};

function Alert({ children, className, title, tone = 'info' }) {
  const { wrapper, icon: Icon } = STYLES[tone] || STYLES.info;

  return (
    <div className={cn('flex gap-3 rounded-lg border px-3 py-2.5 text-sm', wrapper, className)} role="alert">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-all">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title ? 'mt-1' : undefined)}>{children}</div>
      </div>
    </div>
  );
}

export default Alert;
