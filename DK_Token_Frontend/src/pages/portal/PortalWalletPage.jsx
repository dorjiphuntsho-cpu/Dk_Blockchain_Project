import { useEffect, useState } from 'react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import usePortalAuth from '../../hooks/usePortalAuth';
import { portalApi } from '../../modules/portal/portal.api';
import { getErrorMessage } from '../../utils/error';
import { SOLANA_RPC_URL } from '../../utils/constants';
import { formatAmount, truncateMiddle } from '../../utils/format';

function buildExplorerAddressUrl(address) {
  const customUrl = encodeURIComponent(SOLANA_RPC_URL);
  return `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${customUrl}`;
}

function PortalWalletPage() {
  const { customer, token } = usePortalAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      if (!token) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await portalApi.getSummary(token);

        if (isMounted) {
          setSummary(response.data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError, 'Unable to load wallet details'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const tokenSummary = summary?.token || null;
  const walletBalances = Array.isArray(summary?.walletBalances) ? summary.walletBalances : [];
  const primaryWalletAddress = summary?.customer?.primaryWalletAddress || customer?.wallets?.[0]?.walletAddress || null;
  const tokenSymbol = tokenSummary?.symbol || 'BTN';
  const btnBalance = summary?.customer?.btnBalance != null
    ? `${formatAmount(summary.customer.btnBalance)} ${tokenSymbol}`
    : `0 ${tokenSymbol}`;
  const primaryWalletExplorerUrl = primaryWalletAddress ? buildExplorerAddressUrl(primaryWalletAddress) : null;
  const mintExplorerUrl = tokenSummary?.mintAddress ? buildExplorerAddressUrl(tokenSummary.mintAddress) : null;

  return (
    <div className="grid gap-4">
      <Card className="border-white/8 bg-[#14151A]">
        <p className="fintech-label text-[#F0B90B]">Customer wallet</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Wallet balance and token accounts</h2>
        <p className="mt-2 text-sm text-[#848E9C]">
          Review the linked wallet address, current BTN holdings, and token accounts currently visible to the portal.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-[#1B1F24] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Primary wallet</p>
            <p className="mt-3 break-all text-sm font-medium text-white">
              {loading ? 'Loading...' : (primaryWalletAddress || 'Not linked')}
            </p>
            {primaryWalletExplorerUrl ? (
              <div className="mt-4">
                <Button as="a" href={primaryWalletExplorerUrl} rel="noreferrer" size="sm" target="_blank" variant="outline">
                  View wallet on explorer
                </Button>
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-white/8 bg-[#1B1F24] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">BTN held</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? 'Loading...' : btnBalance}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#1B1F24] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Tracked token accounts</p>
            <p className="mt-3 text-2xl font-semibold text-white">{loading ? 'Loading...' : walletBalances.length}</p>
          </div>
        </div>
      </Card>

      <Card className="border-white/8 bg-[#14151A]">
        <p className="fintech-label">Token holdings</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">Wallet token inventory</h3>
        {mintExplorerUrl ? (
          <div className="mt-4">
            <Button as="a" href={mintExplorerUrl} rel="noreferrer" size="sm" target="_blank" variant="outline">
              View BTN mint on explorer
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Loading wallet balances...</p>
        ) : walletBalances.length ? (
          <div className="mt-4 grid gap-3">
            {walletBalances.map((balance) => (
              <div className="rounded-xl border border-white/8 bg-[#1B1F24] p-3" key={balance.tokenAccountAddress}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {balance.mintAddress === tokenSummary?.mintAddress ? `${tokenSymbol} token account` : 'SPL token account'}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Mint {truncateMiddle(balance.mintAddress, 10, 8)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatAmount(balance.amount)} {balance.mintAddress === tokenSummary?.mintAddress ? tokenSymbol : ''}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-400">
                  <p>Token account: <span className="break-all text-zinc-200">{balance.tokenAccountAddress}</span></p>
                  <p>Raw amount: <span className="text-zinc-200">{balance.rawAmount}</span></p>
                  <p>Decimals: <span className="text-zinc-200">{balance.decimals}</span></p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    as="a"
                    href={buildExplorerAddressUrl(balance.tokenAccountAddress)}
                    rel="noreferrer"
                    size="sm"
                    target="_blank"
                    variant="outline"
                  >
                    View token account
                  </Button>
                  <Button
                    as="a"
                    href={buildExplorerAddressUrl(balance.mintAddress)}
                    rel="noreferrer"
                    size="sm"
                    target="_blank"
                    variant="outline"
                  >
                    View mint
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm leading-7 text-zinc-400">
            No token accounts are visible for this wallet yet. If BTN was just delivered, refresh after the transfer confirms on chain.
          </p>
        )}
      </Card>
    </div>
  );
}

export default PortalWalletPage;
