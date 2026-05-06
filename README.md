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
