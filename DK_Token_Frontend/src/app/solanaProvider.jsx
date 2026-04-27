import { useCallback, useEffect, useMemo, useState } from 'react';

import { registerWalletResetHandler } from './sessionManager';
import SolanaContext from './solanaContext';
import { SOLANA_CLUSTER, SOLANA_RPC_URL } from '../utils/constants';

function getAddress(provider) {
  return provider?.publicKey?.toBase58?.() || null;
}

function detectInjectedWallet() {
  if (typeof window === 'undefined') {
    return {
      provider: null,
      walletName: null,
      available: false,
    };
  }

  const phantomProvider = window.phantom?.solana;
  if (phantomProvider?.isPhantom) {
    return {
      provider: phantomProvider,
      walletName: 'Phantom',
      available: true,
    };
  }

  const injectedProvider = window.solana;
  if (injectedProvider) {
    return {
      provider: injectedProvider,
      walletName: injectedProvider.isPhantom ? 'Phantom' : 'Injected Solana Wallet',
      available: true,
    };
  }

  return {
    provider: null,
    walletName: null,
    available: false,
  };
}

function normalizeWalletError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  return error.message || fallbackMessage;
}

function SolanaProvider({ children }) {
  const [providerState, setProviderState] = useState(() => detectInjectedWallet());
  const [connected, setConnected] = useState(Boolean(providerState.provider?.isConnected));
  const [address, setAddress] = useState(() => getAddress(providerState.provider));
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const refreshProvider = useCallback(() => {
    const nextProviderState = detectInjectedWallet();
    setProviderState(nextProviderState);
    setConnected(Boolean(nextProviderState.provider?.isConnected));
    setAddress(getAddress(nextProviderState.provider));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleLoad = () => refreshProvider();
    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, [refreshProvider]);

  useEffect(() => {
    const provider = providerState.provider;
    if (!provider?.on) {
      return undefined;
    }

    const handleConnect = (publicKey) => {
      setConnected(true);
      setAddress(publicKey?.toBase58?.() || getAddress(provider));
      setError('');
    };

    const handleDisconnect = () => {
      setConnected(false);
      setAddress(null);
    };

    const handleAccountChanged = (publicKey) => {
      setConnected(Boolean(publicKey));
      setAddress(publicKey?.toBase58?.() || null);
    };

    provider.on('connect', handleConnect);
    provider.on('disconnect', handleDisconnect);
    provider.on('accountChanged', handleAccountChanged);

    return () => {
      provider.off?.('connect', handleConnect);
      provider.off?.('disconnect', handleDisconnect);
      provider.off?.('accountChanged', handleAccountChanged);
    };
  }, [providerState.provider]);

  useEffect(() => {
    const provider = providerState.provider;
    if (!provider?.connect || providerState.available === false) {
      return undefined;
    }

    let cancelled = false;

    provider.connect({ onlyIfTrusted: true }).catch(() => null).then((response) => {
      if (cancelled || !response?.publicKey) {
        return;
      }

      setConnected(true);
      setAddress(response.publicKey.toBase58());
    });

    return () => {
      cancelled = true;
    };
  }, [providerState.available, providerState.provider]);

  const connect = useCallback(async () => {
    const provider = providerState.provider;
    if (!provider?.connect) {
      setError('No compatible browser wallet detected. Install Phantom or another injected Solana wallet.');
      return null;
    }

    try {
      setConnecting(true);
      const response = await provider.connect();
      const nextAddress = response?.publicKey?.toBase58?.() || getAddress(provider);
      setConnected(Boolean(nextAddress));
      setAddress(nextAddress);
      setError('');
      return nextAddress;
    } catch (connectionError) {
      setError(normalizeWalletError(connectionError, 'Wallet connection was not completed.'));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [providerState.provider]);

  const resetSession = useCallback(async () => {
    const provider = providerState.provider;

    try {
      if (provider?.disconnect) {
        await provider.disconnect();
      }
    } catch {
      // Ignore disconnect errors during session reset.
    } finally {
      setDisconnecting(false);
      setConnecting(false);
      setConnected(false);
      setAddress(null);
      setError('');
    }
  }, [providerState.provider]);

  const disconnect = useCallback(async () => {
    const provider = providerState.provider;
    if (!provider?.disconnect) {
      setConnected(false);
      setAddress(null);
      return;
    }

    try {
      setDisconnecting(true);
      await provider.disconnect();
      setConnected(false);
      setAddress(null);
      setError('');
    } catch (disconnectError) {
      setError(normalizeWalletError(disconnectError, 'Wallet disconnect failed.'));
    } finally {
      setDisconnecting(false);
    }
  }, [providerState.provider]);

  const value = useMemo(() => ({
    provider: providerState.provider,
    walletName: providerState.walletName,
    available: providerState.available,
    connected,
    address,
    connecting,
    disconnecting,
    error,
    rpcUrl: SOLANA_RPC_URL,
    cluster: SOLANA_CLUSTER,
    supportsSignTransaction: typeof providerState.provider?.signTransaction === 'function',
    supportsSignAllTransactions: typeof providerState.provider?.signAllTransactions === 'function',
    connect,
    disconnect,
    refreshProvider,
    clearError: () => setError(''),
  }), [
    address,
    connect,
    connected,
    connecting,
    disconnect,
    disconnecting,
    error,
    providerState.available,
    providerState.provider,
    providerState.walletName,
    refreshProvider,
  ]);

  useEffect(() => {
    const unregister = registerWalletResetHandler(resetSession);
    return unregister;
  }, [resetSession]);

  return (
    <SolanaContext.Provider value={value}>
      {children}
    </SolanaContext.Provider>
  );
}

export default SolanaProvider;
