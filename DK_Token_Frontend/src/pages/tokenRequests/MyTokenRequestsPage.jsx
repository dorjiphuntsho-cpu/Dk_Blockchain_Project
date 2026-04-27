import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import SearchFilters from '../../components/common/SearchFilters';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import useAuth from '../../hooks/useAuth';
import usePagination from '../../hooks/usePagination';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import {
  buildExplorerTransactionUrl,
  buildMakerCancellationTransaction,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { REQUEST_STATUS_OPTIONS } from '../../utils/constants';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/error';
import { formatAmount, truncateMiddle } from '../../utils/format';
import { canCancelPendingRequest } from '../../utils/permissions';

function MyTokenRequestsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const { setPage, setLimit, paginationQuery } = usePagination();
  const [filters, setFilters] = useState({ status: '' });
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingRequestId, setCancellingRequestId] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tokenRequestsApi.list({
        ...filters,
        ...paginationQuery,
        makerUserId: user.id,
      });
      setRequests(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your requests.');
    } finally {
      setLoading(false);
    }
  }, [filters, paginationQuery, user.id]);

  useEffect(() => {
    (async () => {
      await loadRequests();
    })();
  }, [loadRequests]);

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Request ID',
      render: (row) => (
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={`/token-requests/${row.id}`}>
          {truncateMiddle(row.id, 10, 5)}
        </RouterLink>
      ),
    },
    { key: 'requestType', label: 'Type', render: (row) => <TypeChip value={row.requestType} /> },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.amount) },
    { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => <span className="text-zinc-400">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="sm" variant="ghost">View</Button>
          {row.status === 'DRAFT' ? (
            <Button onClick={() => navigate('/token-requests/new', { state: { request: row } })} size="sm" variant="outline">
              Edit
            </Button>
          ) : null}
          {canCancelPendingRequest(user, row) ? (
            <Button
              disabled={cancellingRequestId === row.id}
              onClick={async () => {
                try {
                  setCancellingRequestId(row.id);
                  if (row.onChainRequestAddress) {
                    if (!walletConnected || !connectedWalletAddress) {
                      throw new Error('Connect the maker wallet before cancelling this on-chain request.');
                    }

                    if (!walletProvider) {
                      throw new Error('Wallet provider is not available.');
                    }

                    const preparedResponse = await tokenRequestsApi.prepareMakerCancellation(
                      row.id,
                      connectedWalletAddress,
                    );
                    const cancellationPayload = preparedResponse.data;
                    const txSignature = cancellationPayload.cancelInstruction
                      ? await (async () => {
                        const builtTransaction = buildMakerCancellationTransaction({
                          executionPayload: cancellationPayload,
                          makerWalletAddress: connectedWalletAddress,
                        });

                        return signAndSendWalletTransaction({
                          connection: builtTransaction.connection,
                          provider: walletProvider,
                          transaction: builtTransaction.transaction,
                        });
                      })()
                      : `mock-cancel-${Date.now()}`;

                    await tokenRequestsApi.recordCancellation(row.id, {
                      makerWalletAddress: connectedWalletAddress,
                      txSignature,
                      explorerUrl: buildExplorerTransactionUrl(txSignature, cancellationPayload.rpcUrl),
                    });
                  } else {
                    await tokenRequestsApi.cancel(row.id);
                  }

                  enqueueSnackbar('Request cancelled', { variant: 'success' });
                  await loadRequests();
                } catch (cancelError) {
                  const message = getErrorMessage(cancelError, 'Unable to cancel request');
                  if (/already cancelled on chain|current status is cancelled/i.test(message)) {
                    enqueueSnackbar('This request is already cancelled on chain.', { variant: 'warning' });
                    await loadRequests();
                  } else {
                    enqueueSnackbar(message, { variant: 'error' });
                  }
                } finally {
                  setCancellingRequestId('');
                }
              }}
              size="sm"
              variant="danger"
            >
              {cancellingRequestId === row.id
                ? 'Cancelling...'
                : row.onChainRequestAddress
                  ? 'Cancel Request'
                  : 'Cancel'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ], [cancellingRequestId, connectedWalletAddress, enqueueSnackbar, loadRequests, navigate, user, walletConnected, walletProvider]);

  if (loading && !requests.length) {
    return <LoadingScreen message="Loading your requests..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={loadRequests} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        action={{ label: 'Create Request', onClick: () => navigate('/token-requests/new') }}
        subtitle="Track draft, submitted, and completed requests created by you."
        title="My Token Requests"
      />
      <SearchFilters
        actions={(
          <Button onClick={() => setFilters({ status: '' })} variant="outline">Reset Filters</Button>
        )}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-200">Status</span>
          <Select onChange={(event) => setFilters({ status: event.target.value })} value={filters.status}>
            <option value="">All</option>
            {REQUEST_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label>
      </SearchFilters>
      <AppTable
        columns={columns}
        error={error}
        loading={loading}
        onPageChange={setPage}
        onRetry={loadRequests}
        onRowClick={(row) => navigate(`/token-requests/${row.id}`)}
        onRowsPerPageChange={setLimit}
        pagination={pagination}
        rows={requests}
      />
    </div>
  );
}

export default MyTokenRequestsPage;
