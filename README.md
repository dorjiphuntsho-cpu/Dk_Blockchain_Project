# Dk Blockchain Project

## Overview

This repository supports a Solana token administration portal with an on-chain token request workflow.

- Frontend: React + Tailwind CSS + Material UI
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Blockchain: Solana SPL Token + Anchor + Phantom wallet integration
- Architecture: MVC + service layer

## Project Structure

- `backend/` — Express API, Prisma models, validators, services, and blockchain bootstrap
- `DK_Token_Frontend/` — React application, wallet provider, API adapters, and admin UI
- `dk-token/` — Anchor program, Solana deployment scripts, and program configuration
- `docs/` — environment runbooks and supporting documentation

## Key Features

- Role-based portal for ADMIN, MAKER, CHECKER, and EXECUTOR
- Token request lifecycle: draft, submit, approve, execute, and settle
- Solana wallet-based execution for mint, transfer, and burn operations
- Reserve, settlement, BIPS, and CBS integration layers
- Audit logging and operational dashboards

## Setup Instructions

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Update `backend/.env` with your database and Solana configuration.

### Frontend

```bash
cd DK_Token_Frontend
npm install
cp .env.example .env
```

### Local Solana Validator

```bash
solana-test-validator
```

### Start Backend and Frontend

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd DK_Token_Frontend
npm run dev
```

## Environment Variables

Backend uses `backend/.env` values defined in `backend/.env.example`.
Frontend uses `DK_Token_Frontend/.env` values from `DK_Token_Frontend/.env.example`.

## Recommended Workflow

1. Start the local validator.
2. Configure `backend/.env` and `DK_Token_Frontend/.env`.
3. Start the backend API.
4. Start the frontend app.
5. Connect a browser wallet and exercise maker/checker workflows.

## Documentation

The repository includes enterprise-grade documentation:

- `SYSTEM_ARCHITECTURE.md`
- `API_DOCUMENTATION.md`
- `DATABASE_SCHEMA.md`
- `BLOCKCHAIN_INTEGRATION.md`
- `DEPLOYMENT_GUIDE.md`
- `SECURITY_GUIDE.md`
- `CONTRIBUTING.md`

## Production Notes

- Use HTTPS in production.
- Secure `JWT_SECRET` and wallet key files.
- Use a dedicated Solana RPC provider for devnet/mainnet operations.
- Apply Prisma migrations with `npm run prisma:migrate`.

## Helpful Commands

Backend:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run start
```

Frontend:

```bash
cd DK_Token_Frontend
npm run build
npm run preview
```

## Contribution

See `CONTRIBUTING.md` for branch strategy, commit conventions, and code review expectations.
