import Button from '../ui/Button';

function PageHeader({ title, subtitle, action, breadcrumbs, eyebrow }) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumbs || null}
      {eyebrow ? <p className="text-sm text-zinc-400">{eyebrow}</p> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="break-all text-2xl font-semibold text-white md:text-3xl">{title}</h1>
          {subtitle ? <p className="max-w-3xl text-sm leading-6 text-zinc-400">{subtitle}</p> : null}
        </div>
        {action ? <Button className="w-full md:w-auto" onClick={action.onClick} size="md" variant={action.variant || 'primary'}>{action.label}</Button> : null}
      </div>
    </div>
  );
}

export default PageHeader;
