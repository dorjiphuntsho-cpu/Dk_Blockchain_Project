import Badge from '../ui/Badge';

function WalletStatusBadge({ connected, address, walletName, mismatch }) {
  const tone = mismatch ? 'amber' : connected ? 'emerald' : 'slate';

  return (
    <Badge tone={tone}>
      {connected ? `${walletName || 'Wallet'}: ${address}` : 'Wallet not connected'}
    </Badge>
  );
}

export default WalletStatusBadge;
