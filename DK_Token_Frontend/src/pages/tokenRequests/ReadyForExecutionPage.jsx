import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import Alert from '../../components/ui/Alert';
import AppDialog from '../../components/common/AppDialog';
import AppTable from '../../components/common/AppTable';
import ErrorState from '../../components/common/ErrorState';
import LoadingScreen from '../../components/common/LoadingScreen';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/Button';
import StatusChip from '../../components/common/StatusChip';
import TypeChip from '../../components/common/TypeChip';
import WalletConnectCard from '../../components/wallet/WalletConnectCard';
import { tokenRequestsApi } from '../../modules/tokenRequests/tokenRequests.api';
import { getNextActorMessage } from '../../modules/tokenRequests/tokenRequests.utils';
import { formatAmount, truncateMiddle } from '../../utils/format';
import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES, REQUEST_STATUSES } from '../../utils/constants';

function ReadyForExecutionPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedExecutionPayload, setSelectedExecutionPayload] = useState(null);
  const [selectedExecutionPayloadError, setSelectedExecutionPayloadError] = useState('');
  const [selectedExecutionPayloadLoading, setSelectedExecutionPayloadLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const ready = await tokenRequestsApi.list({ page: 1, limit: 50, status: REQUEST_STATUSES.ON_CHAIN_PENDING });
      setRequests(ready.data.items);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load execution queue.');
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

    async function syncExecutionPayload() {
      if (!selectedRequest || !ON_CHAIN_PENDING_STATUSES.includes(selectedRequest.status)) {
        if (!cancelled) {
          setSelectedExecutionPayload(null);
          setSelectedExecutionPayloadError('');
          setSelectedExecutionPayloadLoading(false);
        }
        return;
      }

      try {
        setSelectedExecutionPayloadLoading(true);
        setSelectedExecutionPayloadError('');
        const response = await tokenRequestsApi.getExecutionPayload(selectedRequest.id);
        if (!cancelled) {
          setSelectedExecutionPayload(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedExecutionPayload(null);
          setSelectedExecutionPayloadError(loadError.message || 'Unable to load execution payload.');
        }
      } finally {
        if (!cancelled) {
          setSelectedExecutionPayloadLoading(false);
        }
      }
    }

    syncExecutionPayload();

    return () => {
      cancelled = true;
    };
  }, [selectedRequest]);

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
    { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      disableRowClick: true,
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(`/token-requests/${row.id}`)} size="sm" variant="ghost">Details</Button>
          <Button onClick={() => setSelectedRequest(row)} size="sm" variant="outline">Execute</Button>
        </div>
      ),
    },
  ], [navigate]);

  if (loading) {
    return <LoadingScreen message="Loading execution queue..." />;
  }

  if (error && !requests.length) {
    return <ErrorState description={error} onAction={load} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Handle requests that are approved, on-chain pending, and ready for browser signing or execution capture." title="On-chain Pending" />
      <WalletConnectCard executionPayload={selectedExecutionPayload} requestStatus={selectedRequest?.status} />
      <AppTable columns={columns} error={error} onRetry={load} onRowClick={(row) => navigate(`/token-requests/${row.id}`)} pagination={null} rows={requests} />

      <AppDialog
        actions={(
          <>
            <Button onClick={() => setSelectedRequest(null)} variant="outline">Cancel</Button>
            <Button onClick={() => navigate(`/token-requests/${selectedRequest.id}`)} variant="secondary">
              Open Request
            </Button>
          </>
        )}
        onClose={() => setSelectedRequest(null)}
        open={Boolean(selectedRequest)}
        title="Execute Request"
      >
        <div className="space-y-3">
          {selectedExecutionPayloadLoading ? <Alert tone="info">Loading execution boundary...</Alert> : null}
          {selectedExecutionPayloadError ? <Alert tone="warning">{selectedExecutionPayloadError}</Alert> : null}
          {selectedExecutionPayload?.walletInitiation?.supported ? (
            <Alert tone={selectedExecutionPayload.walletInitiation.recorded ? 'success' : 'info'}>
              {selectedExecutionPayload.walletInitiation.recorded
                ? 'Maker-side wallet initiation is already recorded. Execution can reuse the on-chain request address.'
                : 'This request is already in the on-chain pending queue and still needs maker-side wallet initiation before final approval.'}
            </Alert>
          ) : null}
          <Alert tone="info">{getNextActorMessage(selectedRequest, selectedExecutionPayload)}</Alert>
          <Alert tone="info">
            {selectedExecutionPayload?.executionMode === EXECUTION_MODES.BROWSER_WALLET
              ? 'The browser wallet flow will finalize the already-recorded on-chain request.'
              : 'The backend will record the execution result for requests still using the server-managed path.'}
          </Alert>
          <p className="text-sm text-zinc-400">
            {selectedExecutionPayload?.walletInitiation?.supported
              ? 'This request can be initiated in the browser by the maker wallet before checker approval.'
              : selectedExecutionPayload?.serverManagedCreateSupported
                ? 'This path still uses the backend-managed maker and checker wallets configured in the backend.'
                : 'Browser wallet connection is available in the UI.'}
          </p>
        </div>
      </AppDialog>
    </div>
  );
}

export default ReadyForExecutionPage;
