# DK Project Flow

This document explains how the three main folders work together:

```text
dk-token     -> Solana smart contract / on-chain rules
dk-backend   -> Express + Prisma + PostgreSQL API
dk-frontend  -> React UI that talks to wallet, smart contract, and backend
```

The most important idea:

```text
The smart contract decides authority.
The backend stores app data/history.
The frontend connects both together for the user.
```

## Folder 1: `dk-token`

This is the blockchain layer.

Important files:

```text
dk-token/programs/dk-token/src/lib.rs
dk-token/programs/dk-token/src/state/config.rs
dk-token/programs/dk-token/src/state/mint_request.rs
dk-token/programs/dk-token/src/error.rs
```

### What It Stores On-Chain

`Config` stores the system authority:

```rust
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub checkers: Vec<Pubkey>,
}
```

Meaning:

```text
admin    -> wallet that initialized the system
mint     -> DKT token mint address
checkers -> wallets allowed to approve/reject mint requests
```

`MintRequest` stores one mint request:

```rust
pub struct MintRequest {
    pub config: Pubkey,
    pub maker: Pubkey,
    pub checker: Option<Pubkey>,
    pub amount: u64,
    pub status: RequestStatus,
}
```

Meaning:

```text
config  -> which Config this request belongs to
maker   -> wallet that requested tokens
checker -> wallet that approved/rejected
amount  -> requested amount
status  -> Pending / Approved / Rejected
```

### Smart Contract Instructions

These are the main functions in:

```text
dk-token/programs/dk-token/src/lib.rs
```

```text
initialize(checkers)
```

Creates the `Config` account.

```text
config.admin = connected admin wallet
config.checkers = checker wallet list
config.mint = empty
```

```text
create_mint()
```

Only the on-chain admin can create the mint.

```text
connected wallet must equal config.admin
```

```text
create_mint_request(amount)
```

Any signer can create a mint request. This signer becomes the maker.

```text
request.maker = connected wallet
request.status = Pending
```

```text
approve_request()
```

Only a checker wallet can approve.

The contract checks:

```text
request.status == Pending
checker is inside config.checkers
checker != request.maker
config.mint == mint account
```

If valid, the program mints DKT to the maker token account.

```text
reject_request()
```

Only a checker wallet can reject.

```text
transfer_tokens(amount)
```

Token holders transfer DKT directly.

```text
burn_tokens(amount)
```

Token holders burn their own DKT directly.

## Folder 2: `dk-backend`

This is the API and database layer.

Important files:

```text
dk-backend/src/server.js
dk-backend/src/prisma.js
dk-backend/prisma/schema.prisma
dk-backend/src/controllers/user.controller.js
dk-backend/src/controllers/mintRequest.controller.js
dk-backend/src/controllers/tokenConfig.controller.js
dk-backend/src/routes/user.routes.js
dk-backend/src/routes/mintRequest.routes.js
dk-backend/src/routes/tokenConfig.routes.js
```

### What Backend Does

The backend does not replace the smart contract.

It stores helpful off-chain data:

```text
users          -> optional wallet labels/roles
mint requests  -> request history for UI
token config   -> saved config/mint/checker addresses for refresh
```

### Backend Models

In:

```text
dk-backend/prisma/schema.prisma
```

`User`:

```prisma
model User {
  id        String   @id @default(uuid())
  wallet    String   @unique
  role      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

This is only a backend label.

Important:

```text
User.role does not grant smart-contract authority.
```

`MintRequest`:

```prisma
model MintRequest {
  id            String   @id @default(uuid())
  requestAddr   String   @unique
  maker         String
  amount        Float
  status        String   @default("Pending")
  txSignature   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

This mirrors on-chain mint request history for the UI.

`TokenConfig`:

```prisma
model TokenConfig {
  id         String   @id @default("default")
  adminAddr  String?
  configAddr String?
  mintAddr   String?
  checkers   String[] @default([])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

This helps frontend reload after browser refresh.

### Backend Routes

Registered in:

```text
dk-backend/src/server.js
```

```js
app.use("/users", userRoutes);
app.use("/mint-requests", mintRequestRoutes);
app.use("/token-config", tokenConfigRoutes);
app.use("/banks", bankRoutes);
```

Main endpoints:

```text
POST /users
GET  /users
GET  /users/wallet/:wallet
```

```text
POST  /mint-requests
GET   /mint-requests
GET   /mint-requests/:id
PATCH /mint-requests/:id/approve
PATCH /mint-requests/:id/reject
```

```text
GET /token-config
PUT /token-config
```

```text
POST  /banks
GET   /banks
GET   /banks/wallet/:wallet
PATCH /banks/:id/reserve
```

```text
POST /settlements
GET  /settlements
GET  /settlements?bankId=:bankId
```

### Bank Extension Data

The bank extension is off-chain data connected to the same on-chain mint request flow.

`Bank` stores:

```text
name        -> bank name shown in UI
wallet      -> bank's Solana wallet
currency    -> fiat currency label, for example BTN
fiatReserve -> fiat amount backing DKT mint requests
status      -> Active / inactive status label
```

`Settlement` stores bank-to-user settlement history:

```text
bankId              -> bank that sent the value
senderWallet        -> bank wallet
recipientWallet     -> receiver wallet
recipientRegistered -> true when receiver exists in backend users table
settlementType      -> TOKEN or FIAT
amount              -> transfer/payout amount
currency            -> fiat currency label for FIAT payout
txSignature         -> token transfer or burn transaction signature
receiverName        -> FIAT receiver name
receiverAccount     -> FIAT receiver mock bank account
bankReference       -> mock bank API payment reference
bankApiStatus       -> mock bank API status
bankApiMessage      -> mock bank API response message
```

`MintRequest` now can also store:

```text
bankId          -> which bank submitted this request
reserveSnapshot -> fiat reserve at request time
```

Important:

```text
The bank reserve check is backend/business logic.
The actual minting still needs smart-contract checker approval.
```

## Folder 3: `dk-frontend`

This is the user interface.

Important files:

```text
dk-frontend/src/main.jsx
dk-frontend/src/App.jsx
dk-frontend/src/services/api.js
dk-frontend/src/utils/anchor.js
dk-frontend/src/idl/dk_token.json
dk-frontend/src/App.css
```

### Frontend Entry Point

In:

```text
dk-frontend/src/main.jsx
```

The app sets up:

```text
Solana connection
Wallet provider
Wallet modal
React app
```

Important code:

```js
<ConnectionProvider endpoint={endpoint}>
  <WalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>
      <App />
    </WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```

This gives `App.jsx` access to:

```text
wallet public key
wallet signing
Solana RPC connection
```

### Smart Contract Client

In:

```text
dk-frontend/src/utils/anchor.js
```

The frontend creates the Anchor program client:

```js
export const getProgram = (wallet, connection) => {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new anchor.Program(idl, provider);
};
```

This uses:

```text
dk-frontend/src/idl/dk_token.json
```

The IDL tells the frontend what instructions/accounts the smart contract has.

### Backend API Client

In:

```text
dk-frontend/src/services/api.js
```

The frontend calls backend APIs:

```js
api.getTokenConfig()
api.updateTokenConfig(...)
api.getMintRequests()
api.createMintRequest(...)
api.approveMintRequest(...)
api.rejectMintRequest(...)
api.createBank(...)
api.getBankByWallet(...)
api.updateBankReserve(...)
api.createSettlement(...)
api.getSettlements(...)
api.getUserByWallet(...)
api.createUser(...)
```

The frontend now has separate views for:

```text
Bank tab -> reserve, mint request, send value
User tab -> receiver registration, DKT balance, received value history
```

Default backend URL:

```text
http://localhost:5000
```

Can be changed with:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Full Connected Flow

This is how all folders work together.

## Step 1: Admin Opens Frontend

Folder used:

```text
dk-frontend
```

Admin connects wallet in the UI.

Frontend gets:

```text
wallet.publicKey
wallet.signTransaction
connection
```

No backend or blockchain write happens yet.

## Step 2: Admin Adds Checkers

Folder used:

```text
dk-frontend
```

Admin enters checker public keys in the Setup tab.

This is frontend state first:

```text
checkers = [checker public keys]
```

Nothing is official until `Initialize System` is clicked.

## Step 3: Admin Initializes System

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

Frontend calls smart contract:

```js
program.methods.initialize(checkerPubkeys)
```

Smart contract writes on-chain:

```text
Config.admin = admin wallet
Config.checkers = checker list
Config.mint = empty
```

Then frontend saves a copy in backend:

```js
api.updateTokenConfig({
  adminAddr,
  configAddr,
  checkers,
});
```

Backend stores it in PostgreSQL:

```text
token_config table
```

## Step 4: Admin Creates Mint

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

Frontend calls:

```js
program.methods.createMint()
```

Smart contract checks:

```text
connected wallet == Config.admin
```

Then smart contract stores:

```text
Config.mint = mint public key
```

Frontend saves mint to backend:

```js
api.updateTokenConfig({
  adminAddr,
  configAddr,
  mintAddr,
  checkers,
});
```

Now if the browser refreshes, frontend can reload:

```text
config address
mint address
admin address
checker list
```

## Step 5: Maker Creates Mint Request

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

Any connected wallet can create a mint request.

Frontend calls:

```js
program.methods.createMintRequest(amount)
```

Smart contract creates on-chain request:

```text
request.maker = connected wallet
request.amount = requested amount
request.status = Pending
```

Frontend then saves request to backend:

```js
api.createMintRequest({
  requestAddr,
  maker,
  amount,
});
```

Backend stores:

```text
request address
maker wallet
amount
Pending status
```

This is why the UI can show pending requests quickly.

## Step 5B: Bank Creates Reserve-Backed Mint Request

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

The bank connects its wallet in the Bank tab.

If the bank is not registered yet, frontend calls:

```js
api.createBank({
  name,
  wallet,
  currency,
  fiatReserve,
});
```

After registration, the bank submits a mint amount.

Frontend first creates the real on-chain mint request:

```js
program.methods.createMintRequest(amount)
```

The smart contract stores:

```text
request.maker = bank wallet
request.amount = requested amount
request.status = Pending
```

Then frontend saves bank context in backend:

```js
api.createMintRequest({
  requestAddr,
  maker: bankWallet,
  amount,
  bankId,
});
```

Backend checks:

```text
bank exists
bank wallet matches maker wallet
amount is not greater than fiatReserve
```

Then backend stores:

```text
bankId
reserveSnapshot
Pending status
```

This keeps the banking extension realistic:

```text
Fiat reserve is checked before saving the bank request.
Checker approval is still required before DKT is minted.
```

## Step 6: Checker Opens Frontend

Folders used:

```text
dk-frontend -> dk-backend -> dk-token
```

Frontend loads saved token config from backend:

```js
api.getTokenConfig()
```

Then frontend fetches actual on-chain config:

```js
program.account.config.fetch(configPubkey)
```

Frontend checks:

```text
connected wallet in Config.checkers?
```

If yes:

```text
wallet is Checker
```

If connected wallet equals:

```text
Config.admin
```

then:

```text
wallet is Admin
```

This is how the UI knows what actions to allow.

## Step 7: Checker Approves

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

Checker clicks Approve.

Frontend calls:

```js
program.methods.approveRequest()
```

Smart contract checks:

```text
request.status == Pending
checker is inside Config.checkers
checker != request.maker
Config.mint == mint account
```

Then smart contract mints DKT:

```text
DKT -> maker token account
request.status = Approved
request.checker = checker wallet
```

Frontend updates backend:

```js
api.approveMintRequest(id, txSignature)
```

Backend changes:

```text
status = Approved
txSignature = transaction signature
```

## Step 8: Checker Rejects

Folders used:

```text
dk-frontend -> dk-token -> dk-backend
```

Checker clicks Reject.

Frontend calls:

```js
program.methods.rejectRequest()
```

Smart contract checks:

```text
request.status == Pending
checker is inside Config.checkers
```

Then:

```text
request.status = Rejected
request.checker = checker wallet
```

Frontend updates backend:

```js
api.rejectMintRequest(id, txSignature)
```

## Step 9: Transfer

Folders used:

```text
dk-frontend -> dk-token
```

Token holder sends DKT to another wallet.

Frontend calls:

```js
program.methods.transferTokens(amount)
```

No checker required.

## Step 9B: Bank Sends Value To User

Folders used:

```text
dk-frontend -> dk-backend -> dk-token -> dk-backend
```

The bank opens the Bank tab and enters:

```text
recipient wallet
amount
```

Frontend checks backend:

```js
api.getUserByWallet(recipientWallet)
```

If the recipient is registered:

```text
frontend calls transfer_tokens(amount)
DKT moves from bank wallet to recipient wallet
backend records settlementType = TOKEN
```

If the recipient is not registered:

```text
frontend calls burn_tokens(amount)
DKT is destroyed from the bank wallet
backend calls mock bank API
backend records settlementType = FIAT
backend decrements bank fiatReserve by amount
```

For the demo, the FIAT path records a simulated bank payout reference:

```text
status = Fiat Paid Demo
bankReference = MOCK-BANK-YYYYMMDD-XXXXXX
```

In a real banking integration, this is where the backend would call the bank payment API.

## Step 9C: User Opens Receiver Portal

Folders used:

```text
dk-frontend -> dk-backend -> dk-token
```

The user connects their wallet and opens the User tab.

Frontend checks backend registration:

```js
api.getUserByWallet(wallet)
```

If registered:

```text
Banks can send DKT to this wallet.
User tab shows role and token balance.
```

If not registered:

```text
Banks use FIAT fallback for this wallet.
User tab can register the wallet as a receiver.
```

Frontend loads received value history:

```js
api.getSettlements({ recipientWallet })
```

Then the User tab shows:

```text
TOKEN settlement -> user received DKT
FIAT settlement  -> user received fiat payout demo
```

## Step 10: Burn

Folders used:

```text
dk-frontend -> dk-token
```

Token holder burns their own DKT.

Frontend calls:

```js
program.methods.burnTokens(amount)
```

No checker required.

## Who Decides What?

```text
Smart contract decides:
- who is admin
- who is checker
- whether request can be approved
- whether maker is self-approving
- minting tokens
- transfer
- burn
```

```text
Backend decides:
- storing request history
- storing saved config/mint/checker addresses
- storing optional wallet labels
- storing registered bank profiles
- checking bank fiat reserve before saving bank mint requests
- recording TOKEN/FIAT settlements after bank sends value
- decrementing bank fiat reserve for FIAT fallback payouts
- serving data to frontend after refresh
```

```text
Frontend decides:
- which buttons to show
- when to call smart contract
- when to call backend
- how to guide user through flow
- whether the user is working in Admin, Checker, Bank, Maker, Transfer, or Burn view
```

## Important Rule

Backend data is helpful, but not authority.

This means:

```text
Changing User.role in PostgreSQL does not make a wallet a real checker.
```

A real checker must be inside:

```text
Config.checkers
```

on-chain.

## Local Development Order

Start backend:

```bash
cd dk-backend
npm start
```

Start frontend:

```bash
cd dk-frontend
npm run dev
```

Smart contract is already built/deployed for the current frontend IDL.

If using local validator, remember:

```text
Restarting solana-test-validator resets on-chain accounts.
You must deploy/init again.
```

## Simple Mental Model

Think of the project like this:

```text
dk-token:
  The law.

dk-backend:
  The notebook.

dk-frontend:
  The control panel.
```

The frontend should always follow the smart contract law, and use the backend notebook only to remember useful history.
