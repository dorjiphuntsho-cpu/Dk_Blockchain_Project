import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SnackbarProvider } from 'notistack';

import App from './App';
import SolanaProvider from './app/solanaProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <SolanaProvider>
        <App />
      </SolanaProvider>
    </SnackbarProvider>
  </React.StrictMode>,
);
