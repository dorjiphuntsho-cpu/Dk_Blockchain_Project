# Token Management Admin Portal Frontend

Production-oriented React admin portal for an off-chain token management system. The frontend is designed for maker-checker workflows today and future Solana testnet backend plus browser wallet integration later.

## Tech Stack

- React
- Vite
- JavaScript
- React Router DOM
- Material UI
- Axios
- Zustand
- React Hook Form
- Zod
- dayjs
- notistack

## Core Capabilities

- Login and authenticated access flow
- Role-based navigation and route protection
- Dashboard with request metrics and quick actions
- User and role management
- Wallet management
- Token request creation for `MINT`, `TRANSFER`, and `BURN`
- Maker-checker approval workflow UI
- Ready-for-execution and execution recording views
- Audit log browsing
- Mock API mode for local frontend development without the backend
- Wallet connection placeholder components for future Solana integration

## Roles Supported

- `ADMIN`
- `MAKER`
- `CHECKER`
- `EXECUTOR`

The UI conditionally renders routes, sidebar items, tables, and action buttons based on the signed-in user role set.

## Project Structure

```text
src/
  app/
    router.jsx
    store.js
    theme.js
  components/
    auth/
    common/
    form/
    wallet/
  hooks/
  layouts/
  modules/
    auth/
    users/
    wallets/
    tokenRequests/
    auditLogs/
  pages/
    auth/
    dashboard/
    users/
    wallets/
    tokenRequests/
    auditLogs/
    notFound/
  services/
    axiosClient.js
    mockAdapter.js
  utils/
  App.jsx
  main.jsx
```

## Main Pages

- `/login`
- `/dashboard`
- `/users`
- `/users/new`
- `/users/:id`
- `/wallets`
- `/wallets/new`
- `/wallets/:id`
- `/token-requests`
- `/token-requests/new`
- `/token-requests/:id`
- `/my-requests`
- `/pending-approvals`
- `/ready-for-execution`
- `/audit-logs`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Start the app:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Environment Variables

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ENABLE_MOCK_API=true
```

- `VITE_API_BASE_URL` is used when mock mode is disabled.
- `VITE_ENABLE_MOCK_API=true` keeps the frontend fully runnable with local mock data.

## Mock Mode

Mock mode is enabled by default.

When enabled, the app uses `src/services/mockAdapter.js` instead of calling the backend. It supports:

- fake login
- current user lookup
- list/create/update users
- assign roles
- list/create/update wallets
- create/update/submit token requests
- approve/reject token requests
- mark requests ready
- record execution results
- list audit logs
- dashboard summary metrics

Mock data is persisted in browser `localStorage`, so actions survive refreshes in the same browser profile.

## Mock Credentials

- `admin@example.com / Admin@123`
- `maker@example.com / Maker@123`
- `checker@example.com / Checker@123`
- `executor@example.com / Executor@123`

## API Integration Notes

The frontend is structured so real backend integration can be added without major UI refactoring.

- `src/services/axiosClient.js` handles base URL and auth token injection.
- Feature API files live under `src/modules/*/*.api.js`.
- The app decides between Axios and mock mode at the API-module layer.
- Auth state is stored in Zustand with persistence.

To switch to the real backend:

1. set `VITE_ENABLE_MOCK_API=false`
2. point `VITE_API_BASE_URL` to the backend
3. confirm endpoint contracts match the current response shape

## Workflow Notes

### MAKER

- create draft token requests
- edit draft requests
- submit requests for approval
- view own requests

### CHECKER

- review pending approval queue
- approve requests
- reject requests with reason

### ADMIN / EXECUTOR

- view approved and ready requests
- mark approved requests as ready
- record execution results

### ADMIN

- manage users
- assign roles
- manage wallets
- view audit logs
- view all requests

## Design Notes

- MUI-based enterprise admin layout
- left sidebar, top app bar, main content area
- reusable tables, dialogs, drawers, and form inputs
- strong status visibility through chips and timeline views
- desktop-first but responsive

## Current Solana Wallet Integration

The frontend now includes lightweight injected-wallet support plus maker-side wallet initiation for transfer and burn requests.

Current coverage:

- app-level Solana wallet provider with shared connection state
- `WalletConnectCard` connect and disconnect flow for Phantom-compatible injected wallets
- `WalletStatusBadge` with connected address and mismatch warnings
- wallet-aware execution context on request detail and ready-for-execution screens
- maker-side transaction building and submission for transfer and burn initiation

Still deferred to the next phase:

- end-to-end browser-wallet execution flow
- browser-wallet handling for mint flows

## Notes for Windows and WSL

This frontend itself is cross-platform, but if you install dependencies in one environment and run in another, native modules elsewhere in your repo may fail. For consistent frontend behavior, use the same environment for install and run where possible.
