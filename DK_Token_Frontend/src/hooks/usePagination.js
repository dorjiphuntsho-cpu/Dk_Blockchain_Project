import { useMemo, useState } from 'react';

function usePagination(initialPage = 1, initialLimit = 10) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const paginationQuery = useMemo(() => ({ page, limit }), [limit, page]);

  return {
    page,
    limit,
    setPage,
    setLimit,
    paginationQuery,
  };
}

export default usePagination;
