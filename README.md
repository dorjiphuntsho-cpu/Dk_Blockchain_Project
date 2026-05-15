# DK Blockchain Project

Solana-based BTN operations platform with:
- `backend/`: Express + Prisma API
- `DK_Token_Frontend/`: React + Vite portal
- `dk-token/`: Anchor program and Solana scripts

## Stack

- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: React 19, Vite, Tailwind, Zustand
- Blockchain: Solana Web3, SPL Token, Anchor
- Integrations: BIPS, CBS, payment gateway

## Setup

```bash
cd backend && npm install
cd ../DK_Token_Frontend && npm install
cd ../dk-token && npm install
```

Create:
- `backend/.env`
- `DK_Token_Frontend/.env` if needed

## Run

```bash
cd backend && npm run dev
cd DK_Token_Frontend && npm run dev
```

Optional:

```bash
cd dk-token && npm run build:anchor
```

## Build

```bash
cd DK_Token_Frontend && npm run build
cd backend && npm run start
```

## Deployment Summary

- Deploy PostgreSQL first
- Apply Prisma migrations from `backend/`
- Configure backend env, keypair paths, and RPC
- Build and deploy frontend with `VITE_API_BASE_URL`
- Deploy Anchor program separately if program ID changes

## Docs

- [INSTALLATION.md](INSTALLATION.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
