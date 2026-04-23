# Dk_Blockchain_Project

## Local Validator Setup

This project includes an Anchor program in `dk-token` and a helper script for local wallet setup.

Use local validator when you want fast testing and effectively unlimited SOL via airdrops.

### 1. Start the validator

In a separate terminal:

```bash
solana-test-validator
```

If you want a clean reset:

```bash
solana-test-validator --reset
```

### 2. Point Solana CLI to localnet

```bash
solana config set --url localhost
solana config get
```

### 3. Create and fund local test wallets

From `dk-token`, run:

```bash
npm run setup:local-wallet -- admin
npm run setup:local-wallet -- maker
npm run setup:local-wallet -- recipient
```

The script will:

- create `~/.config/solana/<name>.json` if it does not exist
- request `100` SOL from the local validator
- print the wallet path, public key, and balance

You can also pass a custom airdrop amount:

```bash
npm run setup:local-wallet -- checker 250
```

### 4. Configure Anchor wallet

Set the provider wallet in [dk-token/Anchor.toml](/abs/path/d:/Office/Dk_Blockchain_Project/dk-token/Anchor.toml:1):

```toml
[provider]
cluster = "localnet"
wallet = "/home/tandin/.config/solana/admin.json"
```

Use the admin wallet as the Anchor provider wallet for local testing.

### 5. Sync program keys

Before building or testing, sync the declared program ID from the deploy keypair:

```bash
cd dk-token
npm run sync:keys
```

This updates:

- `dk-token/Anchor.toml`
- `programs/dk-token/src/lib.rs`

Use this whenever:

- the deploy keypair changes
- `target/deploy/dk_token-keypair.json` is regenerated
- you see `DeclaredProgramIdMismatch`

You can also use the wrapped commands:

```bash
npm run build:anchor
npm run test:anchor
```

If you already started `solana-test-validator` manually:

```bash
npm run test:anchor:skip-validator
```

### 6. Check wallet balances

Examples:

```bash
solana balance -k ~/.config/solana/admin.json
solana balance -k ~/.config/solana/maker.json
solana balance -k ~/.config/solana/recipient.json
```

### 7. Build and test the program

From `dk-token`:

```bash
npm run build:anchor
npm run test:anchor
```

## Current Contract Flow

The current on-chain setup is:

1. `admin` initializes config
2. `admin` can add or remove checker wallets
3. `admin` can rotate the admin wallet
4. `maker` creates a `mint`, `transfer`, or `burn` request
5. `maker` can cancel a pending request
6. an authorized `checker` approves or rejects the request
7. on approval:
   `mint` mints tokens to the destination token account
   `transfer` moves tokens from source to destination using delegated authority
   `burn` burns tokens from the source token account using delegated authority

For `transfer` and `burn`, the maker must first delegate the requested token amount to the program PDA (`token-authority`) before the checker approves the request. This matches a browser-wallet flow where the user signs the delegation from their own wallet first, then the checker executes approval later.

## Useful Commands

Set devnet:

```bash
solana config set --url https://api.devnet.solana.com
```

Reset Anchor build artifacts:

```bash
anchor clean
npm run build:anchor
```

If validator state becomes corrupted, remove the local ledger you are using and restart the validator.

## Environment Profiles

Keep localnet and devnet configuration separate instead of editing `.env` files by hand.

Backend profiles:

- `backend/.env.localnet`
- `backend/.env.devnet`

Frontend profiles:

- `DK_Token_Frontend/.env.localnet`
- `DK_Token_Frontend/.env.devnet`

Before starting a target environment, copy the profile you want into the active `.env` file.

Localnet:

```powershell
Copy-Item backend/.env.localnet backend/.env -Force
Copy-Item DK_Token_Frontend/.env.localnet DK_Token_Frontend/.env -Force
```

Devnet:

```powershell
Copy-Item backend/.env.devnet backend/.env -Force
Copy-Item DK_Token_Frontend/.env.devnet DK_Token_Frontend/.env -Force
```

## Devnet Deployment Path

1. Fund separate devnet wallets for `admin` and `checker`.
2. Optionally use Phantom as the maker wallet and leave `SOLANA_MAKER_KEYPAIR_PATH` blank in `backend/.env.devnet`.
3. Copy the devnet env profiles into the active `.env` files.
4. Build and deploy the Anchor program from `dk-token`:

```bash
npm run sync:keys
npm run build:anchor
npm run deploy:anchor:devnet
```

5. Start the backend and verify Solana bootstrap against `https://api.devnet.solana.com`.
6. Start the frontend and confirm Phantom is connected to devnet for maker-side initiation.
7. Run the mint, transfer, burn, approval, wallet-initiation, and execution flows end to end.

More detailed environment switching notes live in `docs/devnet-runbook.md`.
