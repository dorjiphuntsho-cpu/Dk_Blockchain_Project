# Project Structure

- `backend/`
  Express API, Prisma schema, services, controllers, validators, scripts
- `backend/src/routes/`
  REST route registration for auth, token requests, settlements, payments, banks, Solana, audit logs
- `backend/src/services/`
  Business logic and integration clients
- `backend/prisma/`
  Prisma schema and seed logic
- `DK_Token_Frontend/src/app/`
  App bootstrap and Solana provider
- `DK_Token_Frontend/src/pages/`
  Route-level screens
- `DK_Token_Frontend/src/modules/`
  Feature-specific schemas and helpers
- `DK_Token_Frontend/src/services/`
  API client layer
- `dk-token/`
  Anchor program, tests, scripts, config
- `docs/`
  Supplemental runbooks
