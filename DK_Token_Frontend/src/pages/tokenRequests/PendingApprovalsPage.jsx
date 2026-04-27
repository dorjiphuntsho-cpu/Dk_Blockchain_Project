import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { rejectionSchema } from '../../modules/tokenRequests/tokenRequests.schemas';
import {
  buildCheckerRejectionTransaction,
  buildExplorerTransactionUrl,
  signAndSendWalletTransaction,
} from '../../modules/solana/walletExecution';
import { formatAmount, truncateMiddle } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

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

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await tokenRequestsApi.list({ page: 1, limit: 50, status: 'PENDING_APPROVAL' });
      setRequests(response.data.items);
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
    { key: 'makerUser', label: 'Maker', render: (row) => row.makerUser?.fullName || '-' },
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
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="sm" variant="ghost">Details</Button>
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
      <AppTable columns={columns} onRowClick={(row) => navigate(`/token-requests/${row.id}`)} pagination={null} rows={requests} />

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
        title="Reject Request"
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
