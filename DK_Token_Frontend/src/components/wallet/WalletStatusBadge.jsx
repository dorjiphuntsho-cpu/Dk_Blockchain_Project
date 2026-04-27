import Badge from '../ui/Badge';

function WalletStatusBadge({ connected, address, walletName, mismatch }) {
  const tone = mismatch ? 'amber' : connected ? 'emerald' : 'slate';

  return (
    <Badge className="max-w-full break-all" tone={tone}>
      {connected ? `${walletName || 'Wallet'}: ${address}` : 'Wallet not connected'}
    </Badge>
  );
}

export default WalletStatusBadge;
