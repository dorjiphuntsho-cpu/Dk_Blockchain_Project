# Payment Integration

## Scope

This document defines the repo-specific implementation plan for integrating the intra-bank payment gateway as the reserve source for `DK Bank`.

The payment gateway will not mint tokens directly.

The intended operating model is:

1. customer pays fiat through the payment gateway
2. backend verifies and stores the payment transaction
3. backend creates a `ReserveLedger` entry for `DK Bank`
4. checker approves the reserve if required
5. maker creates a `Reserve Mint` settlement against that reserve
6. checker verifies the mint request
7. BTN is minted to the `DK Bank` treasury token account

## Core Rule

Payment success does not equal token issuance.

Payment success only creates minting capacity through reserve.

Minting remains a separate controlled action through the maker/checker settlement flow.

## Sprint A: Payment Gateway Foundation

Goal: ingest intra-bank payment confirmations into the backend.

Tasks:

1. Add a `PaymentTransaction` model in `backend/prisma/schema.prisma`
2. Add gateway env vars in:
   - `backend/.env.example`
   - `backend/src/config/env.js`
3. Create:
   - `backend/src/services/payments.service.js`
   - `backend/src/controllers/payments.controller.js`
   - `backend/src/routes/payments.routes.js`
   - `backend/src/validators/payments.validation.js`
4. Wire payment routes into `backend/src/routes/index.js`
5. Support:
   - gateway callback or webhook ingestion
   - transaction lookup by payment reference
   - transaction status verification
6. Persist:
   - raw gateway payload
   - parsed gateway status
   - payment reference
   - amount
   - currency
   - payer metadata

Done when:

- backend can receive a payment confirmation and store one `PaymentTransaction`

## Sprint B: Payment To Reserve Conversion

Goal: convert confirmed gateway payments into DK reserve entries.

Tasks:

1. Create reserve-ingestion logic in:
   - `backend/src/services/reserve.service.js`
   - or extend existing reserve logic cleanly
2. On confirmed gateway payment:
   - create a `ReserveLedger` entry for `DK Bank`
3. Use:
   - `referenceType = PAYMENT_GATEWAY`
   - `referenceId = payment reference`
4. Make reserve creation idempotent
5. Start reserve status as:
   - `PENDING` recommended
6. Add audit logs for:
   - payment recorded
   - reserve created

Done when:

- one successful payment produces one reserve entry for `DK Bank`

## Sprint C: Reserve API

Goal: expose reserve data for maker/checker workflows.

Tasks:

1. Create:
   - `backend/src/controllers/reserve.controller.js`
   - `backend/src/routes/reserve.routes.js`
   - `backend/src/validators/reserve.validation.js`
2. Add endpoints:
   - `GET /api/reserves`
   - `GET /api/reserves/:id`
   - `POST /api/reserves/:id/approve`
   - `POST /api/reserves/:id/reject`
3. Support filters:
   - `bankId`
   - `status`
   - `referenceType`

Done when:

- approved DK reserves can be queried directly from the frontend

## Sprint D: Reserve UI

Goal: allow operations to review and approve payment-backed reserves.

Tasks:

1. Create frontend module files:
   - `DK_Token_Frontend/src/modules/reserves/reserves.api.js`
   - `DK_Token_Frontend/src/modules/reserves/reserves.schemas.js`
2. Create frontend pages:
   - `DK_Token_Frontend/src/pages/reserves/ReservesPage.jsx`
   - `DK_Token_Frontend/src/pages/reserves/ReserveDetailsPage.jsx`
3. Add routes and navigation
4. Show:
   - payment reference
   - amount
   - currency
   - reserve status
   - created time
   - approval status
5. Add approve/reject actions for checker or admin

Done when:

- checker can review payment-backed reserve entries in the UI

## Sprint E: Connect Reserve Mint To Payment Reserves

Goal: reserve mint uses payment-backed approved reserves.

Tasks:

1. Update `DK_Token_Frontend/src/pages/settlements/SettlementCreatePage.jsx`
2. Load reserve options from reserve API instead of relying only on embedded bank data
3. For reserve mint flow:
   - default source bank to `DK Bank`
   - show only approved reserves
   - show only payment-backed reserves
4. Keep token mint dropdown restricted to DK-linked mints
5. Use human-readable reserve labels like:
   - `PAYMENT_GATEWAY / REF123 / Available 10000 BTN`

Done when:

- maker can create reserve mint only from valid payment-backed reserves

## Sprint F: Checker Approval And Mint Consumption

Goal: reserve-backed mint consumes reserve correctly.

Tasks:

1. Confirm reserve mint approval flow still:
   - checks reserve ownership
   - checks reserve available amount
   - locks reserve before mint initiation
   - consumes reserve after successful mint execution
2. Tighten audit logs if needed
3. Confirm supply is minted only to `DK Bank` treasury token account

Done when:

- approved reserve-backed mint reduces available reserve and increases DK treasury token balance

## Sprint G: Payment Reconciliation

Goal: handle missed callbacks and pending payment states.

Tasks:

1. Add:
   - `backend/scripts/reconcile-payments.js`
2. Re-check pending payment transactions through gateway status APIs
3. Update payment transaction status
4. Create reserve on late success if not already created
5. Detect duplicates and mismatches
6. Send uncertain cases to manual review if needed

Done when:

- payment state can be reconciled without relying only on callback delivery

## Sprint H: Testing And UAT

Goal: verify payment-to-reserve-to-mint flow end to end.

Tasks:

1. Backend automated tests:
   - payment success creates reserve
   - duplicate callback does not duplicate reserve
   - failed payment creates no reserve
   - approved reserve can be used in reserve mint
   - insufficient reserve blocks mint
2. Manual UAT:
   - payment confirmed
   - reserve created
   - reserve approved
   - reserve mint settlement created
   - checker verifies
   - BTN minted to DK treasury token account

Done when:

- intra-bank payment integration is operational and auditable

## Data To Capture

### PaymentTransaction

Recommended fields:

- `id`
- `gatewayName`
- `paymentReference`
- `customerReference`
- `payerName`
- `payerAccount`
- `amount`
- `currency`
- `status`
- `rawRequest`
- `rawResponse`
- `confirmedAt`
- `createdAt`
- `updatedAt`

### ReserveLedger

For gateway-created reserve entries:

- `bankId = DK Bank`
- `referenceType = PAYMENT_GATEWAY`
- `referenceId = payment reference`
- `amount`
- `availableAmount`
- `status`

## Important Constraints

1. Gateway callback must be idempotent
2. Payment success must not mint tokens automatically
3. Reserve and mint must remain separate workflow steps
4. Mint destination must remain `DK Bank` treasury token account

## Recommended Start

Start with:

1. Sprint A
2. Sprint B
3. Sprint C

That gives the system a proper reserve source before expanding the UI and mint workflows.



Dk accounts 
100100223740
110158212197
100100353884
100100426695
100100414316 (Account not used) this will be used for reserve meaning all the payment done by users will go to this account so it can be used for minting the BTN token