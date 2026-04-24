import { useEffect, useMemo, useState } from 'react';

import Alert from '../../components/ui/Alert';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import usePagination from '../../hooks/usePagination';
import { formatDateTime } from '../../utils/date';
import { truncateMiddle } from '../../utils/format';

function ManagedTokensPage() {
  const { paginationQuery, setLimit, setPage } = usePagination();
  const [filters, setFilters] = useState({ search: '' });
  const [tokens, setTokens] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tokensWithWarnings = useMemo(
    () => tokens.filter((token) => token.warning),
    [tokens],
  );

  async function loadTokens() {
    try {
      setLoading(true);
      setError('');
      const response = await managedTokensApi.list({
        ...filters,
        ...paginationQuery,
      });
      setTokens(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load managed tokens.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTokens();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Token',
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium text-white">{row.name || row.onChain?.metadata?.name || 'Unnamed Token'}</p>
          <p className="text-xs text-zinc-400">{row.symbol || row.onChain?.metadata?.symbol || '-'}</p>
        </div>
      ),
    },
    {
      key: 'mintAddress',
      label: 'Mint Address',
      render: (row) => (
        <div className="space-y-2">
          <p className="font-medium text-white">{truncateMiddle(row.mintAddress, 12, 10)}</p>
          {row.warning ? (
            <div className="space-y-1">
              <Badge tone="amber">On-chain warning</Badge>
              <p className="max-w-xs break-words text-xs text-amber-300">{row.warning}</p>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'supply',
      label: 'Supply',
      align: 'right',
      render: (row) => row.onChain?.supply || '-',
    },
    {
      key: 'decimals',
      label: 'Decimals',
      align: 'right',
      render: (row) => row.onChain?.decimals ?? row.decimals,
    },
    {
      key: 'tokenAuthority',
      label: 'Token Authority',
      render: (row) => (
        <span className="break-all font-mono text-xs text-zinc-300">{truncateMiddle(row.tokenAuthority, 12, 10)}</span>
      ),
    },
    {
      key: 'authorities',
      label: 'Authorities',
      render: (row) => (
        <div className="space-y-1 text-xs text-zinc-400">
          <p>Mint: {truncateMiddle(row.onChain?.mintAuthority || row.mintAuthority, 12, 10)}</p>
          <p>Freeze: {truncateMiddle(row.onChain?.freezeAuthority || row.freezeAuthority, 12, 10)}</p>
        </div>
      ),
    },
    {
      key: 'creatorUser',
      label: 'Created By',
      render: (row) => row.creatorUser?.fullName || '-',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'createdTxSignature',
      label: 'Creation Tx',
      render: (row) => (
        row.explorerUrl ? (
          <a className="text-sky-400 hover:text-sky-300" href={row.explorerUrl} rel="noreferrer" target="_blank">
            {truncateMiddle(row.createdTxSignature, 12, 10)}
          </a>
        ) : truncateMiddle(row.createdTxSignature, 12, 10)
      ),
    },
  ], []);

  if (loading && !tokens.length) {
    return <LoadingScreen message="Loading managed tokens..." />;
  }

  if (error && !tokens.length) {
    return <ErrorState description={error} onAction={loadTokens} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Persistent registry of SPL mints created through the portal, with live on-chain supply and authority details."
        title="Managed Tokens"
      />

      <SearchFilters>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Search name, symbol, mint, or authority</span>
          <Input
            onChange={(event) => setFilters({ search: event.target.value })}
            value={filters.search}
          />
        </label>
      </SearchFilters>

      {tokensWithWarnings.length ? (
        <Alert tone="warning">
          Some tokens could not be refreshed fully from chain. Showing the live warning from the backend for each affected token.
        </Alert>
      ) : null}

      {tokensWithWarnings.length ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">On-Chain Refresh Warnings</h2>
            {tokensWithWarnings.map((token) => (
              <Alert key={token.id} tone="warning">
                <span className="font-semibold">{token.name || token.symbol || truncateMiddle(token.mintAddress, 12, 10)}</span>
                {`: ${token.warning}`}
              </Alert>
            ))}
          </div>
        </div>
      ) : null}

      <AppTable
        columns={columns}
        emptyDescription="No managed token mints have been created through the portal yet."
        emptyTitle="No managed tokens"
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadTokens}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        rows={tokens}
      />
    </div>
  );
}

export default ManagedTokensPage;
