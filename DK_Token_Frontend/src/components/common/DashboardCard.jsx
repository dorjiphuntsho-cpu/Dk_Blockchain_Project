function DashboardCard({ label, value, subtitle, icon }) {
  return (
    <div className="h-full rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>
        {icon ? (
          <div className="inline-flex size-8 items-center justify-center text-zinc-500">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DashboardCard;
