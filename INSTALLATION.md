# Installation

## Prerequisites

- Node.js 18+
- PostgreSQL
- Solana CLI
- Anchor CLI for `dk-token/`

## Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Frontend

```bash
cd DK_Token_Frontend
npm install
npm run dev
```

## Anchor Program

```bash
cd dk-token
npm install
npm run build:anchor
```

## Notes

- Backend defaults to port `5000`
- Frontend defaults to Vite local dev server
- Set `VITE_API_BASE_URL=http://localhost:5000/api` for local frontend usage
