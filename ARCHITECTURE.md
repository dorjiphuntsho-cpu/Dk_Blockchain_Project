# Architecture

## Runtime

- Frontend calls backend REST APIs under `/api`
- Backend handles auth, workflows, database persistence, and external integrations
- Solana execution is split between backend-managed signers and browser-wallet flows

## Main Domains

- Auth and role-based access: `ADMIN`, `MAKER`, `CHECKER`, `EXECUTOR`
- Token requests: mint, transfer, burn
- Settlements: reserve mint, replenishment mint, interbank transfer, redemption
- Banking: banks, reserve accounts, token accounts, customer bank accounts
- Payments: payment gateway, BIPS, CBS, reconciliation

## Storage

- PostgreSQL via Prisma
- Core records: users, wallets, token requests, settlement requests, reserve ledgers, payment transactions, audit logs, managed tokens

## Integration Flow

- Token requests and settlements are created in backend
- Approval and execution state is persisted in PostgreSQL
- Solana service records on-chain signatures and explorer links
- Fiat fallback and customer payment flows use payment gateway and BIPS status verification
