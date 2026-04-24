import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button from '../ui/Button';

function AppTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  minWidth = 960,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or create a new record.',
}) {
  if (error) {
    return <ErrorState description={error} onAction={onRetry} />;
  }

  const totalPages = pagination ? Math.max(Math.ceil(pagination.totalItems / pagination.limit), 1) : 1;
  const currentPage = pagination?.page || 1;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      {loading ? (
        <div className="flex items-center justify-center border-b border-white/10 bg-zinc-950/70 px-3 py-2.5">
          <LoadingSpinner className="size-5 border-[3px]" />
        </div>
      ) : null}
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm" style={{ minWidth }}>
          <thead className="bg-zinc-950/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap border-b border-white/10 px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500"
                  style={{ textAlign: column.align || 'left', width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td className="px-3 py-5" colSpan={columns.length}>
                  <EmptyState description={emptyDescription} title={emptyTitle} />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  className={onRowClick ? 'cursor-pointer transition hover:bg-zinc-900/5' : 'transition hover:bg-zinc-900/5'}
                  key={row.id || row.key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      className="border-b border-white/5 px-3 py-3 align-middle text-zinc-300"
                      key={column.key}
                      onClick={column.disableRowClick ? (event) => event.stopPropagation() : undefined}
                      style={{ textAlign: column.align || 'left' }}
                    >
                      <div className={`flex min-h-[22px] ${column.align === 'right' ? 'justify-end' : 'justify-start'} items-center`}>
                        {column.render ? column.render(row) : row[column.key]}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex flex-col gap-3 border-t border-white/10 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-400 md:flex-row md:items-center md:justify-between">
          <div>
            Showing page {currentPage} of {totalPages} · {pagination.totalItems} total items
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Rows</span>
              <select
                className="rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-white/15 focus:ring-2 focus:ring-white/20"
                onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
                value={pagination.limit || 10}
              >
                {[5, 10, 25, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} size="sm" variant="outline">
                Previous
              </Button>
              <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} size="sm" variant="outline">
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AppTable;
