import { Alert, Button, Stack, Typography } from '@mui/material';

import InfoPanel from '../common/InfoPanel';
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
      <Stack spacing={2}>
        {!usingLiveBackend ? (
          <Alert severity="info" sx={{ backgroundColor: 'primary.light', color: 'primary.dark', border: 'none' }}>
            Mock API mode is enabled. Wallet state is still available in the UI, but execution remains simulated.
          </Alert>
        ) : null}
        {!available ? (
          <Alert severity="warning" sx={{ border: 'none' }}>
            No compatible injected Solana wallet was detected. Install Phantom or another browser wallet to test the maker signing flow.
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ border: 'none' }}>
            {error}
          </Alert>
        ) : null}
        {connected ? (
          <Alert severity={mismatch ? 'warning' : 'success'} sx={{ border: 'none' }}>
            {mismatch
              ? `Connected wallet ${address} does not match the expected maker wallet ${expectedWalletAddress}.`
              : `${walletName || 'Wallet'} is connected${address ? ` as ${address}` : ''}.`}
          </Alert>
        ) : usingLiveBackend ? (
          <Alert severity="info" sx={{ border: 'none' }}>
            Connect the active role wallet here before submitting maker requests or signing checker decisions.
          </Alert>
        ) : null}
        {walletInitSupported ? (
          <Alert severity={walletInitRecorded ? 'success' : walletReadyForRequest ? 'info' : 'warning'} sx={{ border: 'none' }}>
            {walletInitRecorded
              ? 'Maker-side wallet initiation has already been recorded for this request.'
              : walletReadyForRequest
                ? 'This request is wallet-initiation-ready. Use the request action bar to sign and submit the maker initiation transaction.'
                : 'This request expects a different maker wallet than the one currently connected.'}
          </Alert>
        ) : null}
        {requestStatus ? (
          <Alert severity="info" sx={{ border: 'none' }}>
            {getNextActorMessage({ status: requestStatus }, executionPayload)}
          </Alert>
        ) : null}
        {executionPayload ? (
          <Stack spacing={0.75}>
            <Typography color="text.secondary" variant="body2">
              Cluster: {cluster}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              RPC: {executionPayload.rpcUrl || rpcUrl}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Signer Support: {supportsSignTransaction ? 'Transaction signing available' : 'Read-only or unsupported wallet'}
            </Typography>
            {expectedWalletAddress ? (
              <Typography color="text.secondary" variant="body2">
                Expected Maker Wallet: {expectedWalletAddress}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography color="text.secondary" variant="body2">
            {connected
              ? 'The wallet connection is now shared across the app, so request pages can validate signer readiness without reconnect prompts.'
              : 'Connect once here and the request pages will reuse that wallet state.'}
          </Typography>
          {connected ? (
            <Button disabled={disconnecting} onClick={disconnect} variant="outlined">
              {disconnecting ? 'Disconnecting...' : 'Disconnect Wallet'}
            </Button>
          ) : (
            <Button disabled={!available || connecting} onClick={connect} variant="contained">
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </Stack>
      </Stack>
    </InfoPanel>
  );
}

export default WalletConnectCard;
