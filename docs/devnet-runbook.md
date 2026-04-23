# Devnet Runbook

## Goal

Keep localnet working as the fast fallback while adding a repeatable devnet deployment and verification path.

## Environment Files

Backend:

- `backend/.env.localnet`
- `backend/.env.devnet`

Frontend:

- `DK_Token_Frontend/.env.localnet`
- `DK_Token_Frontend/.env.devnet`

Before running a target environment, copy the matching file into the active `.env`.

Examples:

```powershell
Copy-Item backend/.env.localnet backend/.env -Force
Copy-Item DK_Token_Frontend/.env.localnet DK_Token_Frontend/.env -Force
```

```powershell
Copy-Item backend/.env.devnet backend/.env -Force
Copy-Item DK_Token_Frontend/.env.devnet DK_Token_Frontend/.env -Force
```

## Devnet Wallet Setup

Use separate wallets from localnet so test funds and signer ownership stay isolated.

Suggested files:

- `admin-devnet.json`
- `checker-devnet.json`

If you want to use Phantom as the maker, you can leave `SOLANA_MAKER_KEYPAIR_PATH` empty in `backend/.env.devnet`. In that hybrid setup:

- Phantom wallet = maker
- `admin-devnet.json` = deploy/admin signer
- `checker-devnet.json` = backend checker/executor signer

Fund each with devnet SOL before deploying or executing requests.

## Program Deployment

From `dk-token`:

```bash
npm run sync:keys
npm run build:anchor
npm run deploy:anchor:devnet
```

If you keep using the same deploy keypair, the program ID can stay the same across localnet and devnet.

## After Deploy

1. Update `backend/.env.devnet` if the final program ID changed.
2. Start the backend on devnet and confirm Solana bootstrap succeeds.
3. Open the frontend with `VITE_SOLANA_CLUSTER=devnet`.
4. Verify the admin page, managed token mint creation, request approval flow, Phantom maker wallet initiation, and final execution.

## Common Failure Modes

- Phantom is still connected to localnet while the app targets devnet.
- `SOLANA_PROGRAM_ID` does not match the deployed program account on devnet.
- `SOLANA_CONFIG_ADDRESS` points at a localnet config account.
- Devnet wallets do not have enough SOL.
- Backend `.env` and frontend `.env` target different clusters.
- `SOLANA_MAKER_KEYPAIR_PATH` is set even though you intend to use Phantom as maker, causing the backend to expect a different wallet.
