# Solana Admin Portal Backend

Production-oriented off-chain backend for a Solana testnet token admin portal. This service handles users, roles, wallets, token request workflows, maker-checker approvals, audit logs, and PostgreSQL persistence so Solana execution can be plugged in later without major refactoring.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- JWT authentication
- bcrypt password hashing
- zod validation
- Helmet, CORS, Morgan

## Architecture

The backend follows an MVC-oriented layout with a service layer:

- `models/`: shared Prisma-facing shapes, serializers, and include definitions
- `controllers/`: thin HTTP handlers
- `services/`: business logic and workflow enforcement
- `routes/`: Express route registration
- `validators/`: request validation schemas
- `middlewares/`: auth, RBAC, validation, error handling
- `config/`: environment, Prisma client, startup bootstrap
- `utils/`: shared helpers and enums

## Project Structure

```text
backend/
  prisma/
    schema.prisma
    seed.js
  src/
    app.js
    server.js
    config/
      bootstrap.js
      env.js
      prisma.js
    controllers/
    middlewares/
    models/
    routes/
    services/
    utils/
    validators/
  .env
  .env.example
  package.json
  README.md
```

## Main Features

- JWT login and current-user endpoint
- RBAC with DB-backed role assignments
- User creation, update, activation, and role assignment
- Wallet creation, update, activation, and primary-wallet enforcement
- Token request lifecycle for `MINT`, `TRANSFER`, and `BURN`
- Maker-checker approval enforcement
- Audit logging for important business actions
- Pagination, filtering, and sorting on list endpoints
- Local-validator Solana execution integration for server-managed flows
- Health check endpoint at `GET /health`

## Request Workflow

1. `MAKER` creates a token request in `DRAFT`.
2. `MAKER` can edit only their own `DRAFT` request.
3. `MAKER` submits the request to move it to `PENDING_APPROVAL`.
4. `MAKER` can cancel a `PENDING_APPROVAL` request before it has been initiated on chain.
5. If the request has already been initiated on chain but is still pending checker action, `MAKER` can cancel it with a maker wallet signature.
6. `CHECKER` approves or rejects it. Maker and checker cannot be the same user.
7. `ADMIN` or `EXECUTOR` moves an approved request into the on-chain pending queue.
8. `ADMIN` or `EXECUTOR` records the final execution result as `EXECUTED` or `FAILED`.
9. Audit logs are written for each important transition and business action.

## Status Flow

- `DRAFT -> PENDING_APPROVAL`
- `PENDING_APPROVAL -> CANCELLED`
- `PENDING_APPROVAL -> APPROVED`
- `PENDING_APPROVAL -> REJECTED`
- `APPROVED -> READY_FOR_EXECUTION`
- `READY_FOR_EXECUTION -> EXECUTED`
- `READY_FOR_EXECUTION -> FAILED`

Invalid transitions are rejected in the service layer.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Set database and auth values.

4. Start the server:

```bash
npm start
```

For development:

```bash
npm run dev
```

## Environment Variables

You can configure the database in either of these ways.

### Option 1: Direct Prisma URL

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solana_admin_portal
```

### Option 2: Split DB Variables

```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=token_management
DB_USER=postgres
DB_PASSWORD=root
```

If `DATABASE_URL` is not set, the backend builds it automatically from the `DB_*` values. This same logic is used by both server startup and `prisma/seed.js`.

Other important variables:

- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`
- `AUTO_GENERATE_PRISMA`
- `AUTO_SYNC_DB`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `DEFAULT_MAKER_EMAIL`
- `DEFAULT_MAKER_PASSWORD`
- `DEFAULT_CHECKER_EMAIL`
- `DEFAULT_CHECKER_PASSWORD`
- `DEFAULT_EXECUTOR_EMAIL`
- `DEFAULT_EXECUTOR_PASSWORD`

## Startup Behavior

`npm start` runs `node src/server.js`.

On startup, the backend:

1. loads `.env`
2. builds `DATABASE_URL` from `DB_*` values if needed
3. checks whether the Prisma client is already generated
4. runs `prisma db push --skip-generate` if `AUTO_SYNC_DB=true`
5. connects Prisma to PostgreSQL
6. starts Express only after the DB connection succeeds

Notes:

- `AUTO_GENERATE_PRISMA=true` only generates Prisma client if the generated client is missing.
- `AUTO_SYNC_DB=true` syncs tables automatically using `prisma db push`.
- The PostgreSQL database itself must already exist. Startup creates tables/schema objects, not the database container.

## Prisma Commands

Generate Prisma client:

```bash
npm run prisma:generate
```

Create a development migration:

```bash
npm run prisma:migrate -- --name init
```

Deploy migrations:

```bash
npm run prisma:deploy
```

Seed default roles and users:

```bash
npm run prisma:seed
```

## Seed Data

The seed script inserts or updates:

- roles: `ADMIN`, `MAKER`, `CHECKER`, `EXECUTOR`
- default admin user
- default maker user
- default checker user
- default executor user

The seed uses `upsert`, so rerunning it is safe for existing seeded records.

Example defaults from `.env.example`:

- `admin@example.com / Admin@123`
- `maker@example.com / Maker@123`
- `checker@example.com / Checker@123`
- `executor@example.com / Executor@123`

## API Summary

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Users

- `POST /api/users`
- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/status`
- `POST /api/users/:id/roles`

### Roles

- `GET /api/roles`

### Wallets

- `POST /api/wallets`
- `GET /api/wallets`
- `GET /api/wallets/:id`
- `PATCH /api/wallets/:id`
- `PATCH /api/wallets/:id/status`

### Token Requests

- `POST /api/token-requests`
- `GET /api/token-requests`
- `GET /api/token-requests/:id`
- `PATCH /api/token-requests/:id`
- `POST /api/token-requests/:id/submit`
- `POST /api/token-requests/:id/cancel`
- `GET /api/token-requests/:id/prepare/maker-cancel`
- `POST /api/token-requests/:id/record-cancellation`
- `POST /api/token-requests/:id/approve`
- `POST /api/token-requests/:id/reject`
- `POST /api/token-requests/:id/mark-ready`
- `POST /api/token-requests/:id/record-execution`

### Audit Logs

- `GET /api/audit-logs`

### Health

- `GET /health`

## Example Payloads

### Login

```json
{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

### Create User

```json
{
  "fullName": "New Maker",
  "email": "newmaker@example.com",
  "password": "Password@123",
  "roles": ["MAKER"]
}
```

### Create Wallet

```json
{
  "userId": "user-uuid",
  "walletAddress": "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
  "label": "Primary treasury",
  "isPrimary": true
}
```

### Create Token Request

```json
{
  "requestType": "TRANSFER",
  "tokenMintAddress": "9xQeWvG816bUx9EPjHmaT23yvVMpJERqS5eSeyabW8Lx",
  "amount": "100.25",
  "sourceWalletId": "wallet-uuid-1",
  "destinationWalletId": "wallet-uuid-2",
  "remarks": "Internal test transfer"
}
```

### Reject Token Request

```json
{
  "rejectionReason": "Missing supporting business approval",
  "comment": "Please attach approval reference and resubmit"
}
```

### Record Execution

```json
{
  "status": "EXECUTED",
  "txSignature": "solana-signature-placeholder",
  "explorerUrl": "https://explorer.solana.com/tx/solana-signature-placeholder?cluster=testnet"
}
```

## Solana Integration

The backend can now execute token requests against the local validator using the Anchor program in `../dk-token`.

Required environment variables:

- `SOLANA_RPC_URL`
- `SOLANA_PROGRAM_ID`
- `SOLANA_PROGRAM_IDL_PATH`
- `SOLANA_CONFIG_ADDRESS`
- `SOLANA_CONFIG_KEYPAIR_PATH`
- `SOLANA_ADMIN_KEYPAIR_PATH`
- `SOLANA_MAKER_KEYPAIR_PATH`
- `SOLANA_CHECKER_KEYPAIR_PATH`
- `SOLANA_AUTO_BOOTSTRAP`

Bootstrap behavior:

- If `SOLANA_AUTO_BOOTSTRAP=true`, backend startup will ensure the on-chain `Config` account exists.
- If `SOLANA_CONFIG_KEYPAIR_PATH` points to a missing file, the backend will generate a new config keypair there.
- If the config account is missing on chain, the backend will call `initialize`.
- If the configured checker wallet is not yet registered, the backend will call `add_checker`.

Execution behavior:

- `prepareMintExecutionPayload`, `prepareTransferExecutionPayload`, and `prepareBurnExecutionPayload` now return real local-validator execution context.
- `POST /api/token-requests/:id/execute` executes an on-chain pending request and records the result automatically.
- The backend uses configured server-managed maker and checker wallets for local execution.

Current limitation:

- For `TRANSFER` and `BURN`, the source wallet in the request must match the configured backend maker wallet because the backend must sign both the token delegation and the on-chain request creation step.
- This is suitable for local-validator integration and admin-portal demos, but browser-wallet-driven user custody will still require frontend signing flows later.

## Windows and WSL Notes

If you install dependencies in Windows and then run the project in WSL, native modules such as `bcrypt` can fail with errors like `invalid ELF header`.

Use one environment consistently:

- Windows install + Windows run
- WSL install + WSL run

If you switch environments, reinstall dependencies in that environment:

```bash
rm -rf node_modules package-lock.json
npm install
```

Also note:

- In WSL, `localhost` refers to the WSL environment, not Windows PostgreSQL.
- If PostgreSQL is running on Windows and you run the backend in WSL, `DB_HOST=localhost` may fail unless PostgreSQL is reachable from WSL.

## Production Notes

- Use a strong `JWT_SECRET`.
- Prefer `prisma migrate deploy` in production instead of development migration commands.
- Consider disabling `AUTO_SYNC_DB` in stricter production environments if schema changes should be controlled explicitly.
- Put the API behind a reverse proxy and manage TLS there.
- Add structured logging and background execution workers when Solana integration is introduced.
