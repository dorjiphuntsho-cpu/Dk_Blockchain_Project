function getPagination(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function buildPagination({ page, limit, totalItems }) {
  return {
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit) || 1,
  };
}

function getSortOptions(query = {}, allowedSortFields = [], defaultSort = { createdAt: 'desc' }) {
  const { sortBy, sortOrder } = query;

  if (!sortBy || !allowedSortFields.includes(sortBy)) {
    return defaultSort;
  }

  const normalizedSortOrder = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return {
    [sortBy]: normalizedSortOrder,
  };
}

module.exports = {
  getPagination,
  buildPagination,
  getSortOptions,
};
