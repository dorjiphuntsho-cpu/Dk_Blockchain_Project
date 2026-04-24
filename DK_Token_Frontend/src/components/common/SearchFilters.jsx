function SearchFilters({ children, actions }) {
  return (
    <div className="mb-6 rounded-3xl border border-slate-200/80 bg-zinc-900/80 p-4 shadow-soft backdrop-blur md:p-5">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children}
        </div>
        {actions ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SearchFilters;
