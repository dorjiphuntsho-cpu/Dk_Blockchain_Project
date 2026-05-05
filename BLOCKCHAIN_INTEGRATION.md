# Blockchain Integration

This platform integrates Solana SPL token management with a browser wallet execution model.

## Solana Architecture

- Backend uses `@coral-xyz/anchor`, `@solana/spl-token`, and `@solana/web3.js` for on-chain coordination.
- Frontend uses browser wallet providers such as Phantom, Backpack, and Solflare.
- The system supports localnet, devnet, and custom RPC URLs.

## Wallet Integration

### Browser wallet detection

The frontend detects injected wallets through `window.phantom?.solana`, `window.backpack?.solana`, and `window.solflare`.

### Connection flow

- The `SolanaProvider` attempts a trusted reconnect on load.
- Users can explicitly connect or disconnect wallets.
- The provider tracks `connected`, `address`, `connecting`, and `disconnecting` state.

### Error handling

- Wallet errors are normalized into user-facing messages.
- Disconnect failures are handled gracefully without crashing the UI.

## SPL Token Flow

### Request types

- `MINT` — create new tokens on-chain or through an issuer-backed mint request
- `TRANSFER` — move tokens between source and destination token accounts
- `BURN` — burn tokens from an account with delegated authority

### Mint flow

1. Maker creates a mint request via the portal.
2. Backend validates request data and stores the request.
3. Checker approves the request.
4. Frontend or backend prepares on-chain mint instructions.
5. Wallet signs and submits the transaction.

### Transfer flow

1. Maker initiates a transfer request.
2. The source wallet must approve delegated authority to the program PDA.
3. Checker approves the request.
4. Execution uses `spl-token` transfer instructions and may create an ATA for the destination.

### Burn flow

1. Maker creates a burn request.
2. The source wallet delegates burn authority to the program PDA.
3. Checker approves and execution burns the token amount.

## Associated Token Account (ATA) handling

- Destination ATAs are created as needed during mint and transfer flows.
- The platform avoids duplicate ATAs by validating existing account addresses before creation.

## Transaction Lifecycle

- Requests move through draft, pending approval, approved, ready-for-execution, on-chain pending, executed, and failed.
- The backend records initiation and execution details, including transaction signatures and explorer URLs.
- On-chain retry and error logging are supported through the audit trail.

## Solana Bootstrap

The backend optionally bootstraps Solana config data when `SOLANA_BOOTSTRAP_MODE` is enabled.

- `SOLANA_CONFIG_ADDRESS` identifies the on-chain config account.
- Checker wallets and treasury accounts are recorded for validation.
- The backend handles strict, warn, or disabled bootstrap modes.

## Security Considerations

- Wallet signing is performed in the browser where private keys remain with the wallet.
- Backend-only operations are used for metadata and audit logging; sensitive key material is never stored in the frontend.
- Solana RPC URLs are configured through environment variables.

## Environment Variables

Key Solana variables in `backend/.env.example`:

- `SOLANA_RPC_URL`
- `SOLANA_COMMITMENT`
- `SOLANA_PROGRAM_ID`
- `SOLANA_PROGRAM_IDL_PATH`
- `SOLANA_CONFIG_ADDRESS`
- `SOLANA_CONFIG_KEYPAIR_PATH`
- `SOLANA_ADMIN_KEYPAIR_PATH`
- `SOLANA_MAKER_KEYPAIR_PATH`
- `SOLANA_CHECKER_KEYPAIR_PATH`
- `SOLANA_AUTO_BOOTSTRAP`
- `SOLANA_BOOTSTRAP_MODE`
