export function formatAmount(value) {
  const parsed = Number(value || 0);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(parsed);
}

export function truncateMiddle(value, start = 6, end = 4) {
  if (!value || value.length <= start + end + 3) {
    return value || '-';
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join('');
}
