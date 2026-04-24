import Card from '../ui/Card';

function InfoPanel({ title, subtitle, action, children, contentSx }) {
  return (
    <Card className="h-full rounded-lg" padded={false}>
      <div className="space-y-4 p-4" style={contentSx}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {subtitle ? <p className="text-sm leading-5 text-zinc-400">{subtitle}</p> : null}
          </div>
          {action || null}
        </div>
        {children}
      </div>
    </Card>
  );
}

export default InfoPanel;
