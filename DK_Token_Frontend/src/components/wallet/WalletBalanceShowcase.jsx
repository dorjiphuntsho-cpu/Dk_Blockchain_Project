import Badge from '../ui/Badge';

import { truncateMiddle } from '../../utils/format';

function formatHoldingCount(count) {
  return `${count} token${count === 1 ? '' : 's'}`;
}

function getTokenPresentation(balance, tokenMetadataMap) {
  const tokenMetadata = tokenMetadataMap[balance.mintAddress] || {};

  return {
    name: tokenMetadata.name || tokenMetadata.symbol || 'Managed Token',
    subtitle: tokenMetadata.symbol ? `Token • ${tokenMetadata.symbol}` : 'Token',
  };
}

function WalletBalanceShowcase({
  balances = [],
  emptyDescription,
  emptyTitle = 'No token balances',
  showWalletAddress = false,
  tokenMetadataMap = {},
  walletAddress = '',
  walletLabel = '',
}) {
  if (!balances.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900 p-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">{emptyTitle}</h3>
          <p className="text-sm text-zinc-400">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {walletLabel || walletAddress ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold text-white">{walletLabel || 'Wallet Holdings'}</h3>
              {showWalletAddress && walletAddress ? (
                <p className="break-all font-mono text-sm text-zinc-400">{truncateMiddle(walletAddress, 16, 12)}</p>
              ) : null}
            </div>
            <Badge tone="blue">{formatHoldingCount(balances.length)}</Badge>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {balances.map((balance) => {
          const tokenPresentation = getTokenPresentation(balance, tokenMetadataMap);

          return (
            <div
              className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
              key={balance.tokenAccountAddress || balance.mintAddress}
            >
              <div className="border-b border-white/10 bg-zinc-950/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-zinc-500">{tokenPresentation.subtitle}</p>
                    <h4 className="text-sm font-semibold text-white">{tokenPresentation.name}</h4>
                    <p className="break-all text-sm text-zinc-400">{truncateMiddle(balance.mintAddress, 14, 12)}</p>
                  </div>
                  <Badge tone="slate">{balance.amount}</Badge>
                </div>
              </div>
              <div className="space-y-3 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Decimals</span>
                  <span className="font-medium text-white">{balance.decimals}</span>
                </div>
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Raw Amount</span>
                  <span className="break-all font-medium text-white">{balance.rawAmount}</span>
                </div>
                <div className="border-t border-white/10" />
                <div className="space-y-1">
                  <span className="text-zinc-400">Token Account</span>
                  <p className="break-all font-mono text-sm text-zinc-200">{balance.tokenAccountAddress}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WalletBalanceShowcase;
