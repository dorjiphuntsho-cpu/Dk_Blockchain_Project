# Program ID Backup Snapshot

Created: `2026-04-24 11:36:24 +06:00`

Purpose: rollback reference before changing the Solana program id and redeploying on devnet.

## Git snapshot

- Branch: `test-net`
- Commit: `8addf01a1e6d8609403a3536695a1ac74840b96f`

## Current active devnet values

- Program ID: `49fwAJRLMtbCLLqZDZTBKZtwDaBTgm1oA1FWnidYDQJp`
- Backend RPC: `https://api.devnet.solana.com`
- Frontend cluster: `devnet`
- Frontend RPC: `https://api.devnet.solana.com`
- Backend IDL path: `dk-token/target/idl/dk_token.json`
- Backend config keypair: `C:\Users\itand\.config\solana\dk-config-devnet.json`
- Backend admin keypair: `C:\Users\itand\.config\solana\admin-devnet.json`
- Backend checker keypair: `C:\Users\itand\.config\solana\checker-devnet.json`

## Files snapshotted in this folder

- `lib.rs.snapshot`
- `Anchor.toml.snapshot`
- `backend.env.snapshot`
- `backend.env.devnet.snapshot`
- `frontend.env.devnet.snapshot`

## Restore checklist

If the new branch or redeploy breaks, restore these values first:

1. Put the old program id back into `dk-token/programs/dk-token/src/lib.rs`.
2. Put the old program id back into `dk-token/Anchor.toml`.
3. Restore backend env values from `backend.env.snapshot` or `backend.env.devnet.snapshot`.
4. Restore frontend env values from `frontend.env.devnet.snapshot`.
5. Restart backend and frontend.
6. If you changed database data during testing, restore or reseed the DB separately.
7. If you created a new program deployment on devnet, that deployment will still exist, but your app can ignore it once these old values are restored.

## Important note

This backup restores code and env configuration only. It does not roll back:

- devnet transactions
- devnet program deployments
- devnet mints
- database resets already applied

//deployment command
anchor deploy --provider.cluster devnet --provider.wallet /mnt/c/Users/itand/.config/solana/admin-devnet.json