# Changing Program ID and Testing

This guide is for doing a fresh devnet redeploy with a new Solana program id, then testing the portal end to end against that new deployment.

## Goal

Use a new program id on devnet so the app gets a fresh on-chain namespace for:

- config PDA
- request PDAs
- program-owned state

This does not delete old devnet history. It gives this project a clean new deployment to work against.

## Before you start

Make sure no one is actively using the current devnet environment.

You will update these files:

- [dk-token/programs/dk-token/src/lib.rs](D:\Office\Dk_Blockchain_Project\dk-token\programs\dk-token\src\lib.rs)
- [dk-token/Anchor.toml](D:\Office\Dk_Blockchain_Project\dk-token\Anchor.toml)
- [backend/.env](D:\Office\Dk_Blockchain_Project\backend\.env)
- [backend/.env.devnet](D:\Office\Dk_Blockchain_Project\backend\.env.devnet)

## 1. Create a new devnet program keypair

Choose a location for the new deploy keypair. Example:

```powershell
solana-keygen new --outfile C:\Users\itand\.config\solana\dk-token-devnet-v2.json
```

Get the public key from that keypair:

```powershell
solana address -k C:\Users\itand\.config\solana\dk-token-devnet-v2.json
```

Treat the returned address as:

```text
<NEW_DEVNET_PROGRAM_ID>
```

## 2. Update the program id in the Anchor program

Open [lib.rs](D:\Office\Dk_Blockchain_Project\dk-token\programs\dk-token\src\lib.rs) and replace the current:

```rust
declare_id!("49fwAJRLMtbCLLqZDZTBKZtwDaBTgm1oA1FWnidYDQJp");
```

with:

```rust
declare_id!("<NEW_DEVNET_PROGRAM_ID>");
```

## 3. Update Anchor.toml

Open [Anchor.toml](D:\Office\Dk_Blockchain_Project\dk-token\Anchor.toml) and replace the existing program id.

Update this block:

```toml
[programs.devnet]
dk_token = "<NEW_DEVNET_PROGRAM_ID>"
```

If you also want localnet to use the same id, update this block too:

```toml
[programs.localnet]
dk_token = "<NEW_DEVNET_PROGRAM_ID>"
```

## 4. Build the program

From the `dk-token` directory:

```powershell
anchor build
```

If you get a declared program id mismatch, it means `lib.rs` and the deploy keypair public key do not match yet.

## 5. Deploy to devnet with the new keypair

Make sure Solana CLI is pointed at devnet:

```powershell
solana config set --url https://api.devnet.solana.com
```

Deploy using the new program keypair:

```powershell
anchor deploy --provider.cluster devnet --program-keypair C:\Users\itand\.config\solana\dk-token-devnet-v2.json
```

After deploy, verify the deployed program id:

```powershell
solana program show <NEW_DEVNET_PROGRAM_ID>
```

## 6. Update backend env for the new devnet deployment

Open [backend/.env](D:\Office\Dk_Blockchain_Project\backend\.env) and [backend/.env.devnet](D:\Office\Dk_Blockchain_Project\backend\.env.devnet).

Set:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=<NEW_DEVNET_PROGRAM_ID>
SOLANA_PROGRAM_IDL_PATH=dk-token/target/idl/dk_token.json
SOLANA_CONFIG_ADDRESS=
```

Important:

- leave `SOLANA_CONFIG_ADDRESS` blank before first startup on the new program id
- do not keep the old config address after switching program id

## 7. Decide whether to reuse or rotate signer keypairs

Minimum clean setup:

- new program id
- new config keypair

Cleaner setup:

- new program id
- new config keypair
- new admin keypair
- new checker keypair

If you want a truly fresh devnet environment, use fresh signer keypairs too.

Relevant backend env values:

```env
SOLANA_CONFIG_KEYPAIR_PATH=<PATH_TO_NEW_DEVNET_CONFIG_KEYPAIR>
SOLANA_ADMIN_KEYPAIR_PATH=<PATH_TO_DEVNET_ADMIN_KEYPAIR>
SOLANA_CHECKER_KEYPAIR_PATH=<PATH_TO_DEVNET_CHECKER_KEYPAIR>
SOLANA_MAKER_KEYPAIR_PATH=
```

`SOLANA_MAKER_KEYPAIR_PATH` can stay blank if the maker uses Phantom/browser wallet flow.

## 8. Restart the backend and bootstrap fresh config

Start the backend with the updated devnet env.

On first startup, the backend should bootstrap or read a fresh config account for the new program id.

After startup, capture the new config PDA from logs or status checks, then write it back into:

```env
SOLANA_CONFIG_ADDRESS=<NEW_DEVNET_CONFIG_PDA>
```

Restart the backend once more after pinning the new config address.

## 9. Clear old portal data

Because your database records still point to the old program/accounts, clear the old data before testing the new deployment.

At minimum clear:

- managed tokens
- token requests
- approvals

Optional for a full reset:

- audit logs
- wallets
- users

If you keep old users and wallets, that is fine, but old request and token records should not remain.

## 10. Clear browser recovery/cache state

Clear local storage in the browser before testing.

This project stores request recovery data in:

- [tokenRequestRecovery.js](D:\Office\Dk_Blockchain_Project\DK_Token_Frontend\src\modules\tokenRequests\tokenRequestRecovery.js)

This avoids the new environment picking up stale recovery payloads from the old deployment.

## 11. Recreate managed tokens on the new deployment

Use the Solana Admin page to create fresh managed token mints.

Do not reuse the old managed token DB records from the old program deployment.

Old SPL mints may still exist on devnet, but they are part of the old history and should be treated as separate.

## 12. Verify frontend env

Make sure frontend devnet env still points to devnet:

- [DK_Token_Frontend/.env.devnet](D:\Office\Dk_Blockchain_Project\DK_Token_Frontend\.env.devnet)

Expected values:

```env
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

## 13. Test end to end

Run this smoke test in order:

1. Open Solana Admin and verify config/program/admin/checker status.
2. Create a managed token mint.
3. Create a mint request and sign with maker wallet.
4. Approve the mint request with checker wallet.
5. Confirm wallet balances update.
6. Create a transfer request and sign with maker wallet.
7. Approve the transfer with checker wallet.
8. Confirm destination wallet receives the token.
9. Create a burn request and sign with maker wallet.
10. Approve the burn with checker wallet.
11. Confirm supply and wallet balances update.
12. Test reject flow as well.

## 14. Quick validation commands

Check current Solana CLI cluster:

```powershell
solana config get
```

Check deployed program:

```powershell
solana program show <NEW_DEVNET_PROGRAM_ID>
```

Check admin balance:

```powershell
solana balance -k C:\Users\itand\.config\solana\admin-devnet.json
```

## Common mistakes

### Reusing the old config address

Do not keep the old `SOLANA_CONFIG_ADDRESS` after changing program id.

### Keeping old DB request/token records

Those records will still point at the old deployment and create confusion.

### Deploying with a keypair that does not match declare_id!

This causes `DeclaredProgramIdMismatch`.

### Testing with stale browser local storage

Old recovery payloads can interfere with fresh request flows.

## Recommended order summary

1. Create new program keypair
2. Get new program id
3. Update `lib.rs`
4. Update `Anchor.toml`
5. `anchor build`
6. `anchor deploy` to devnet
7. Update backend env program id and blank config address
8. Restart backend and bootstrap fresh config
9. Pin new config address
10. Clear DB data and browser local storage
11. Recreate managed tokens
12. Run full devnet smoke test
