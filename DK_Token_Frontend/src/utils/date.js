import dayjs from 'dayjs';

export function formatDateTime(value, fallback = 'N/A') {
  if (!value) {
    return fallback;
  }

  return dayjs(value).format('DD MMM YYYY, HH:mm');
}

export function formatDate(value, fallback = 'N/A') {
  if (!value) {
    return fallback;
  }

  return dayjs(value).format('DD MMM YYYY');
}

export function toIsoDate(value) {
  return value ? dayjs(value).toISOString() : null;
}
