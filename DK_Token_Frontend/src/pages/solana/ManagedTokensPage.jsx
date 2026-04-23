import { Alert, Card, CardContent, Chip, Link, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import usePagination from '../../hooks/usePagination';
import { managedTokensApi } from '../../modules/solana/managedTokens.api';
import { formatDateTime } from '../../utils/date';
import { truncateMiddle } from '../../utils/format';

function ManagedTokensPage() {
  const { paginationQuery, setLimit, setPage } = usePagination();
  const [filters, setFilters] = useState({ search: '' });
  const [tokens, setTokens] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
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

    load();
  }, [filters, paginationQuery.page, paginationQuery.limit]);

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Token',
      render: (row) => (
        <Stack spacing={0.35}>
          <Typography sx={{ fontWeight: 700 }} variant="body2">
            {row.name || row.onChain?.metadata?.name || 'Unnamed Token'}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {row.symbol || row.onChain?.metadata?.symbol || '-'}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'mintAddress',
      label: 'Mint Address',
      render: (row) => (
        <Stack spacing={0.5}>
          <Typography sx={{ fontWeight: 700 }} variant="body2">
            {truncateMiddle(row.mintAddress, 12, 10)}
          </Typography>
          {row.warning ? <Chip color="warning" label="On-chain warning" size="small" /> : null}
        </Stack>
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
      render: (row) => truncateMiddle(row.tokenAuthority, 12, 10),
    },
    {
      key: 'authorities',
      label: 'Authorities',
      render: (row) => (
        <Stack spacing={0.35}>
          <Typography variant="caption">
            Mint: {truncateMiddle(row.onChain?.mintAuthority || row.mintAuthority, 12, 10)}
          </Typography>
          <Typography variant="caption">
            Freeze: {truncateMiddle(row.onChain?.freezeAuthority || row.freezeAuthority, 12, 10)}
          </Typography>
        </Stack>
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
          <Link href={row.explorerUrl} rel="noreferrer" target="_blank">
            {truncateMiddle(row.createdTxSignature, 12, 10)}
          </Link>
        ) : truncateMiddle(row.createdTxSignature, 12, 10)
      ),
    },
  ], []);

  if (loading && !tokens.length) {
    return <LoadingScreen message="Loading managed tokens..." />;
  }

  if (error && !tokens.length) {
    return <ErrorState description={error} onAction={() => window.location.reload()} />;
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Persistent registry of SPL mints created through the portal, with live on-chain supply and authority details."
        title="Managed Tokens"
      />

      <SearchFilters>
        <TextField
          label="Search name, symbol, mint, or authority"
          onChange={(event) => setFilters({ search: event.target.value })}
          value={filters.search}
        />
      </SearchFilters>

      {tokens.some((token) => token.warning) ? (
        <Alert severity="warning">
          Some tokens could not be refreshed fully from chain. Stored metadata is still shown.
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <AppTable
            columns={columns}
            error={error}
            loading={loading}
            onPageChange={setPage}
            onRowsPerPageChange={setLimit}
            onRetry={() => window.location.reload()}
            pagination={pagination}
            rows={tokens}
            emptyDescription="No managed token mints have been created through the portal yet."
            emptyTitle="No managed tokens"
          />
        </CardContent>
      </Card>
    </Stack>
  );
}

export default ManagedTokensPage;
