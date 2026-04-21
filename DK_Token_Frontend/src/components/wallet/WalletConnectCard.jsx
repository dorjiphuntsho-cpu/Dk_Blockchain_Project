import { Alert, Button, Stack, Typography } from '@mui/material';

import InfoPanel from '../common/InfoPanel';
import WalletStatusBadge from './WalletStatusBadge';

function WalletConnectCard() {
  return (
    <InfoPanel
      action={<WalletStatusBadge connected={false} />}
      subtitle="Execution-related flows are prepared for future browser wallet integration."
      title="Solana Wallet Readiness"
    >
      <Stack spacing={2}>
        <Alert severity="info" sx={{ backgroundColor: 'primary.light', color: 'primary.dark', border: 'none' }}>
          TODO: plug in Solana wallet adapter and browser extension signing flow here.
        </Alert>
        <Stack
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography color="text.secondary" variant="body2">
            Wallet connection and signing will stay isolated from the off-chain approval flow.
          </Typography>
          <Button disabled variant="outlined">
            Connect Wallet
          </Button>
        </Stack>
      </Stack>
    </InfoPanel>
  );
}

export default WalletConnectCard;
