# DK Blockchain Project Codebase Map

This README is a practical map of how the main project folders and files connect.

The active project is built from three main parts:

```text
dk-token     = Solana Anchor smart contract for DKT token rules
dk-backend   = Express + Prisma + PostgreSQL API and bank/CBS integration
dk-frontend  = React + Vite browser app used by bank/admin/checker/user
```

The short internal flow is:

```text
User works in dk-frontend
-> frontend calls dk-token for on-chain token actions
-> frontend calls dk-backend for saved app records and bank/CBS work
-> backend stores records in PostgreSQL
-> backend calls CBS UAT and DKPG/bank APIs for FIAT payout
```

## Root Project Files

```text
README.md
```

General project notes, Solana commands, local validator notes, and original flow notes.

```text
PROJECT_ARCHITECTURE.md
```

Business and system architecture explanation. This is the high-level project flow document.

```text
PROJECT_CODEBASE_README.md
```

This file. It explains folders, key files, and internal relationships.

```text
accountRESAPI.md
```

Working notes for account/CBS/API testing.

## Main Folder Responsibilities

### `dk-token`

This folder contains the Solana Anchor program.

It controls the real blockchain-side DKT rules:

- system initialization
- admin wallet
- checker wallets
- DKT mint
- mint requests
- request approval/rejection
- token minting
- token transfer
- token burn

Important files:

```text
dk-token/Anchor.toml
dk-token/programs/dk-token/src/lib.rs
dk-token/programs/dk-token/src/error.rs
dk-token/programs/dk-token/src/state/config.rs
dk-token/programs/dk-token/src/state/mint_request.rs
dk-token/tests/dk-token.ts
```

### `dk-backend`

This folder contains the API server.

It stores off-chain project records and talks to external bank systems.

It stores:

- registered users
- registered banks
- saved token config
- mint request history
- TOKEN and FIAT settlements
- CBS and DKPG payout tracking IDs

It calls:

- CBS UAT auth/sign-key/account inquiry APIs
- DKPG/bank auth/sign-key/beneficiary inquiry/fund transfer/status APIs

Important files:

```text
dk-backend/src/server.js
dk-backend/src/routes/
dk-backend/src/controllers/
dk-backend/src/services/cbsApi.service.js
dk-backend/src/services/bankApi.service.js
dk-backend/src/prisma.js
dk-backend/prisma/schema.prisma
dk-backend/scripts/
```

### `dk-frontend`

This folder contains the browser UI.

It connects Phantom wallet, calls the Anchor program, and calls the backend API.

It lets users:

- initialize token config
- create DKT mint
- register banks
- register users
- create mint requests
- approve/reject mint requests
- send DKT to registered receivers
- burn DKT and trigger FIAT payout for unregistered receivers
- view CBS account details
- view settlement history

Important files:

```text
dk-frontend/src/App.jsx
dk-frontend/src/services/api.js
dk-frontend/src/utils/anchor.js
dk-frontend/src/idl/dk_token.json
dk-frontend/src/App.css
dk-frontend/src/main.jsx
```

## `dk-token` File Details

### `dk-token/programs/dk-token/src/lib.rs`

Main Anchor program file.

This file defines the on-chain instructions:

```text
initialize(checkers)
create_mint()
create_metadata(name, symbol, uri)
update_metadata(name, symbol, uri)
create_mint_request(amount)
approve_request()
reject_request()
transfer_tokens(amount)
burn_tokens(amount)
```

Internal meaning:

- `initialize` creates the config account and saves admin/checkers.
- `create_mint` saves the DKT mint in config.
- `create_mint_request` creates an on-chain request with `Pending` status.
- `approve_request` checks checker authority and mints DKT to the maker.
- `reject_request` marks a request rejected.
- `transfer_tokens` moves DKT between token accounts.
- `burn_tokens` burns DKT from the caller token account.

### `dk-token/programs/dk-token/src/state/config.rs`

Defines the on-chain config account:

```text
admin     = wallet allowed to create/save mint
mint      = DKT mint address
checkers  = wallets allowed to approve/reject mint requests
```

### `dk-token/programs/dk-token/src/state/mint_request.rs`

Defines the on-chain mint request account:

```text
config   = related config account
maker    = wallet requesting DKT
checker  = wallet that approved/rejected
amount   = requested token amount
status   = Pending / Approved / Rejected
```

### `dk-token/programs/dk-token/src/error.rs`

Custom program errors such as unauthorized checker, invalid config, already processed request, and self-approval not allowed.

### `dk-token/tests/dk-token.ts`

Anchor test area for program behavior.



## `dk-backend` File Details

### `dk-backend/src/server.js`

Express app entrypoint.

It mounts these backend route groups:

```text
/banks
/cbs
/mock-bank
/users
/mint-requests
/settlements
/token-config
```

It also serves a simple root page at:

```text
GET http://localhost:5000/
```

### `dk-backend/src/prisma.js`

Creates the Prisma client used by controllers.

This is the database bridge between backend code and PostgreSQL.

### `dk-backend/prisma/schema.prisma`

Defines the backend database models:

```text
User
Bank
TokenConfig
MintRequest
Settlement
```

Important relationships:

```text
Bank -> MintRequest[]
Bank -> Settlement[]
MintRequest -> optional Bank
Settlement -> required Bank
```

Important settlement tracking fields:

```text
cbsProductType
bankReference
bankInquiryId
bankTransactionId
bankApiStatus
bankApiMessage
bankStatusCheckedAt
```

These fields let the app remember which bank/CBS operation happened after a FIAT payout.

### `dk-backend/src/routes/`

Routes define public backend URLs.

They are thin files that connect URLs to controllers.

```text
bank.routes.js          -> /banks
cbs.routes.js           -> /cbs
mintRequest.routes.js   -> /mint-requests
settlement.routes.js    -> /settlements
tokenConfig.routes.js   -> /token-config
user.routes.js          -> /users
mockBank.routes.js      -> /mock-bank
bankGateway.routes.js   -> /mock-bank/v1 mock gateway endpoints
```

### `dk-backend/src/controllers/`

Controllers handle request validation, database writes, and response shape.

Key controllers:

```text
bank.controller.js
```

Creates banks, lists banks, finds a bank by wallet, and updates fiat reserve.

```text
user.controller.js
```

Creates users, lists users, and checks whether a wallet is registered.

```text
tokenConfig.controller.js
```

Stores frontend-known token addresses:

```text
adminAddr
configAddr
mintAddr
checkers
```

```text
mintRequest.controller.js
```

Stores off-chain mint request history and approval/rejection status.

```text
settlement.controller.js
```

Handles TOKEN/FIAT settlement records.

Important functions:

```text
createSettlement()
createUnregisteredFiatSettlement()
refreshSettlementStatus()
getSettlements()
```

This is where FIAT payout is triggered from backend.

```text
cbs.controller.js
```

Provides backend CBS routes:

```text
GET  /cbs/test-accounts
POST /cbs/account-inquiry
```

### `dk-backend/src/services/cbsApi.service.js`

Real CBS UAT integration service.

It calls:

```text
POST {{CBS_BASE_URL}}/v1/auth/token
POST {{CBS_BASE_URL}}/v1/sign/key
POST {{CBS_BASE_URL}}/v1/acc/inquiry
```

Why:

```text
/v1/auth/token  -> get CBS access_token
/v1/sign/key    -> get signing key
/v1/acc/inquiry -> get account name, status, balance, transfer limit, inquiry id
```

The frontend does not call CBS directly. It calls:

```text
POST http://localhost:5000/cbs/account-inquiry
```

Then backend internally performs the CBS sequence.

### `dk-backend/src/services/bankApi.service.js`

Real DKPG/bank payout integration service.

It calls:

```text
POST {{BANK_API_BASE_URL}}/v1/auth/token
POST {{BANK_API_BASE_URL}}/v1/sign/key
POST {{BANK_API_BASE_URL}}/v1/beneficiary/account_inquiry
POST {{BANK_API_BASE_URL}}/v1/initiate/transaction
POST {{BANK_API_BASE_URL}}/v1/transaction/status
```

Why:

```text
/v1/auth/token                  -> get bank gateway access_token
/v1/sign/key                    -> get signing key
/v1/beneficiary/account_inquiry -> verify beneficiary and get inquiry_id
/v1/initiate/transaction        -> send FIAT payout
/v1/transaction/status          -> check FIAT payout status later
```

The important detail:

```text
POST /v1/initiate/transaction
```

is used internally when backend runs:

```text
sendFiatPayout()
```

That happens from:

```text
POST /settlements/fiat/unregistered
```

### `dk-backend/scripts/`

Terminal helpers for testing bank/CBS APIs without Postman.

```text
cbs-account-inquiry.js       -> test CBS account inquiry flow
bank-sign-key.js             -> test bank auth/sign-key
bank-account-inquiry.js      -> test DKPG beneficiary inquiry
bank-fund-transfer.js        -> preview/confirm fund transfer
bank-transaction-status.js   -> check bank transaction status
```

These scripts are useful when Postman setup becomes painful because they read `.env` and generate the needed headers.

## `dk-frontend` File Details

### `dk-frontend/src/main.jsx`

React entrypoint. It mounts the app into the browser.

### `dk-frontend/src/App.jsx`

Main UI and flow logic.

This file coordinates:

- wallet connection
- token setup
- bank registration
- user registration
- mint requests
- approvals/rejections
- registered receiver TOKEN send
- unregistered receiver FIAT payout
- CBS account checks
- settlement history

It talks to both:

```text
dk-token through Anchor
dk-backend through services/api.js
```

### `dk-frontend/src/utils/anchor.js`

Creates the Anchor program client.

It loads:

```text
dk-frontend/src/idl/dk_token.json
```

and uses Phantom wallet + Solana connection to call the on-chain program.

### `dk-frontend/src/idl/dk_token.json`

Generated Anchor IDL for the deployed `dk-token` program.

Frontend needs this file so it knows:

- program id
- instruction names
- account shapes
- argument shapes

If the Anchor program changes, this IDL must stay aligned with the deployed program.

### `dk-frontend/src/services/api.js`

Central backend API wrapper.

Frontend backend calls live here, including:

```text
GET  /banks
POST /banks
GET  /users/wallet/:wallet
POST /users
GET  /token-config
PUT  /token-config
GET  /mint-requests
POST /mint-requests
PATCH /mint-requests/:id/approve
PATCH /mint-requests/:id/reject
GET  /settlements
POST /settlements
POST /settlements/fiat/unregistered
POST /settlements/:id/status
GET  /cbs/test-accounts
POST /cbs/account-inquiry
```

This file is the bridge between React UI and Express backend.

### `dk-frontend/src/App.css`

Main styling for the active UI.

### `dk-frontend/public/icons.svg`

Public icon asset used by the app.

## How The Three Parts Connect

## Flow 1: Token Setup

```text
Admin in dk-frontend
-> calls dk-token initialize(checkers)
-> frontend gets config address
-> frontend calls dk-backend PUT /token-config
-> backend stores configAddr, adminAddr, checkers
```

Then:

```text
Admin creates DKT mint
-> frontend calls dk-token create_mint()
-> frontend saves mintAddr with PUT /token-config
```

Relation:

```text
dk-token stores truth on-chain
dk-backend stores addresses so UI can reload them later
dk-frontend coordinates both
```

## Flow 2: Bank Registration

```text
Bank connects Phantom in dk-frontend
-> frontend calls POST /banks
-> dk-backend stores bank name, wallet, currency, fiatReserve
```

Relation:

```text
Bank wallet is blockchain identity
Bank database row is business identity and fiat reserve record
```

## Flow 3: Mint Request

```text
Bank or maker creates mint request in dk-frontend
-> frontend calls dk-token create_mint_request(amount)
-> frontend calls dk-backend POST /mint-requests
-> backend stores requestAddr, maker, amount, bankId, reserveSnapshot
```

Relation:

```text
dk-token enforces on-chain request status
dk-backend stores searchable app history
```

## Flow 4: Checker Approval

```text
Checker approves in dk-frontend
-> frontend calls dk-token approve_request()
-> dk-token checks checker is authorized
-> dk-token mints DKT to maker token account
-> frontend calls PATCH /mint-requests/:id/approve
-> backend stores Approved status and txSignature
```

Relation:

```text
On-chain approval mints real DKT
Backend approval record lets UI show history
```

## Flow 5: Registered Receiver TOKEN Send

```text
Bank enters receiver wallet
-> frontend calls GET /users/wallet/:wallet
-> if found, receiver is registered
-> frontend calls dk-token transfer_tokens(amount)
-> frontend calls POST /settlements
-> backend stores TOKEN settlement
```

Relation:

```text
Registered receiver gets DKT token transfer
No CBS or DKPG payout is needed
```

## Flow 6: Unregistered Receiver FIAT Payout

```text
Bank enters receiver wallet
-> frontend calls GET /users/wallet/:wallet
-> if not found, receiver is unregistered
-> frontend loads GET /cbs/test-accounts
-> bank chooses account number
-> frontend calls POST /cbs/account-inquiry
-> backend calls CBS UAT account inquiry
-> frontend shows account name/status/balance
```

Then after confirmation:

```text
frontend calls dk-token burn_tokens(amount)
-> DKT is burned from bank wallet
-> frontend calls POST /settlements/fiat/unregistered
-> backend verifies CBS account again
-> backend calls DKPG beneficiary account inquiry
-> backend calls DKPG initiate transaction
-> backend stores FIAT settlement
-> backend saves bankInquiryId and bankTransactionId
```

Relation:

```text
Burn on-chain removes DKT from circulation
DKPG payout sends equivalent FIAT to CBS bank account
Backend settlement links the blockchain burn to the bank transfer record
```

## Flow 7: FIAT Status Refresh

```text
Frontend calls POST /settlements/:id/status
-> backend reads saved bankTransactionId and receiverAccount
-> backend calls DKPG /v1/transaction/status
-> backend updates bankApiStatus, bankApiMessage, bankStatusCheckedAt
-> frontend refreshes settlement history
```

Relation:

```text
Settlement row is the bridge between UI history and bank transfer status
```

## API Relationship Summary

Frontend calls local backend routes:

```text
http://localhost:5000/cbs/account-inquiry
http://localhost:5000/settlements/fiat/unregistered
http://localhost:5000/settlements/:id/status
```

Backend calls real external APIs:

```text
CBS UAT:
POST /v1/auth/token
POST /v1/sign/key
POST /v1/acc/inquiry

DKPG/bank:
POST /v1/auth/token
POST /v1/sign/key
POST /v1/beneficiary/account_inquiry
POST /v1/initiate/transaction
POST /v1/transaction/status
```

The frontend should not hold bank credentials or generate bank signatures. That is backend responsibility.

## Database Relationship Summary

```text
TokenConfig
```

Stores the active on-chain addresses the frontend needs after reload.

```text
Bank
```

Stores bank wallet and reserve information.

```text
User
```

Stores registered receiver wallets.

```text
MintRequest
```

Stores off-chain history of on-chain mint requests.

```text
Settlement
```

Stores TOKEN and FIAT transfer history.

For FIAT settlement, it also stores the CBS/DKPG tracking fields.

## Important Local Commands

Backend:

```bash
cd dk-backend
npm start
```

Frontend:

```bash
cd dk-frontend
npm run dev
```

Solana program:

```bash
cd dk-token
anchor build
anchor test
```

CBS helper file:

```text
dk-backend/scripts/cbs-account-inquiry.js
```

Bank helper files:

```text
dk-backend/scripts/bank-sign-key.js
dk-backend/scripts/bank-account-inquiry.js
dk-backend/scripts/bank-fund-transfer.js
dk-backend/scripts/bank-transaction-status.js
```

Note: these helper files exist in `dk-backend/scripts/`, but the current
`dk-backend/package.json` only exposes `start`, `dev`, `prisma:generate`,
`prisma:push`, and `test` scripts.

## Mental Model

Think of the project like this:

```text
dk-token = rule engine for DKT on Solana
dk-backend = memory, database, and bank integration layer
dk-frontend = control panel that coordinates blockchain and backend
```

When something changes token balances, `dk-token` is involved.

When something needs saved history, registration, reserve tracking, CBS, or DKPG, `dk-backend` is involved.

When a user clicks buttons and sees status, `dk-frontend` is coordinating the flow.
