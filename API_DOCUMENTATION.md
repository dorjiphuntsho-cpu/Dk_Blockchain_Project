# API Documentation

Base URL: `http://localhost:5000/api`

## Common Response Format

Success responses:

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "message": "...",
  "errors": [ ... ]
}
```

## Authentication

### POST /auth/login

- Request: `{ "email": string, "password": string }`
- Response: `{ token, user }`
- Notes: Issues JWT for portal access.

### GET /auth/me

- Auth required
- Response: authenticated user profile

### POST /auth/customer-login

- Request: `{ "email": string, "password": string }`
- Response: customer portal user data

### GET /auth/customer-portal-summary

- Auth required
- Response: summary information for a customer portal session

## Users

### POST /users

- Request: create user payload
- Auth: admin or authorized creation flow

### GET /users

- Query params: pagination, filters
- Response: paginated user list

### GET /users/:id

- Response: user details

### PATCH /users/:id

- Request: update user fields

### PATCH /users/:id/status

- Request: toggle active/inactive

### POST /users/:id/roles

- Request: assign roles to user

## Roles

### GET /roles

- Auth: admin only
- Response: available role names

## Wallets

### POST /wallets

- Request: create a wallet record
- Auth: admin only

### GET /wallets

- Query params: userId, isPrimary, isActive

### GET /wallets/:id

- Response: wallet metadata

### GET /wallets/by-address/:walletAddress

- Lookup wallet by address

### PATCH /wallets/:id

- Request: update wallet metadata

### PATCH /wallets/:id/status

- Request: toggle wallet active state

## Token Requests

### POST /token-requests

- Create a token request: mint, transfer, or burn
- Auth: maker

### GET /token-requests

- Query params: status, makerUserId, checkerUserId, page, limit

### GET /token-requests/:id

- Response: token request details

### PATCH /token-requests/:id

- Auth: maker
- Request: update draft or editable fields

### POST /token-requests/:id/submit

- Auth: maker
- Transitions request from draft to pending approval

### POST /token-requests/:id/cancel

- Auth: maker

### POST /token-requests/:id/mark-ready

- Auth: admin, executor

### GET /token-requests/:id/execution-payload

- Auth: admin, maker, checker, executor
- Response: Solana execution payload for client or server execution

### GET /token-requests/:id/prepare/mint-request

- Auth: admin, maker
- Response: mint request preparation data

### GET /token-requests/:id/prepare/transfer-request

- Auth: admin, maker

### GET /token-requests/:id/prepare/burn-request

- Auth: admin, maker

### GET /token-requests/:id/prepare/maker-cancel

- Auth: maker

### GET /token-requests/:id/prepare/checker-approval

- Auth: admin, checker

### GET /token-requests/:id/prepare/checker-rejection

- Auth: admin, checker

### POST /token-requests/:id/record-initiation

- Auth: maker

### POST /token-requests/:id/record-cancellation

- Auth: maker

### POST /token-requests/:id/execute

- Auth: admin, executor

### POST /token-requests/:id/record-execution

- Auth: admin, checker, executor

## Approvals

### POST /token-requests/:id/approve

- Auth: checker
- Request: optional comment

### POST /token-requests/:id/reject

- Auth: checker

## Solana Management

### GET /solana/config-status

- Response: current on-chain Solana config status

### GET /solana/prepare/mint-creation

- Response: preparation data for a new mint

### POST /solana/token-mints

- Create a new token mint record

### POST /solana/token-mints/record

- Record metadata for an already-created mint

### POST /solana/checkers

- Add a checker wallet to on-chain config

### DELETE /solana/checkers/:checkerAddress

- Remove a checker from on-chain config

### POST /solana/treasury-accounts

- Add a treasury account to Solana config

### DELETE /solana/treasury-accounts/:treasuryAccountAddress

- Remove a treasury account from Solana config

### POST /solana/admin

- Change the on-chain admin wallet address

## Managed Tokens

### GET /managed-tokens

- Query list of managed token metadata

### GET /managed-tokens/:id

- Auth: admin and browser wallet flows

## Banks

### GET /banks

- Query banks with optional filters

### GET /banks/:id

- Bank details and nested accounts

### PATCH /banks/:id

- Update bank metadata

### POST /banks/:id/accounts

- Create a bank account

### PATCH /banks/:id/accounts/:accountId

- Update bank account metadata

### POST /banks/:id/token-accounts

- Create a bank token account record

### PATCH /banks/:id/token-accounts/:tokenAccountId

- Update bank token account metadata

## Reserves

### GET /reserves

- Query reserve ledger entries

### POST /reserves

- Create or allocate reserve ledger entries

### POST /reserves/:id/approve

- Approve reserve adjustments

### POST /reserves/:id/consume

- Mark reserve amount as consumed

### POST /reserves/:id/release

- Release locked reserve amounts

## Settlements

### GET /settlements

- Query settlement requests and statuses

### GET /settlements/:id

- Get settlement request details

### POST /settlements

- Create new settlement requests for BIPS/BTN flows

### POST /settlements/:id/approve

- Approve settlement requests

### POST /settlements/:id/reject

- Reject settlement requests

### POST /settlements/:id/execute

- Execute settlement or route to payment provider

### GET /settlements/:id/status

- Retrieve settlement status and transaction metadata

## BIPS

### POST /bips/account-inquiry

- Perform beneficiary or source account inquiry via BIPS integration

### POST /bips/outgoing

- Send outgoing BIPS transfer

### GET /bips/status

- Query BIPS gateway transaction status

### GET /bips/live-inquiry

- Live payment inquiry for ongoing BIPS transactions

## CBS

### POST /cbs/account-inquiry

- Perform account inquiry against the core banking system

### GET /cbs/token-signature

- Retrieve a signing key or token required for CBS operations

## Payments

The payments API contains a broad gateway integration surface. Specific endpoints are implemented in `backend/src/routes/payments.routes.js`.

## Audit Logs

### GET /audit-logs

- Query audit trail entries with pagination and filters

## Validation Rules

Most request bodies and query strings are validated through Zod schemas in `backend/src/validators`.

## Errors

- `400` validation or bad request
- `401` unauthorized
- `403` forbidden
- `404` resource not found
- `409` conflict / unique constraint failure
- `500` server error
