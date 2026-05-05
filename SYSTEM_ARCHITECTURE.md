# System Architecture

## Overview

This repository is a multi-layer token administration platform built for Solana SPL token operations with a browser wallet execution model.

- Frontend: React + Tailwind + Material UI
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL via Prisma
- Blockchain: Solana SPL token integration using Anchor, Web3.js and SPL Token
- Wallets: Phantom, Backpack, Solflare, or injected Solana providers
- Architecture: MVC + service-based structure with role-driven workflows

## Architecture Layers

### Frontend

The frontend is a Vite-powered React application. Key responsibilities:

- wallet detection, connection, and session management
- request preparation and execution for mint, transfer, burn flows
- UI routing for dashboards, admin panels, approvals, audits, and settlements
- data access through centralized API adapters
- role-aware navigation and visibility controls

Folder structure:

- `src/app` - app shell and provider wiring
- `src/components` - presentational and layout components
- `src/hooks` - reusable hooks including authentication and wallet context
- `src/modules` - API adapters and domain services
- `src/pages` - feature page implementations
- `src/utils` - constants, formatters, and helpers

### Backend

The backend is an Express API with layered controllers, services, validators, and Prisma models.

- `src/routes` - HTTP route declarations, authentication, and validation middleware
- `src/controllers` - request handlers and API response orchestration
- `src/services` - business logic, database operations, and external integrations
- `src/validators` - Zod schemas for request validation
- `src/config` - runtime configuration, Prisma bootstrap, and Solana initialization
- `src/utils` - shared helpers, response formatting, and error handling

### Blockchain

Solana integration is centered around program-managed token requests and browser wallet execution flows.

- browser wallet executes signer flows for mint, transfer, and burn when required
- backend records request metadata, execution payloads, and on-chain lifecycle events
- the system supports on-chain request delegation, ATA handling, and transaction tracking

## Request Flow

1. Maker creates a token request in the portal.
2. The backend validates and stores the request.
3. Checker reviews and approves or rejects the request.
4. On approve, the frontend or backend prepares the on-chain transaction payload.
5. The wallet signs and sends the transaction to the Solana network.
6. The backend records execution and updates request status.

## Authentication Flow

- `POST /api/auth/login` issues JWT tokens
- `GET /api/auth/me` returns the authenticated user profile
- roles drive access to pages and API endpoints
- sensitive operations are protected by `authMiddleware` and `roleMiddleware`

## Wallet Flow

- the frontend detects an injected Solana wallet on load
- the `SolanaProvider` manages connect, disconnect, and account changes
- wallet readiness is exposed through context to pages and actions
- if the browser wallet is unavailable, the UI surfaces a clear installation call-to-action

## API Structure

The API is structured in resource groups:

- `/api/auth`
- `/api/users`
- `/api/roles`
- `/api/wallets`
- `/api/token-requests`
- `/api/solana`
- `/api/managed-tokens`
- `/api/banks`
- `/api/reserves`
- `/api/settlements`
- `/api/payments`
- `/api/bips`
- `/api/cbs`
- `/api/audit-logs`

## Scaling Considerations

- stateless API design enables horizontal scaling behind a load balancer
- Prisma connection pooling can be tuned for concurrent database workloads
- frontend caching and API pagination limits burst traffic
- use separate Solana RPC providers per environment to isolate localnet, testnet, and production
- external payment and BIPS integrations should run in dedicated service layers
