import { useContext } from 'react';

import SolanaContext from '../app/solanaContext';

function useSolanaWallet() {
  const context = useContext(SolanaContext);

  if (!context) {
    throw new Error('useSolanaWallet must be used within SolanaProvider');
  }

  return context;
}

export default useSolanaWallet;
