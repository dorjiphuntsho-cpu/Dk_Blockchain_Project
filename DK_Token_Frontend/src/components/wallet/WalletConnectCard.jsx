import InfoPanel from '../common/InfoPanel';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import WalletStatusBadge from './WalletStatusBadge';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { getNextActorMessage } from '../../modules/tokenRequests/tokenRequests.utils';
import { ENABLE_MOCK_API } from '../../utils/constants';
import { truncateMiddle } from '../../utils/format';

function WalletConnectCard({ executionPayload = null, requestStatus = null }) {
  const usingLiveBackend = !ENABLE_MOCK_API;
  const {
    address,
    available,
    cluster,
    connect,
    connected,
    connecting,
    disconnect,
    disconnecting,
    error,
    rpcUrl,
    supportsSignTransaction,
    walletName,
  } = useSolanaWallet();
  const expectedWalletAddress = executionPayload?.walletInitiation?.expectedMakerWalletAddress || null;
  const mismatch = Boolean(connected && expectedWalletAddress && address && expectedWalletAddress !== address);
  const walletReadyForRequest = !expectedWalletAddress || expectedWalletAddress === address;
  const walletInitSupported = Boolean(executionPayload?.walletInitiation?.supported);
  const walletInitRecorded = Boolean(executionPayload?.walletInitiation?.recorded);

  return (
    <InfoPanel
      action={
        <WalletStatusBadge
          address={connected && address ? truncateMiddle(address, 10, 6) : null}
          connected={connected}
          mismatch={mismatch}
          walletName={walletName}
        />
      }
      subtitle={usingLiveBackend
        ? 'Connect an injected Solana wallet to sign maker submissions and checker decisions for mint, transfer, and burn requests.'
        : 'Mock mode keeps the wallet UI testable even when backend execution is simulated.'}
      title="Solana Wallet Readiness"
    >
      <div className="space-y-3">
        {!usingLiveBackend ? (
          <Alert tone="info">
            Mock API mode is enabled. Wallet state is still available in the UI, but execution remains simulated.
          </Alert>
        ) : null}
        {!available ? (
          <Alert tone="warning">
            No compatible injected Solana wallet was detected. Install Phantom or another browser wallet to test the maker signing flow.
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="error">
            {error}
          </Alert>
        ) : null}
        {connected ? (
          <Alert tone={mismatch ? 'warning' : 'success'}>
            {mismatch
              ? `Connected wallet ${address} does not match the expected maker wallet ${expectedWalletAddress}.`
              : `${walletName || 'Wallet'} is connected${address ? ` as ${address}` : ''}.`}
          </Alert>
        ) : usingLiveBackend ? (
          <Alert tone="info">
            Connect the active role wallet here before submitting maker requests or signing checker decisions.
          </Alert>
        ) : null}
        {walletInitSupported ? (
          <Alert tone={walletInitRecorded ? 'success' : walletReadyForRequest ? 'info' : 'warning'}>
            {walletInitRecorded
              ? 'Maker-side wallet initiation has already been recorded for this request.'
              : walletReadyForRequest
                ? 'This request is wallet-initiation-ready. Use the request action bar to sign and submit the maker initiation transaction.'
                : 'This request expects a different maker wallet than the one currently connected.'}
          </Alert>
        ) : null}
        {requestStatus ? (
          <Alert tone="info">
            {getNextActorMessage({ status: requestStatus }, executionPayload)}
          </Alert>
        ) : null}
        {executionPayload ? (
          <div className="space-y-1 text-sm text-zinc-400">
            <p>
              Cluster: {cluster}
            </p>
            <p>
              RPC: {executionPayload.rpcUrl || rpcUrl}
            </p>
            <p>
              Signer Support: {supportsSignTransaction ? 'Transaction signing available' : 'Read-only or unsupported wallet'}
            </p>
            {expectedWalletAddress ? (
              <p>
                Expected Maker Wallet: {expectedWalletAddress}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">
            {connected
              ? 'The wallet connection is now shared across the app, so request pages can validate signer readiness without reconnect prompts.'
              : 'Connect once here and the request pages will reuse that wallet state.'}
          </p>
          {connected ? (
            <Button disabled={disconnecting} onClick={disconnect} size="sm" variant="outline">
              {disconnecting ? 'Disconnecting...' : 'Disconnect Wallet'}
            </Button>
          ) : (
            <Button disabled={!available || connecting} onClick={connect} size="sm" variant="secondary">
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </div>
      </div>
    </InfoPanel>
  );
}

export default WalletConnectCard;
