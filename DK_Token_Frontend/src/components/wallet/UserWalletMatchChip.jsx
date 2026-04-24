import useAuth from '../../hooks/useAuth';
import useSolanaWallet from '../../hooks/useSolanaWallet';
import { truncateMiddle } from '../../utils/format';
import Badge from '../ui/Badge';

function UserWalletMatchChip() {
  const { user } = useAuth();
  const { address, connected, walletName } = useSolanaWallet();

  const userWallets = user?.wallets || [];
  const exactWallet = userWallets.find((wallet) => wallet.walletAddress === address);
  const matchedWallet = exactWallet?.isActive ? exactWallet : null;

  let label = 'Wallet not connected';
  let tooltip = 'Connect Phantom to compare against your saved wallet records.';
  let tone = 'slate';

  if (connected && address) {
    if (matchedWallet) {
      label = `Wallet matched: ${truncateMiddle(address, 6, 4)}`;
      tooltip = `Connected ${walletName || 'wallet'} matches your saved wallet "${matchedWallet.label || matchedWallet.walletAddress}".`;
      tone = 'emerald';
    } else if (exactWallet) {
      label = `Wallet linked but inactive: ${truncateMiddle(address, 6, 4)}`;
      tooltip = `This Phantom wallet is saved to your account as "${exactWallet.label || exactWallet.walletAddress}", but it is currently inactive. Activate it in Wallets or use an active linked wallet.`;
      tone = 'amber';
    } else {
      label = `Wallet not linked: ${truncateMiddle(address, 6, 4)}`;
      tooltip = 'The connected Phantom wallet is not assigned to your account.';
      tone = 'amber';
    }
  } else if (userWallets.length) {
    label = `${userWallets.length} linked wallet${userWallets.length === 1 ? '' : 's'}`;
    tooltip = 'Your account has wallet records, but none is connected right now.';
    tone = 'blue';
  } else {
    label = 'No linked wallets';
    tooltip = 'No wallet records are linked to this user.';
    tone = 'amber';
  }

  return (
    <span title={tooltip}>
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}

export default UserWalletMatchChip;
