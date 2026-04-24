import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import usePagination from '../../hooks/usePagination';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { usersApi } from '../../modules/users/users.api';
import { REQUEST_STATUS_OPTIONS, REQUEST_TYPE_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { formatAmount, truncateMiddle } from '../../utils/format';

function FilterSelect({ label, value, options, onChange }) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">{label}</label>

      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <ListboxButton className="relative w-full cursor-default rounded-lg bg-white/5 py-2.5 pl-3 pr-10 text-left text-sm text-white ring-1 ring-inset ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20">
            <span className="block truncate">{selected?.label || 'All'}</span>
            <ChevronDownIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 fill-white/50" />
          </ListboxButton>

          <ListboxOptions
            transition
            anchor="bottom start"
            className="z-50 mt-2 w-[var(--button-width)] origin-top rounded-xl border border-white/5 bg-zinc-900 p-1 text-sm text-white shadow-xl transition duration-100 ease-out focus:outline-none data-closed:scale-95 data-closed:opacity-0"
          >
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className="cursor-default rounded-lg px-3 py-1.5 text-zinc-300 data-focus:bg-white/10 data-focus:text-white"
              >
                {option.label}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  );
}

function TokenRequestsPage() {
  const navigate = useNavigate();
  const { setPage, setLimit, paginationQuery } = usePagination();

  const [filters, setFilters] = useState({
    status: '',
    requestType: '',
    tokenMintAddress: '',
    makerUserId: '',
    checkerUserId: '',
  });

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const [requestsResponse, usersResponse] = await Promise.all([
          tokenRequestsApi.list({ ...filters, ...paginationQuery }),
          usersApi.list({ page: 1, limit: 100 }),
        ]);

        setRequests(requestsResponse.data.items);
        setPagination(requestsResponse.data.pagination);
        setUsers(usersResponse.data.items);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load token requests.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const makerOptions = useMemo(
    () => [
      { value: '', label: 'All makers' },
      ...users.map((user) => ({
        value: user.id,
        label: user.fullName || user.email || user.id,
      })),
    ],
    [users],
  );

  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'Request ID',
        render: (row) => (
          <RouterLink
            className="font-semibold text-sky-400 hover:text-sky-300"
            to={`/token-requests/${row.id}`}
          >
            {truncateMiddle(row.id, 10, 5)}
          </RouterLink>
        ),
      },
      {
        key: 'requestType',
        label: 'Type',
        render: (row) => <TypeChip value={row.requestType} />,
      },
      {
        key: 'tokenMintAddress',
        label: 'Token Mint',
        render: (row) => (
          <span className="font-mono text-xs text-zinc-300">
            {truncateMiddle(row.tokenMintAddress, 8, 6)}
          </span>
        ),
      },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        render: (row) => <span className="text-zinc-100">{formatAmount(row.amount)}</span>,
      },
      {
        key: 'sourceWallet',
        label: 'Source',
        render: (row) => row.sourceWallet?.label || <span className="text-zinc-500">-</span>,
      },
      {
        key: 'destinationWallet',
        label: 'Destination',
        render: (row) => row.destinationWallet?.label || <span className="text-zinc-500">-</span>,
      },
      {
        key: 'makerUser',
        label: 'Maker',
        render: (row) => row.makerUser?.fullName || <span className="text-zinc-500">-</span>,
      },
      {
        key: 'checkerUser',
        label: 'Checker',
        render: (row) => row.checkerUser?.fullName || <span className="text-zinc-500">-</span>,
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusChip value={row.status} />,
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => (
          <span className="text-sm text-zinc-400">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        disableRowClick: true,
        render: (row) => (
          <button
            type="button"
            onClick={() => navigate(`/token-requests/${row.id}`)}
            className="rounded-md px-2 py-1 text-sm font-medium text-sky-400 hover:bg-white/10 hover:text-sky-300"
          >
            View
          </button>
        ),
      },
    ],
    [navigate],
  );

  const resetFilters = () => {
    setFilters({
      status: '',
      requestType: '',
      tokenMintAddress: '',
      makerUserId: '',
      checkerUserId: '',
    });
  };

  if (loading && !requests.length) {
    return <LoadingScreen message="Loading token requests..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Monitor requests across the full off-chain workflow."
        title="Token Requests"
      />

      <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Mint address
            </label>
            <input
              value={filters.tokenMintAddress}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  tokenMintAddress: event.target.value,
                }))
              }
              placeholder="Search mint address"
              className="block w-full rounded-lg border-0 bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <FilterSelect
            label="Status"
            value={filters.status}
            options={[
              { value: '', label: 'All statuses' },
              ...REQUEST_STATUS_OPTIONS,
            ]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, status: value }))
            }
          />

          <FilterSelect
            label="Request type"
            value={filters.requestType}
            options={[
              { value: '', label: 'All request types' },
              ...REQUEST_TYPE_OPTIONS,
            ]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, requestType: value }))
            }
          />

          <FilterSelect
            label="Maker"
            value={filters.makerUserId}
            options={makerOptions}
            onChange={(value) =>
              setFilters((current) => ({ ...current, makerUserId: value }))
            }
          />
        </div>

        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Reset filters
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl">
        <AppTable
          columns={columns}
          error={error}
          loading={loading}
          onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
          onPageChange={setPage}
          onRowsPerPageChange={setLimit}
          onRetry={() => window.location.reload()}
          pagination={pagination}
          rows={requests}
        />
      </div>
    </div>
  );
}

export default TokenRequestsPage;