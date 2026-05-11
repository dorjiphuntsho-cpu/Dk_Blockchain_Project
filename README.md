# Dk_Blockchain_Project

## Project Reference

For a beginner-friendly explanation of how `dk-frontend`, `dk-backend`, and `dk-token` work together, read:

```text
PROJECT_ARCHITECTURE.md
```

# solana config set --url https://api.devnet.solana.com(Devnet setuo)
# program id = 98n8KiwLYGyheLY7RsgN8zgECif19ukFAmafMAkE41eg
# program adress = DREzgPRuKYNrBNF6sGMv6QTYoEBgZkGVFLb7DRRZHfvo
# SPL cli istall for f_token = cargo install spl-token-cli

# Think of a PDA (Program Derived Address) like this: is a wallet address that only a program can control,and no human has the private key for it.
# solana-test-validator --reset (rreset test validator)
# solana config set --url localhost(loaclvalidator)

# rm -rf ~/.config/solana/test-ledger(reset legger when validator fails distrubs)

# anchor clean rm -rf target anchor build

# anchor test (testing) ig error:
# rm -rf .anchor/test-ledger
# pkill solana-test-validator
# anchor test

# cat .anchor/test-ledger/test-ledger-log.txt(check validator log)


# Clean EVERYTHING
Run:
rm -rf target
rm -rf programs/dk-token/target
rm -rf target/deploy
rm -rf target/idl
anchor clean

# build and key sync
anchor build
anchor keys syn

# test and port configuration
pkill solana-test-validator
pkill solana
lsof -i :8898 or kill -9 <PID>
rm -rf .anchor
anchor clean
anchor test

# all at once
anchor clean
cargo clean
anchor build
anchor test

# Token Creation
solana config set --url localhost
spl-token create-token --decimals 6

# test validator run creating and deploying contract
solana-test-validator --reset

# token creation(SPL standard)
spl-token create-token --decimals 6
copy mint adress and paste in next step
 

 2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP

 # create maker token account
spl-token create-account "8Ut2uewFyrcDr85ou1R1pnW9NtVHz2fxfHbUNXFmgiqX"

# copy token account address
HEKdHdyNB5yd5ofBLsWg8ctN9cuE6gwXSHFHwNv7qpog



# Program Flow

The smart contract authority comes from the on-chain `Config` account.

```text
Config.admin    = wallet that initializes the system
Config.checkers = wallets allowed to approve/reject mint requests
Config.mint     = DKT mint address created by admin
```

## 1. Admin Initializes System

Admin connects wallet and runs:

```text
initialize(checkers)
```

This creates the on-chain config:

```text
admin = connected wallet
checkers = checker wallet list
mint = empty
```

## 2. Admin Creates Mint

Only the on-chain admin can run:

```text
create_mint()
```

The program stores the mint address inside:

```text
Config.mint
```

## 3. Maker Creates Mint Request

Any connected wallet can be the maker because the contract only requires:

```text
maker: Signer
```

So the admin wallet can also create a mint request as the maker.

Example:

```text
Admin wallet creates request for 1,000,000 DKT
```

The request stores:

```text
request.maker = connected wallet
request.amount = requested amount
request.status = Pending
request.checker = None
```

## 3B. Bank Creates Reserve-Backed Mint Request

For the banking extension, a bank first connects its wallet in the frontend Bank portal.

The bank record is stored in the backend:

```text
bank name
bank wallet
fiat currency
fiat reserve
```

Then the bank requests DKT minting.

The frontend still creates the real on-chain request using:

```text
create_mint_request(amount)
```

The backend also saves:

```text
bankId
reserveSnapshot
```

Before saving the bank request, backend checks:

```text
bank exists
bank wallet == maker wallet
request amount <= fiat reserve
```

The bank does not mint tokens directly. The request remains:

```text
Pending
```

until a checker approves it.

## 4. Checker Reviews Request

Only a wallet inside:

```text
Config.checkers
```

can approve or reject.

Important rule:

```text
Maker cannot approve their own request
```

So if admin created the mint request as maker, approval must be done by a different checker wallet.

## 5. Checker Approves

Checker runs:

```text
approve_request()
```

The program checks:

```text
request.status == Pending
checker is in Config.checkers
checker != request.maker
Config.mint == mint account
```

Then the program mints DKT to the maker token account:

```text
Program mints requested DKT → Maker token account
request.status = Approved
request.checker = checker wallet
```

## 6. Checker Rejects

Checker can also run:

```text
reject_request()
```

The request becomes:

```text
request.status = Rejected
request.checker = checker wallet
```

## 7. Transfer

After tokens are minted, the maker/token holder can transfer DKT directly:

```text
transfer_tokens()
```

No checker approval is required for transfers.

## 7B. Bank Sends Value To User

The bank portal has a Send to User flow.

Bank enters:

```text
recipient wallet
amount
```

If the recipient wallet is registered in backend users:

```text
Bank DKT -> User DKT wallet
backend settlementType = TOKEN
```

If the recipient wallet is not registered:

```text
Bank burns DKT
backend verifies the CBS account and records a FIAT payout
backend settlementType = FIAT
bank fiat reserve decreases
```

This FIAT path is where the backend calls the bank/CBS gateway for the account inquiry and payout flow.

## 8. Burn

Any token holder can burn their own DKT:

```text
burn_tokens()
```

No checker approval is required for burns.

## Simple UI Test Flow

```text
Admin wallet:
1. Setup → add checker wallet
2. Initialize System
3. Create Mint
4. Maker tab → submit mint request

Checker wallet:
5. Switch wallet to checker
6. Flow tab → approve/reject request
```

# testting (kill other ports and run again)
pkill -f solana-test-validator
sleep 2
anchor test

deployment to devnet 


# Check your wallet
solana address
solana balance

# Airdrop if needed
solana airdrop 2

# Build
anchor build

# Deploy
anchor deploy


# provide folder directores info
# Show the structure
find . -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" | grep -v node_modules | grep -v target | sort

# deployment ststus
Program Id: 8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx

Signature: 4NXHByvpkTQt6TkS9wTBMLvMFPPkXKzfpK6hEiY6CHzufkBsS4Mw979rh9jpMUfRBsGNNmWQwkJQ7SZA3iBRwEbM

Waiting for program 8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx to be confirmed...
Program confirmed on-chain
Idl data length: 947 bytes
Step 0/947 
Step 600/947 
Idl account created: 4taMEzjMvus1tyG1bKP2gQMGrhNtMWYuwLzBeUHjR2oz
Deploy success


# create react fronted
 npm create vite@latest dk-frontend

 # install dependencies
npm install @coral-xyz/anchor
npm install @solana/web3.js
npm install @solana/wallet-adapter-react
npm install @solana/wallet-adapter-react-ui
npm install @solana/wallet-adapter-wallets
npm install @solana/wallet-adapter-phantom
npm install @solana/spl-token



⚠️ Very Important

If you restarted solana-test-validator, then:

Your deployed program is gone ❌
All accounts are gone ❌
All SOL balances reset ❌

You must:

anchor deploy

# Nework configuration
solana config get (get)

# Switch to devnet
solana config set --url devnet
# awitch to local host
solana config set --url localhost
# run local test validator
solana-test-validator --reset


        IMPORTANT RULE

Whenever working on localnet:

You must ALWAYS have this running:

solana-test-validator

# CLI balance sending
solana airdrop 2 YOUR_WALLET_ADDRESS

# IDL (interface definatiion langurgr)
important for forntend act as a API for smart contract(Program in solana)

---

# 2026-05-07: DKT Metadata And Official Mint Fix

## Task Completed

Today we fixed the DKT token metadata issue and stopped the app from minting into old/test mint addresses.

Main problem:

```text
Phantom was showing Unknown Token.
Bank mint approvals were appearing under different mint addresses.
```

Root cause:

```text
We had many old devnet Config accounts.
Each Config account can store a different mint address.
Bank mint request does not create a new mint.
Checker approval mints into whatever mint is stored in the active Config account.
```

So when the app loaded an old Config account, checker approval minted DKT into an old mint such as:

```text
8h3ATohUtFrzVsN36ErkQWGtAxuAb4riPKQNXrZmZa6n
```

That old mint had no metadata, so Phantom showed:

```text
Unknown Token
```

## Official DKT Addresses

Use this Config and mint for the final app flow:

```text
Program ID:
8NVHpP98zZjy6xiSeMXLkQDgn8PsH5Ggf6zCZWUJGfmx

Official Config:
FbVeUcRcZLCHSGnjr62c8ujzWpp42QSThzYfcsUgucun

Official DKT Mint:
rUzMLQjHdDidBSErnWBCqpbqJW8RKd6GW94TNSLTnmz

Admin:
2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP

Checkers:
99Q8L5uqB6GmcULpGFLQRgq2KpgmYaJXQqhEaWgDPwiU
2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP
```

The official mint was checked on devnet and has Metaplex metadata:

```text
Name: DK Token
Symbol: DKT
URI: https://raw.githubusercontent.com/dorjiphuntsho-cpu/Dk_Blockchain_Project/main/dk-token/metadata/dk-token.json
Token Standard: Fungible
```

## Metadata JSON

File:

```text
dk-token/metadata/dk-token.json
```

Current public metadata URL:

```text
https://raw.githubusercontent.com/dorjiphuntsho-cpu/Dk_Blockchain_Project/main/dk-token/metadata/dk-token.json
```

Metadata content:

```json
{
  "name": "DK Token",
  "symbol": "DKT",
  "description": "Reserve-backed DKT payment token for the DK Blockchain Project. DKT is designed around a 1 DKT = 1 BTN settlement model with bank reserve, maker-checker minting, and FIAT payout fallback.",
  "image": "https://gateway.pinata.cloud/ipfs/bafkreic6vvp3avjyuqqx56zwit6htsrxjxjv4kthodehai2y3vss6g2l6y",
  "external_url": "https://github.com/dorjiphuntsho-cpu/Dk_Blockchain_Project",
  "attributes": [
    {
      "trait_type": "Asset Type",
      "value": "Reserve-backed payment token"
    },
    {
      "trait_type": "Settlement Model",
      "value": "1 DKT = 1 BTN"
    }
  ],
  "properties": {
    "category": "image",
    "files": [
      {
        "uri": "https://gateway.pinata.cloud/ipfs/bafkreic6vvp3avjyuqqx56zwit6htsrxjxjv4kthodehai2y3vss6g2l6y",
        "type": "image/png"
      }
    ]
  }
}
```

## Smart Contract Metadata Fix

File changed:

```text
dk-token/programs/dk-token/src/lib.rs
```

Old problem:

```text
create_metadata_accounts_v3 failed on devnet with:
Instruction not supported for ProgrammableNonFungible assets
custom program error: 0x99
```

Fix:

```rust
use anchor_spl::metadata::{
    mpl_token_metadata::{
        instructions::{CreateV1CpiBuilder, UpdateV1CpiBuilder},
        types::{Data, TokenStandard},
    },
    Metadata,
};
```

Create metadata now uses Metaplex `CreateV1`:

```rust
CreateV1CpiBuilder::new(&ctx.accounts.metadata_program.to_account_info())
    .metadata(&ctx.accounts.metadata.to_account_info())
    .mint(&ctx.accounts.mint.to_account_info(), false)
    .authority(&ctx.accounts.mint_authority.to_account_info())
    .payer(&ctx.accounts.admin.to_account_info())
    .update_authority(&ctx.accounts.admin.to_account_info(), true)
    .system_program(&ctx.accounts.system_program.to_account_info())
    .sysvar_instructions(&ctx.accounts.sysvar_instructions.to_account_info())
    .spl_token_program(Some(&ctx.accounts.token_program.to_account_info()))
    .name(name)
    .symbol(symbol)
    .uri(uri)
    .seller_fee_basis_points(0)
    .primary_sale_happened(false)
    .is_mutable(true)
    .token_standard(TokenStandard::Fungible)
    .decimals(ctx.accounts.mint.decimals)
    .invoke_signed(signer)?;
```

Update metadata now uses Metaplex `UpdateV1`:

```rust
let data = Data {
    name,
    symbol,
    uri,
    seller_fee_basis_points: 0,
    creators: None,
};

UpdateV1CpiBuilder::new(&ctx.accounts.metadata_program.to_account_info())
    .authority(&ctx.accounts.admin.to_account_info())
    .mint(&ctx.accounts.mint.to_account_info())
    .metadata(&ctx.accounts.metadata.to_account_info())
    .payer(&ctx.accounts.admin.to_account_info())
    .system_program(&ctx.accounts.system_program.to_account_info())
    .sysvar_instructions(&ctx.accounts.sysvar_instructions.to_account_info())
    .data(data)
    .is_mutable(true)
    .invoke()?;
```

Build and deploy:

```bash
cd /home/dp177/projects/Dk_Blockchain_Project/dk-token
anchor build
anchor deploy --provider.cluster devnet
```

## Frontend Metadata Fix

File changed:

```text
dk-frontend/src/App.jsx
```

Old problem:

```text
Cannot read properties of undefined (reading 'toBuffer')
```

Cause:

```text
@metaplex-foundation/mpl-token-metadata did not export PROGRAM_ID in the installed version.
```

Fix:

```jsx
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

const METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
```

Frontend metadata transaction now passes the new accounts:

```jsx
await program.methods
  .createMetadata(DKT_METADATA.name, DKT_METADATA.symbol, DKT_METADATA.uri)
  .accounts({
    config: configPubkey,
    mint,
    metadata: metadataPDA,
    admin: wallet.publicKey,
    metadataProgram: METADATA_PROGRAM_ID,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  })
  .rpc();
```

The frontend IDL was regenerated from Anchor and copied to:

```text
dk-frontend/src/idl/dk_token.json
```

Build check:

```bash
cd /home/dp177/projects/Dk_Blockchain_Project/dk-frontend
npm run build
```

## Official Mint Guardrail In Frontend

File changed:

```text
dk-frontend/src/App.jsx
```

The app now has one official mint constant:

```jsx
const OFFICIAL_DKT_MINT = "rUzMLQjHdDidBSErnWBCqpbqJW8RKd6GW94TNSLTnmz";
```

Guard function:

```jsx
const requireOfficialDktMint = (action) => {
  if (!mintAddress) {
    toast("Admin must configure the official DKT mint first", "error");
    return false;
  }

  if (mintAddress !== OFFICIAL_DKT_MINT) {
    toast(`${action} is blocked because active mint is not the official DKT mint`, "error");
    return false;
  }

  return true;
};
```

These actions are blocked if the active mint is not the official DKT mint:

```text
regular maker mint request
bank mint request
checker approval
bank send
P2P transfer
burn
```

Setup now shows:

```text
Official DKT Mint
Config Address
Mint Address
```

Dashboard now marks mint health as:

```text
Official    -> active mint is correct
Wrong mint  -> app loaded an old/test Config
Setup       -> no mint configured
```

## Backend Token Config Reset

If the app loads the wrong Config/mint, reset backend token config to the official addresses.

Start backend:

```bash
cd /home/dp177/projects/Dk_Blockchain_Project/dk-backend
npm start
```

In another terminal:

```bash
curl -X PUT http://localhost:5000/token-config \
  -H "Content-Type: application/json" \
  -d '{
    "adminAddr": "2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP",
    "configAddr": "FbVeUcRcZLCHSGnjr62c8ujzWpp42QSThzYfcsUgucun",
    "mintAddr": "rUzMLQjHdDidBSErnWBCqpbqJW8RKd6GW94TNSLTnmz",
    "checkers": [
      "99Q8L5uqB6GmcULpGFLQRgq2KpgmYaJXQqhEaWgDPwiU",
      "2zxFonFBdw3Mut52VZo8U94ZUtdQcSKAFE2w9Znt91oP"
    ]
  }'
```

Verify:

```bash
curl http://localhost:5000/token-config
```

Expected important fields:

```json
{
  "configAddr": "FbVeUcRcZLCHSGnjr62c8ujzWpp42QSThzYfcsUgucun",
  "mintAddr": "rUzMLQjHdDidBSErnWBCqpbqJW8RKd6GW94TNSLTnmz"
}
```

## Correct Final Flow

Admin:

```text
initializes Config
creates/updates official DKT metadata
does not normally request mint in the business flow
```

Regular maker:

```text
creates mint request
checker approves
DKT mints to maker token account
mint stays rUzML...Tnmz
```

Bank maker:

```text
registers as bank
requests reserve-backed DKT minting
checker approves
DKT mints to bank token account
mint stays rUzML...Tnmz
```

Checker:

```text
approves or rejects pending requests
approval mints into Config.mint
Config.mint must be official DKT mint
```

User:

```text
registered user receives DKT directly
unregistered receiver uses burn + FIAT fallback
```

Important rule:

```text
Bank mint request does not create a new mint.
Checker approval mints more supply into the mint stored in Config.mint.
For the final app, Config.mint must be rUzMLQjHdDidBSErnWBCqpbqJW8RKd6GW94TNSLTnmz.
```

## Transaction ID Copy And Explorer Links

Added frontend transaction actions for demo/debugging.

Files changed:

```text
dk-frontend/src/App.jsx
dk-frontend/src/App.css
```

Where it appears:

```text
Bank Settlement History
Bank Mint History
User Received Value History
Request & Operation History
```

For any record with a Solana transaction signature, the UI now shows:

```text
short transaction signature
Copy Tx button
Explorer button
```

Explorer links use devnet:

```text
https://explorer.solana.com/tx/<TRANSACTION_SIGNATURE>?cluster=devnet
```

Frontend helper:

```jsx
const getExplorerTxUrl = (signature) => (
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`
);
```

Reusable component:

```jsx
const TxActions = ({ signature, onCopy }) => {
  if (!signature) return null;

  return (
    <div className="tx-actions">
      <span className="tx-sig">{shorten(signature)}</span>
      <button className="btn btn-sm" onClick={() => onCopy(signature, "Transaction signature")}>
        Copy Tx
      </button>
      <a
        className="btn btn-sm"
        href={getExplorerTxUrl(signature)}
        target="_blank"
        rel="noreferrer"
      >
        Explorer
      </a>
    </div>
  );
};
```

Important fields used:

```text
MintRequest.txSignature
Settlement.txSignature
local transfer txSignature
local burn txSignature
```

Build check:

```bash
cd /home/dp177/projects/Dk_Blockchain_Project/dk-frontend
npm run build
```
