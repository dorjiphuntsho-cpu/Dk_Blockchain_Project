function PageSection({ title, subtitle, action, children, spacing = 2.5 }) {
  return (
    <div className="flex flex-col" style={{ gap: `${spacing * 0.25}rem` }}>
      {(title || subtitle || action) ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : null}
            {subtitle ? <p className="text-sm text-zinc-400">{subtitle}</p> : null}
          </div>
          {action || null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export default PageSection;
