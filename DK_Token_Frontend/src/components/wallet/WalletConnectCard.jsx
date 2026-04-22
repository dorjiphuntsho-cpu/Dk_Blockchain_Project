import { Alert, Button, Stack, Typography } from '@mui/material';

import InfoPanel from '../common/InfoPanel';
import WalletStatusBadge from './WalletStatusBadge';
import { ENABLE_MOCK_API } from '../../utils/constants';

function WalletConnectCard() {
  const usingLiveBackend = !ENABLE_MOCK_API;

  return (
    <InfoPanel
      action={<WalletStatusBadge connected={usingLiveBackend} />}
      subtitle={usingLiveBackend
        ? 'Backend execution is connected to the local validator. Browser wallet signing is still a future step.'
        : 'Execution-related flows are prepared for future browser wallet integration.'}
      title="Solana Wallet Readiness"
    >
      <Stack spacing={2}>
        {usingLiveBackend ? (
          <Alert severity="success" sx={{ backgroundColor: 'success.light', color: 'success.dark', border: 'none' }}>
            Local-validator execution is active through the backend. Transaction signing is currently server-managed for demo flows.
          </Alert>
        ) : (
          <Alert severity="info" sx={{ backgroundColor: 'primary.light', color: 'primary.dark', border: 'none' }}>
            TODO: plug in Solana wallet adapter and browser extension signing flow here.
          </Alert>
        )}
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography color="text.secondary" variant="body2">
            {usingLiveBackend
              ? 'Execution is routed through the backend today. Browser extension signing can be added on top of this later.'
              : 'Wallet connection and signing will stay isolated from the off-chain approval flow.'}
          </Typography>
          <Button disabled variant="outlined">
            {usingLiveBackend ? 'Backend Connected' : 'Connect Wallet'}
          </Button>
        </Stack>
      </Stack>
    </InfoPanel>
  );
}

export default WalletConnectCard;
