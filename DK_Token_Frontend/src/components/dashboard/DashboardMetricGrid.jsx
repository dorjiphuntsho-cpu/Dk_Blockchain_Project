import DashboardCard from '../common/DashboardCard';

function DashboardMetricGrid({ items = [] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <DashboardCard
          key={item.key}
          accent={item.accent}
          icon={item.icon}
          label={item.label}
          subtitle={item.subtitle}
          value={item.value}
        />
      ))}
    </div>
  );
}

export default DashboardMetricGrid;
