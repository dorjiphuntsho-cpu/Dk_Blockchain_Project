import { Chip, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import useAuth from '../../hooks/useAuth';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { truncateMiddle } from '../../utils/format';

function UserWalletMatchChip() {
  const theme = useTheme();
  const { user } = useAuth();
  const { address, connected, walletName } = useSolanaWallet();

  const userWallets = user?.wallets || [];
  const exactWallet = userWallets.find((wallet) => wallet.walletAddress === address);
  const matchedWallet = exactWallet?.isActive ? exactWallet : null;

  let label = 'Wallet not connected';
  let tooltip = 'Connect Phantom to compare against your saved wallet records.';
  let color = theme.palette.text.secondary;

  if (connected && address) {
    if (matchedWallet) {
      label = `Wallet matched: ${truncateMiddle(address, 6, 4)}`;
      tooltip = `Connected ${walletName || 'wallet'} matches your saved wallet "${matchedWallet.label || matchedWallet.walletAddress}".`;
      color = theme.palette.success.main;
    } else if (exactWallet) {
      label = `Wallet linked but inactive: ${truncateMiddle(address, 6, 4)}`;
      tooltip = `This Phantom wallet is saved to your account as "${exactWallet.label || exactWallet.walletAddress}", but it is currently inactive. Activate it in Wallets or use an active linked wallet.`;
      color = theme.palette.warning.main;
    } else {
      label = `Wallet not linked: ${truncateMiddle(address, 6, 4)}`;
      tooltip = 'The connected Phantom wallet is not assigned to your account.';
      color = theme.palette.warning.main;
    }
  } else if (userWallets.length) {
    label = `${userWallets.length} linked wallet${userWallets.length === 1 ? '' : 's'}`;
    tooltip = 'Your account has wallet records, but none is connected right now.';
    color = theme.palette.info.main;
  } else {
    label = 'No linked wallets';
    tooltip = 'No wallet records are linked to this user.';
    color = theme.palette.warning.main;
  }

  return (
    <Tooltip title={tooltip}>
      <Chip
        label={label}
        size="small"
        sx={{
          backgroundColor: alpha(color, 0.12),
          color,
        }}
      />
    </Tooltip>
  );
}

export default UserWalletMatchChip;
