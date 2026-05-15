# Deployment

## Order

1. Provision PostgreSQL
2. Configure backend env and keypair paths
3. Run Prisma deploy steps
4. Deploy backend
5. Set frontend `VITE_API_BASE_URL`
6. Build and deploy frontend
7. Deploy or update Anchor program if required

## Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start
```

## Frontend

```bash
cd DK_Token_Frontend
npm install
npm run build
```

## Operational Checks

- `GET /health` returns `200`
- Backend can connect to PostgreSQL
- Solana RPC and keypair paths are valid
- Payment gateway, BIPS, and CBS credentials are present where needed
- Frontend points to the correct backend base URL
