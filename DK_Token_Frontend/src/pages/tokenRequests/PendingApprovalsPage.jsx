import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ReserveBalancePanel from '../../components/cbs/ReserveBalancePanel';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { cbsApi } from '../../modules/cbs/cbs.api';
import { settlementsApi } from '../../modules/settlements/settlements.api';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import {
  buildCheckerRejectionTransaction,
  buildExplorerTransactionUrl,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { formatAmount, truncateMiddle } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

function getDetailsPath(row) {
  return row.kind === 'SETTLEMENT' ? `/settlements/${row.id}` : `/token-requests/${row.id}`;
}

function PendingApprovalsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    address: connectedWalletAddress,
    connected: walletConnected,
    provider: walletProvider,
  } = useSolanaWallet();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingRequest, setRejectingRequest] = useState(false);
  const [reserveBalance, setReserveBalance] = useState(null);
  const [reserveBalanceLoading, setReserveBalanceLoading] = useState(true);
  const [reserveBalanceError, setReserveBalanceError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [tokenResponse, settlementResponse] = await Promise.all([
        tokenRequestsApi.list({ page: 1, limit: 50, status: 'PENDING_APPROVAL' }),
        settlementsApi.list({ page: 1, limit: 50, status: 'PENDING_APPROVAL' }),
      ]);

      const tokenRows = (tokenResponse.data.items || []).map((item) => ({
        ...item,
        kind: 'TOKEN_REQUEST',
        makerLabel: item.makerUser?.fullName || '-',
      }));

      const settlementRows = (settlementResponse.data.items || [])
        .filter((item) => ['RESERVE_MINT', 'REPLENISHMENT_MINT'].includes(item.requestType))
        .map((item) => ({
          ...item,
          kind: 'SETTLEMENT',
          makerLabel: item.sourceBank?.name || 'DK Bank',
        }));

      setRequests([...tokenRows, ...settlementRows]);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load pending approvals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReserveBalance() {
      try {
        setReserveBalanceLoading(true);
        setReserveBalanceError('');
        const response = await cbsApi.getIssuerReserveBalance();
        if (!cancelled) {
          setReserveBalance(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setReserveBalance(null);
          setReserveBalanceError(getErrorMessage(loadError, 'Unable to load DK Bank reserve balance.'));
        }
      } finally {
        if (!cancelled) {
          setReserveBalanceLoading(false);
        }
      }
    }

    loadReserveBalance();

    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => [
    {
      key: 'id',
      label: 'Request ID',
      render: (row) => (
        <RouterLink className="font-medium text-sky-400 hover:text-sky-300" to={getDetailsPath(row)}>
          {truncateMiddle(row.id, 10, 5)}
        </RouterLink>
      ),
    },
    {
      key: 'kind',
      label: 'Queue',
      render: (row) => (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {row.kind === 'SETTLEMENT' ? 'Settlement' : 'Token Request'}
        </span>
      ),
    },
    { key: 'requestType', label: 'Type', render: (row) => <TypeChip value={row.requestType} /> },
    { key: 'makerLabel', label: 'Maker / Source', render: (row) => row.makerLabel || '-' },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.amount) },
    {
      key: 'status',
      label: 'Status',
      render: () => <StatusChip value="PENDING_APPROVAL" />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(getDetailsPath(row))} size="sm" variant="ghost">
            Approve
          </Button>
          <Button onClick={() => setSelectedRequest(row)} size="sm" variant="danger">
            Reject
          </Button>
        </div>
      ),
    },
  ], [navigate]);

  if (loading) {
    return <LoadingScreen message="Loading pending approvals..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={load} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Review pending maker requests." title="Pending Approvals" />
      <ReserveBalancePanel
        data={reserveBalance}
        error={reserveBalanceError}
        loading={reserveBalanceLoading}
        subtitle="Reference the linked DK Bank fiat reserve balance before opening and approving BTN mint requests."
        title="DK Bank Fiat Reserve"
      />
      <AppTable columns={columns} onRowClick={(row) => navigate(getDetailsPath(row))} pagination={null} rows={requests} />

      <AppDialog
        actions={(
          <>
            <Button disabled={rejectingRequest} onClick={() => setSelectedRequest(null)} variant="outline">Cancel</Button>
            <Button
              disabled={rejectingRequest}
              onClick={async () => {
                try {
                  setRejectingRequest(true);
                  if (!walletConnected || !connectedWalletAddress) {
                    throw new Error('Connect a checker wallet before rejecting this request.');
                  }

                  if (!walletProvider) {
                    throw new Error('Wallet provider is not available.');
                  }

                  const parsed = rejectionSchema.safeParse({
                    rejectionReason,
                    comment: rejectionReason,
                  });
                  if (!parsed.success) {
                    throw new Error(parsed.error.issues[0]?.message || 'Rejection reason is required');
                  }

                  if (selectedRequest.kind === 'SETTLEMENT') {
                    await settlementsApi.reject(selectedRequest.id, parsed.data);
                    enqueueSnackbar('Settlement rejected', { variant: 'success' });
                  } else {
                    const preparedResponse = await tokenRequestsApi.prepareCheckerRejection(selectedRequest.id);
                    const checkerPayload = preparedResponse.data;
                    const builtTransaction = buildCheckerRejectionTransaction({
                      executionPayload: checkerPayload,
                      checkerWalletAddress: connectedWalletAddress,
                    });

                    const txSignature = await signAndSendWalletTransaction({
                      connection: builtTransaction.connection,
                      provider: walletProvider,
                      transaction: builtTransaction.transaction,
                    });

                    await tokenRequestsApi.reject(selectedRequest.id, {
                      ...parsed.data,
                      txSignature,
                      explorerUrl: buildExplorerTransactionUrl(txSignature, checkerPayload.rpcUrl),
                    });
                    enqueueSnackbar('Request rejected with wallet signature', { variant: 'success' });
                  }
                  setSelectedRequest(null);
                  setRejectionReason('');
                  load();
                } catch (rejectError) {
                  enqueueSnackbar(getErrorMessage(rejectError, 'Unable to reject request'), { variant: 'error' });
                } finally {
                  setRejectingRequest(false);
                }
              }}
              variant="danger"
            >
              {rejectingRequest ? 'Processing...' : 'Confirm Reject'}
            </Button>
          </>
        )}
        onClose={() => setSelectedRequest(null)}
        open={Boolean(selectedRequest)}
        title={selectedRequest?.kind === 'SETTLEMENT' ? 'Reject Settlement' : 'Reject Request'}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-200" htmlFor="rejectionReason">Rejection Reason</label>
          <Textarea
            id="rejectionReason"
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={3}
            value={rejectionReason}
          />
        </div>
      </AppDialog>
    </div>
  );
}

export default PendingApprovalsPage;
