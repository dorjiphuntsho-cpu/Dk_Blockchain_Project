# API Reference

Base URL: `/api`

## Public / Shared

- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/customer-login`
- `POST /api/bips/account-inquiry`
- `POST /api/bips/transfer`
- `GET /api/bips/transaction-status/:id`
- `GET /api/bips/bank-codes`

## Authenticated Core

- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/token-requests`
- `GET /api/settlements`
- `GET /api/reserves`
- `GET /api/payments/:paymentReference`

## Admin / Operations

- `/api/users`
- `/api/roles`
- `/api/wallets`
- `/api/banks`
- `/api/managed-tokens`
- `/api/solana/*`
- `/api/audit-logs`

## Workflow Endpoints

- Token requests:
  `POST /api/token-requests`
  `POST /api/token-requests/:id/submit`
  `POST /api/token-requests/:id/approve`
  `POST /api/token-requests/:id/reject`
  `POST /api/token-requests/:id/execute`
- Settlements:
  `POST /api/settlements/reserve-mint`
  `POST /api/settlements/interbank-transfer`
  `POST /api/settlements/redemptions`
  `POST /api/settlements/:id/run-inquiry`
  `POST /api/settlements/:id/reconcile`
  `POST /api/settlements/:id/execute`
- Customer payments:
  `POST /api/payments/customer/buy-btn`
  `POST /api/payments/customer/sell-btn`
  `POST /api/payments/customer/transfer-btn`
  `POST /api/payments/customer/:paymentReference/confirm-buy`
  `POST /api/payments/customer/:paymentReference/verify-status`

## Gateway / Callback

- `POST /api/payments/callback`
- `POST /api/payments/gateway/token`
- `POST /api/payments/gateway/sign-key`
- `POST /api/payments/gateway/initiate/transaction`
