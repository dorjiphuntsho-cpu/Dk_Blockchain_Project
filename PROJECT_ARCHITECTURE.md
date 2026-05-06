# DK Blockchain Project Architecture

This document explains how the three main parts of the project work together:

```text
dk-frontend  -> React browser app
dk-backend   -> Express + Prisma + PostgreSQL API server
dk-token     -> Solana Anchor smart contract
```

The short version:

```text
User clicks in dk-frontend
-> frontend calls Solana program for blockchain actions
-> frontend calls dk-backend for saved records/history/bank/CBS work
-> dk-backend stores data in PostgreSQL
-> dk-backend calls CBS/DKPG bank APIs for FIAT payout flow
```

## Folder Responsibilities

### `dk-token`

This is the Solana blockchain program.

It controls the real on-chain DKT token rules:

- initialize system config
- store admin wallet
- store checker wallet list
- create Token-2022 mint
- create mint requests
- approve mint requests
- reject mint requests
- transfer DKT
- burn DKT

Important file:

```text
dk-token/programs/dk-token/src/lib.rs
```

Program id in current source:

```text
8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx
```

### `dk-backend`

This is the API server.

It does not replace the blockchain. It stores off-chain records that help the app remember what happened.

It stores:

- users
- banks
- token config
- mint request history
- TOKEN/FIAT settlements
- CBS/bank payout tracking fields

It also calls:

- CBS account inquiry API
- DKPG/bank gateway APIs

Important files:

```text
dk-backend/src/server.js
dk-backend/src/routes/
dk-backend/src/controllers/
dk-backend/src/services/bankApi.service.js
dk-backend/src/services/cbsApi.service.js
dk-backend/prisma/schema.prisma
```

### `dk-frontend`

This is the browser UI.

It connects Phantom wallet and lets the user do real actions:

- setup token system
- create mint
- register users/banks in backend
- create mint requests
- approve/reject requests
- send DKT to registered users
- burn DKT and trigger FIAT payout for unregistered users
- view balances and histories

Important files:

```text
dk-frontend/src/App.jsx
dk-frontend/src/services/api.js
dk-frontend/src/utils/anchor.js
dk-frontend/src/idl/dk_token.json
```

## Runtime URLs

Backend:

```text
http://localhost:5000
```

Frontend:

```text
http://127.0.0.1:5175
```

The exact Vite port can change if another frontend is already running.

## Environment Connection

The frontend backend base URL is configured here:

```text
dk-frontend/.env
```

Expected value:

```env
VITE_API_BASE_URL=http://localhost:5000
```

If not set, frontend defaults to:

```text
http://localhost:5000
```

The backend bank/CBS/API credentials are configured here:

```text
dk-backend/.env
```

Do not commit real credentials.

## Blockchain Instructions

The frontend calls these Solana program instructions from `dk-frontend/src/App.jsx`.

### `initialize(checkers)`

Creates the on-chain config account.

Stores:

```text
Config.admin    = connected wallet
Config.checkers = checker wallet list
Config.mint     = empty/default until mint is created
```

Frontend then saves the config address to backend:

```text
PUT /token-config
```

### `create_mint()`

Creates the DKT Token-2022 mint.

Only the on-chain admin can do this.

Frontend then saves the mint address to backend:

```text
PUT /token-config
```

### `create_mint_request(amount)`

Creates an on-chain mint request.

Any connected wallet can be the maker.

Frontend also saves a backend record:

```text
POST /mint-requests
```

If a bank created the request, the backend record includes:

```text
bankId
reserveSnapshot
```

### `approve_request()`

Checker approves a pending mint request.

The program checks:

```text
request is Pending
checker is in Config.checkers
checker is not the maker
mint matches Config.mint
```

Then the program mints DKT to the maker token account.

Frontend updates backend:

```text
PATCH /mint-requests/:id/approve
```

### `reject_request()`

Checker rejects a pending mint request.

Frontend updates backend:

```text
PATCH /mint-requests/:id/reject
```

### `transfer_tokens(amount)`

Transfers DKT from one Phantom wallet token account to another.

Used for registered receivers.

Frontend saves settlement:

```text
POST /settlements
```

### `burn_tokens(amount)`

Burns DKT from the bank wallet token account.

Used for unregistered receivers before FIAT payout.

Frontend sends the burn signature to backend:

```text
POST /settlements/fiat/unregistered
```

## Backend Routes

The backend mounts routes in:

```text
dk-backend/src/server.js
```

### Banks

Mounted at:

```text
/banks
```

Routes:

```text
POST  /banks
GET   /banks
GET   /banks/wallet/:wallet
PATCH /banks/:id/reserve
```

Used by frontend:

```text
api.createBank(...)
api.getBanks()
api.getBankByWallet(wallet)
api.updateBankReserve(id, fiatReserve)
```

Purpose:

- register bank profile
- store bank Phantom wallet
- store BTN reserve
- show registered bank directory
- check bank record by connected wallet

### Users

Mounted at:

```text
/users
```

Routes:

```text
POST /users
GET  /users
GET  /users/wallet/:wallet
```

Used by frontend:

```text
api.createUser(...)
api.getUserByWallet(wallet)
```

Purpose:

- register receiver/maker/checker/admin labels in backend
- decide whether a receiver wallet is registered or unregistered

Important rule:

```text
Registered = wallet exists in backend users table
Unregistered = wallet does not exist in backend users table
```

Phantom wallet existence alone does not mean registered.

### Token Config

Mounted at:

```text
/token-config
```

Routes:

```text
GET /token-config
PUT /token-config
```

Used by frontend:

```text
api.getTokenConfig()
api.updateTokenConfig(...)
```

Purpose:

- remember admin address
- remember on-chain config address
- remember mint address
- remember checker list
- reload app after browser refresh

### Mint Requests

Mounted at:

```text
/mint-requests
```

Routes:

```text
POST  /mint-requests
GET   /mint-requests
GET   /mint-requests/:id
PATCH /mint-requests/:id/status
PATCH /mint-requests/:id/approve
PATCH /mint-requests/:id/reject
```

Used by frontend:

```text
api.createMintRequest(...)
api.getMintRequests()
api.approveMintRequest(id, txSignature)
api.rejectMintRequest(id, txSignature)
```

Purpose:

- store off-chain history of on-chain mint requests
- show checker queue
- show mint history
- remember approval/rejection transaction signature

### Settlements

Mounted at:

```text
/settlements
```

Routes:

```text
POST /settlements
GET  /settlements
POST /settlements/fiat/unregistered
POST /settlements/:id/status
```

Used by frontend:

```text
api.createSettlement(...)
api.createUnregisteredFiatSettlement(...)
api.getSettlements(...)
api.refreshSettlementStatus(id)
```

Purpose:

- record bank-to-user value movement
- store TOKEN settlement for registered receiver
- store FIAT settlement for unregistered receiver
- track bank inquiry id
- track bank transaction id
- refresh bank payout status

Settlement types:

```text
TOKEN = DKT sent directly to registered receiver wallet
FIAT  = DKT burned, BTN sent through bank account path
```

### CBS

Mounted at:

```text
/cbs
```

Routes:

```text
GET  /cbs/test-accounts
POST /cbs/account-inquiry
```

Used by frontend:

```text
api.getCbsTestAccounts()
api.inquireCbsAccount(...)
```

Purpose:

- load project-approved CBS UAT test accounts
- verify receiver bank account before burn/payout
- show account details in UI

CBS account inquiry returns useful fields:

```text
response_data.account_info.account_no
response_data.account_info.account_name
response_data.account_status.acc_status_details
response_data.balance_info.btn_available_balance
response_data.daily_max_transfer_limit.intra_transfer.max_single_amt
response_data.meta_info.inquiry_id
```

### Bank Gateway / DKPG

Mounted at:

```text
/v1
```

Routes currently exposed for local/mock gateway testing:

```text
POST /v1/auth/token
POST /v1/sign/key
POST /v1/beneficiary/account_inquiry
```

The real bank service code is in:

```text
dk-backend/src/services/bankApi.service.js
```

The real DKPG flow uses:

```text
POST /v1/auth/token
POST /v1/sign/key
POST /v1/beneficiary/account_inquiry
POST /v1/initiate/transaction
POST /v1/transaction/status
```

Purpose:

- authenticate to bank gateway
- fetch signing key
- build signed DK headers
- verify beneficiary
- initiate FIAT payout
- check payout status

### Mock Bank

Mounted at:

```text
/mock-bank
```

Routes:

```text
POST /mock-bank/payout
/mock-bank/v1/*
```

Purpose:

- local/mock bank testing
- safer development when not hitting UAT directly

## Frontend API Map

Frontend API helper:

```text
dk-frontend/src/services/api.js
```

It uses:

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
```

Every frontend backend call goes through this helper.

Main frontend API methods:

```text
createBank
getBanks
getBankByWallet
updateBankReserve
inquireCbsAccount
getCbsTestAccounts
createSettlement
createUnregisteredFiatSettlement
refreshSettlementStatus
getSettlements
createUser
getUserByWallet
getMintRequests
getTokenConfig
updateTokenConfig
createMintRequest
approveMintRequest
rejectMintRequest
```

## Database Models

Defined in:

```text
dk-backend/prisma/schema.prisma
```

### `Bank`

Stores:

```text
name
wallet
currency
fiatReserve
status
```

Used by:

- Bank tab
- reserve-backed mint request
- FIAT settlement

### `User`

Stores:

```text
wallet
role
```

Used to decide registered vs unregistered receiver.

### `TokenConfig`

Stores:

```text
adminAddr
configAddr
mintAddr
checkers[]
```

Used to reload frontend state after refresh.

### `MintRequest`

Stores:

```text
requestAddr
maker
bankId
amount
reserveSnapshot
status
txSignature
```

Used for mint request history and checker queue.

### `Settlement`

Stores:

```text
bankId
senderWallet
recipientWallet
recipientRegistered
settlementType
amount
currency
status
txSignature
receiverName
receiverAccount
cbsProductType
bankReference
bankInquiryId
bankTransactionId
bankApiStatus
bankApiMessage
bankStatusCheckedAt
```

Used for:

- Bank settlement history
- User received value history
- FIAT payout tracking
- status refresh

## Main Flows

## Flow 1: System Setup

```text
Frontend
-> Phantom wallet signs initialize(checkers)
-> dk-token creates Config account
-> frontend calls PUT /token-config
-> backend saves configAddr/admin/checkers
```

Then:

```text
Frontend
-> admin creates mint with create_mint()
-> dk-token creates Token-2022 mint
-> frontend calls PUT /token-config
-> backend saves mintAddr
```

## Flow 2: Bank Registration

```text
Bank connects Phantom wallet
-> frontend calls POST /banks
-> backend saves bank name, wallet, currency, fiat reserve
```

This is off-chain data. The bank wallet is still a real Solana wallet.

## Flow 3: Bank Mint Request

```text
Bank enters DKT mint amount
-> frontend calls dk-token create_mint_request(amount)
-> on-chain request is created as Pending
-> frontend calls POST /mint-requests
-> backend checks bank reserve
-> backend saves request history
```

No DKT is minted yet.

## Flow 4: Checker Approval

```text
Checker connects Phantom wallet
-> frontend checks checker is in Config.checkers
-> checker calls approve_request()
-> dk-token mints DKT to maker/bank token account
-> frontend calls PATCH /mint-requests/:id/approve
-> backend saves Approved status and tx signature
```

## Flow 5: Registered Receiver

Receiver is registered if:

```text
GET /users/wallet/:wallet returns a user
```

Flow:

```text
Bank enters receiver Phantom wallet
-> frontend calls GET /users/wallet/:wallet
-> backend finds user
-> frontend calls dk-token transfer_tokens(amount)
-> DKT moves bank wallet -> receiver wallet
-> frontend calls POST /settlements
-> backend saves TOKEN settlement
```

No CBS or DKPG payout is needed.

## Flow 6: Unregistered Receiver FIAT Fallback

Receiver is unregistered if:

```text
GET /users/wallet/:wallet returns not found
```

Flow:

```text
Bank enters receiver Phantom wallet
-> frontend checks receiver is unregistered
-> bank chooses CBS test/account number
-> frontend calls POST /cbs/account-inquiry
-> backend calls CBS and returns account details
-> frontend shows account name/status/balance
-> frontend shows confirmation modal
-> bank confirms
-> frontend calls dk-token burn_tokens(amount)
-> DKT is burned from bank wallet
-> frontend calls POST /settlements/fiat/unregistered
```

Then backend:

```text
-> verifies bank and sender wallet
-> verifies receiver CBS account again
-> calls DKPG beneficiary inquiry
-> calls DKPG fund transfer
-> saves FIAT settlement
-> saves bankInquiryId and bankTransactionId
-> decrements bank fiatReserve
```

Receiver side:

```text
Unregistered wallet opens User tab
-> frontend calls GET /settlements?recipientWallet=<wallet>
-> UI shows FIAT received
-> UI can refresh CBS balance for receiver account
```

## Flow 7: FIAT Status Refresh

```text
Frontend calls POST /settlements/:id/status
-> backend uses saved bankTransactionId and receiverAccount
-> backend calls DKPG transaction status
-> backend updates bankApiStatus, bankApiMessage, bankStatusCheckedAt
-> frontend updates Bank/User history row
```

## Registered vs Unregistered

This is important.

```text
Registered receiver = wallet exists in backend User table
Unregistered receiver = wallet does not exist in backend User table
```

Not enough:

```text
having Phantom wallet
having DKT token account
having a CBS bank account
```

Only backend `/users/wallet/:wallet` decides registration for this app.

## Phantom Wallet vs CBS Bank Account

They are different identities.

### Phantom wallet

Used for blockchain:

```text
DKT transfer
DKT burn
mint request
checker approval
admin setup
```

### CBS bank account

Used for FIAT:

```text
CBS account inquiry
BTN payout
FIAT fallback
available balance display
```

In unregistered payout, frontend needs both:

```text
receiver Phantom wallet -> settlement owner/history
receiver CBS account    -> FIAT payout destination
```

## Bank API Purpose

The bank APIs make the unregistered receiver fallback realistic.

Without bank APIs:

```text
DKT burn happens, but no real FIAT payout exists
```

With bank APIs:

```text
DKT is burned
CBS verifies bank account
DKPG sends equivalent BTN to that account
Backend records all tracking IDs
UI shows FIAT received and status
```

## Quick Test Order

Start backend:

```bash
cd dk-backend
npm start
```

Start frontend:

```bash
cd dk-frontend
npm run dev -- --host 127.0.0.1
```

Recommended UAT flow:

```text
1. Open frontend
2. Connect bank Phantom wallet
3. Go to Bank -> Profile and verify DKT/BTN balances
4. Go to Bank -> Send Payout
5. Enter unregistered receiver Phantom wallet
6. Click Check Receiver
7. Select Test Account 1 or Test Account 2
8. Click Check CBS
9. Review account name/status/available balance
10. Click Send Value
11. Review modal
12. Click Confirm Burn And Payout
13. Go to Bank -> History
14. Click Refresh Status
15. Switch to receiver wallet
16. Go to User -> Profile/History
17. Verify FIAT received and CBS balance
```

## Useful Debug Endpoints

Browser backend page:

```text
GET http://localhost:5000/
```

CBS test accounts:

```text
GET http://localhost:5000/cbs/test-accounts
```

Token config:

```text
GET http://localhost:5000/token-config
```

All settlements:

```text
GET http://localhost:5000/settlements
```

Bank settlements:

```text
GET http://localhost:5000/settlements?bankId=<bank_id>
```

Receiver settlements:

```text
GET http://localhost:5000/settlements?recipientWallet=<wallet>
```

## Where To Change Things Later

### Add/change frontend UI

```text
dk-frontend/src/App.jsx
dk-frontend/src/App.css
```

### Add/change frontend API calls

```text
dk-frontend/src/services/api.js
```

### Add/change backend routes

```text
dk-backend/src/routes/
dk-backend/src/controllers/
```

### Add/change CBS logic

```text
dk-backend/src/services/cbsApi.service.js
```

### Add/change DKPG/bank payout logic

```text
dk-backend/src/services/bankApi.service.js
```

### Add/change database tables

```text
dk-backend/prisma/schema.prisma
```

Then run:

```bash
cd dk-backend
npx prisma db push
```

### Add/change blockchain rules

```text
dk-token/programs/dk-token/src/lib.rs
```

Then rebuild/redeploy the Anchor program and update frontend IDL if needed.
