# DK Frontend

React + Vite frontend for the DK token app.

This frontend works with:

- `dk-token` for the Solana program/blockchain instructions
- `dk-backend` for PostgreSQL-backed users and mint request history

## Environment

Create:

```text
.env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:5000
```

If this value is not set, the frontend defaults to:

```text
http://localhost:5000
```

## Run

Start backend first:

```bash
cd ../dk-backend
npm start
```

Start frontend:

```bash
cd ../dk-frontend
npm run dev
```

## Backend Integration Added

The frontend now uses:

```text
src/services/api.js
```

for these backend calls:

```text
POST  /users
GET   /users/wallet/:wallet
GET   /token-config
PUT   /token-config
GET   /mint-requests
POST  /mint-requests
PATCH /mint-requests/:id/approve
PATCH /mint-requests/:id/reject
```

## Current Flow

When the app loads:

- it fetches the saved config address and mint address from `dk-backend`
- after wallet connection, it fetches the on-chain `Config` account
- it derives admin/checker authority from the smart contract state
- it fetches saved mint requests from `dk-backend`
- it shows saved mint requests in dashboard/history
- when a wallet connects, it looks up that wallet in `/users/wallet/:wallet`
- if the wallet exists in the backend, its role is shown as an optional label

## Role Registration

The Setup tab includes an optional backend role panel.

Use it to register the connected wallet as:

```text
Maker
Checker
User
Admin
```

Flow:

- connect wallet
- open `Setup`
- choose a role
- click `Register Wallet`
- the frontend calls `POST /users`
- the role appears as a backend label after success

If the wallet already exists, the backend returns a duplicate wallet error. Use the existing registered role or test with a different wallet.

## Smart Contract Authority

Authority now follows the `dk-token` smart contract, not the optional backend role label.

```text
Config.admin       -> can create the mint
Config.checkers    -> can approve or reject mint requests
Any wallet signer  -> can create a mint request as maker
Maker              -> cannot approve their own request
```

The frontend loads the on-chain `Config` account and derives the connected wallet's authority from:

```text
config.admin
config.checkers
```

The backend `User.role` is only a dashboard label. It does not grant smart-contract permission.

## Checker Workspace

The dashboard now has a dedicated `Checker Queue`.

For a wallet listed in `config.checkers`:

- pending mint requests appear in the queue
- each pending request has `Approve` and `Reject` actions
- the action targets that exact request address, not only the latest request
- after the on-chain transaction succeeds, the backend record is updated with the final status and transaction signature

For a wallet that is not in `config.checkers`:

- the queue is visible
- review buttons are disabled
- the UI points the user to `Setup` to view the active checker list

When a mint request is created:

- the Solana program creates the request on-chain
- the frontend saves the request address, maker wallet, and amount to `dk-backend`
- the request appears as `Pending`

When system setup runs:

- `Initialize System` creates the on-chain config account
- the frontend saves `configAddr` to `dk-backend`
- `Create Mint` creates the on-chain mint account
- the frontend saves `mintAddr` to `dk-backend`
- refreshing the frontend reloads both addresses from `/token-config`

When a request is approved or rejected:

- the Solana program updates the request on-chain
- the frontend updates the matching backend record with status and transaction signature

## Build Check

Run:

```bash
npm run build
```

The latest build passed successfully.
