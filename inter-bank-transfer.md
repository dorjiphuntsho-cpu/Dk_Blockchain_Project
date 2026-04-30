# Inter-Bank Transfer Implementation Plan

## Purpose

This document breaks the inter-bank transfer upgrade into delivery sprints for this repository.

The target system adds:

- reserve-backed BTN minting by DK Bank
- interbank BTN transfer between bank treasury accounts
- fiat fallback through BIPS when the destination bank does not support BTN settlement
- reconciliation and operational visibility for mixed on-chain and off-chain settlement

## Current Repo Baseline

The current repository already provides:

- Solana token mint, transfer, and burn request flows in `dk-token`
- backend request orchestration in `backend/src/services/tokenRequest.service.js`
- Solana integration in `backend/src/services/solana.service.js`
- admin and request UX in `DK_Token_Frontend/src/pages/solana/*` and `DK_Token_Frontend/src/pages/tokenRequests/*`

The new work should add a bank settlement layer around the existing Solana execution model rather than replacing it immediately.

The approved operating model for this project is:

- DK Bank is the single issuing institution for BTN
- DK Bank holds the fiat reserve that backs BTN issuance
- users acquire BTN by providing fiat that increases DK Bank reserve backing
- if circulating BTN supply decreases, DK Bank may mint additional BTN later if approved reserve support exists
- reminting is a controlled workflow, not an automatic trigger

## Delivery Principles

- Keep raw BIPS integration isolated in a dedicated backend service.
- Keep bank treasury data separate from user wallet data.
- Treat `TokenRequest` as a Solana execution primitive, not as the full interbank business workflow.
- Add a new settlement workflow for reserve issuance, interbank transfer, redemption, and BIPS routing.
- Do not auto-mint when reserve increases or supply decreases.
- Do not burn before defining failure recovery and reconciliation states.
- Treat DK Bank as the reserve holder and primary issuer in version one.

## Sprint 0: Finalize Business Rules

### Goal

Lock and sign off the business rules before implementation starts.

### Finalized Rules

- DK Bank is the primary issuer of BTN.
- DK Bank mints BTN only against approved fiat reserve support.
- User fiat added for BTN acquisition increases DK Bank reserve-backed minting capacity.
- Admin creates and manages BTN mint configuration.
- Maker initiates mint requests when issuance is needed.
- Checker approves reserve-backed issuance before execution.
- Initial token mint configuration does not require checker approval in version one.
- DK Bank maintains:
  - one reserve settlement account
  - one operational BIPS settlement account
  - one treasury wallet
  - one BTN treasury token account per supported mint
- If a receiving bank has active BTN settlement capability, use on-chain BTN transfer.
- If a receiving bank does not have BTN settlement capability, use BIPS fiat fallback.
- BIPS beneficiary account inquiry is mandatory before outgoing fiat fallback.
- If BTN is burned and BIPS is uncertain or failed, move the settlement to `MANUAL_REVIEW`.
- The system must not auto-remint after BIPS uncertainty.
- Incoming fiat does not auto-mint BTN. Fiat receipt increases reserve-backed capacity and still requires mint workflow approval.
- If circulating supply decreases, DK Bank may perform replenishment minting later only when approved reserve support exists.
- Supply decrease alone does not trigger minting automatically.
- BIPS retries must be reconciliation-driven and protected by `request_id` idempotency.
- Manual intervention is required for uncertain burn-plus-BIPS outcomes and other settlement exceptions.

### Remaining Open Questions

- Confirm whether reserve proof requires attachment upload, reference number only, or both.
- Confirm whether `ADMIN` and `EXECUTOR` are separate roles in version one.
- Confirm whether the first release supports only one BTN mint or multiple BTN mints.
- Confirm whether partial settlement is allowed during exception handling.
- Confirm who is authorized to resolve `MANUAL_REVIEW`.

### Deliverables

- signed-off business flow document
- settlement state diagram
- failure recovery rules
- implementation baseline documented in `inter-bank-transfer-rules.md`

## Sprint 1: Data Model And Seed Foundation

### Goal

Add the core database structures for banks, treasury mapping, reserves, settlements, and BIPS transaction logging.

### Backend Tasks

- Update `backend/prisma/schema.prisma`.
- Add enum `SettlementRequestType` with:
  - `RESERVE_MINT`
  - `INTERBANK_TRANSFER`
  - `REDEMPTION`
- Add enum `SettlementMode` with:
  - `ON_CHAIN_BTN`
  - `BIPS_FIAT`
- Add enum `SettlementStatus` with:
  - `DRAFT`
  - `PENDING_APPROVAL`
  - `APPROVED`
  - `INQUIRY_PENDING`
  - `INQUIRY_FAILED`
  - `READY_FOR_EXECUTION`
  - `BIPS_PENDING`
  - `SETTLED`
  - `FAILED`
  - `MANUAL_REVIEW`
  - `CANCELLED`
- Add enum `ReserveStatus` with:
  - `PENDING`
  - `APPROVED`
  - `LOCKED`
  - `CONSUMED`
  - `RELEASED`
  - `REJECTED`
- Add model `Bank`.
- Add model `BankAccount`.
- Add model `BankTokenAccount`.
- Add model `ReserveLedger`.
- Add model `SettlementRequest`.
- Add model `BipsTransactionLog`.
- Add indexes for:
  - bank code
  - settlement status
  - settlement mode
  - request id
  - reference number
  - transaction id

### Seed Tasks

- Update `backend/prisma/seed.js`.
- Seed the BIPS bank dictionary:
  - `DK / 1060 / 667707 / 94009405`
  - `BOB / 1010 / 502237 / 94009400`
  - `BNB / 1020 / 639545 / 94009401`
  - `DPNB / 1030 / 502942 / 94009402`
  - `T-Bank / 1040 / 636243 / 94009403`
  - `BDBL / 1050 / 637053 / 94009404`
- Add default bank flags:
  - `supportsBtn`
  - `isActive`
  - `isIssuer`
  - `supportsBipsSettlement`
- Mark `DK` as the primary issuer bank in seed data.

### Environment Tasks

- Extend `backend/.env.example`.
- Extend `backend/src/config/env.js` for future BIPS configuration fields.

### Deliverables

- updated Prisma schema
- updated seed script
- bank master data available in database
- reserve state model supports available, locked, consumed, and released capacity

## Sprint 2: Bank Master And Treasury Management

### Goal

Create repo-level support for managing banks, treasury settlement accounts, and BTN token accounts.

### Backend Tasks

- Add `backend/src/routes/bank.routes.js`.
- Add `backend/src/controllers/bank.controller.js`.
- Add `backend/src/services/bank.service.js`.
- Add `backend/src/validators/bank.validation.js`.
- Add `backend/src/models/bank.model.js`.
- Wire `/banks` into `backend/src/routes/index.js`.
- Add APIs to:
  - list banks
  - get bank details
  - update bank status and BTN capability
  - update issuer status with DK-only protection in version one
  - register or update treasury settlement account
  - register or update treasury wallet
  - register or update treasury token account
  - register or update reserve account details

### Frontend Tasks

- Add `DK_Token_Frontend/src/modules/banks/banks.api.js`.
- Add `DK_Token_Frontend/src/modules/banks/banks.schemas.js`.
- Add `DK_Token_Frontend/src/pages/banks/BanksPage.jsx`.
- Add `DK_Token_Frontend/src/pages/banks/BankDetailsPage.jsx`.
- Update `DK_Token_Frontend/src/app/router.jsx`.
- Update `DK_Token_Frontend/src/utils/constants.js` navigation and route titles.

### Deliverables

- admin can manage bank master data
- admin can map treasury accounts and BTN token accounts
- admin can identify DK Bank as issuer and reserve holder

## Sprint 3: BIPS Integration Layer

### Goal

Add a dedicated BIPS service wrapper and transaction logging without yet coupling it to final settlement orchestration.

### Backend Tasks

- Add `backend/src/services/bips.service.js`.
- Implement account inquiry request builder and parser.
- Implement outgoing transfer request builder and parser.
- Implement status check wrapper.
- Implement live inquiry wrapper.
- Persist all BIPS calls into `BipsTransactionLog`.
- Store:
  - request type
  - request id
  - reference number
  - transaction id
  - raw payload
  - parsed payload
  - response status
  - response message

### API Tasks

- Add internal or admin-only routes:
  - `POST /bips/account-inquiry`
  - `POST /bips/outgoing`
  - `GET /bips/status`
  - `GET /bips/live-inquiry`

### Config Tasks

- Extend `backend/src/config/env.js` with:
  - `BIPS_BASE_URL`
  - `BIPS_TIMEOUT_MS`
  - `BIPS_API_USER_ID`
  - `BIPS_API_PASSWORD`
  - `BIPS_CLIENT_ID`
  - `BIPS_CHANNEL_TYPE`
  - `BIPS_ACCINQ_API_KEY`
  - `BIPS_IMPSCR_API_KEY`
  - `BIPS_SOURCE_BANK_CODE`
  - `BIPS_SOURCE_BIN_NUMBER`
  - `BIPS_SOURCE_PAN_NUMBER`

### Deliverables

- reusable BIPS service
- persistent BIPS request and response audit trail
- request id and duplicate handling base

## Sprint 4: Settlement Workflow Backend

### Goal

Add the main business orchestration layer for reserve minting and interbank settlement.

### Backend Tasks

- Add `backend/src/routes/settlement.routes.js`.
- Add `backend/src/controllers/settlement.controller.js`.
- Add `backend/src/services/settlement.service.js`.
- Add `backend/src/validators/settlement.validation.js`.
- Add `backend/src/models/settlement.model.js`.
- Wire `/settlements` into `backend/src/routes/index.js`.

### Service Tasks

- Implement `createReserveMintRequest`.
- Implement `approveReserveMintRequest`.
- Implement reserve locking before execution.
- Implement `createInterbankTransferRequest`.
- Implement `routeSettlement`.
- Implement route decision:
  - `ON_CHAIN_BTN` when destination bank has BTN treasury token account and supports BTN
  - `BIPS_FIAT` when destination bank lacks BTN settlement capability
- Implement `createRedemptionRequest`.
- Implement `createReplenishmentMintRequest`.
- Persist settlement timeline and route decision metadata.

### Audit Tasks

- Extend `backend/src/utils/enums.js`.
- Add `AUDIT_ENTITY_TYPES`:
  - `BANK`
  - `RESERVE_LEDGER`
  - `SETTLEMENT_REQUEST`
  - `BIPS_TRANSACTION`
- Add `AUDIT_ACTIONS`:
  - `ROUTE_SETTLEMENT`
  - `BIPS_INQUIRY`
  - `BIPS_OUTGOING`
  - `BIPS_RECONCILE`
  - `RESERVE_APPROVE`
  - `RESERVE_CONSUME`

### Deliverables

- settlement workflow persisted in backend
- route selection logic available
- audit trail extended for settlement operations
- reserve-backed issuance and replenishment requests modeled explicitly

## Sprint 5: Reserve-Backed Mint Execution

### Goal

Enable approved reserve entries to mint BTN into the DK Bank treasury token account.

### Backend Tasks

- Extend `backend/src/services/solana.service.js` with helper methods:
  - `resolveBankTreasuryTokenAccount`
  - `mintToBankTreasury`
- Extend `backend/src/services/settlement.service.js` to:
  - validate approved reserve
  - validate available reserve-backed capacity
  - lock reserve capacity before execution
  - consume reserve ledger entry
  - execute mint through existing Solana flow
  - update settlement status to settled or failed

### Integration Tasks

- Decide whether to:
  - call existing on-chain mint request flow via `TokenRequest`, or
  - perform direct Solana mint orchestration from settlement service
- Record resulting:
  - mint transaction signature
  - explorer URL
  - treasury token account

### Frontend Tasks

- Add reserve mint form in:
  - `DK_Token_Frontend/src/pages/settlements/SettlementCreatePage.jsx`
- Add reserve ledger details to settlement detail view.

### Deliverables

- reserve-backed issuance flow working end to end
- reserve ledger consumption tracked
- DK Bank reserve capacity controls enforced during minting

## Sprint 6: Supply Replenishment Minting

### Goal

Allow DK Bank to mint additional BTN after supply reduction when approved reserve-backed capacity is available.

### Backend Tasks

- Extend `backend/src/services/settlement.service.js` to support replenishment mint requests.
- Validate that replenishment minting uses approved reserve-backed capacity.
- Prevent auto-minting when reserve grows or supply drops.
- Require explicit maker request and checker approval for replenishment minting.
- Record replenishment reason and related reserve basis.

### Frontend Tasks

- Extend settlement creation flow to support replenishment mint reason capture.
- Show replenishment mint type distinctly from initial reserve mint requests.

### Deliverables

- replenishment minting works as a controlled workflow
- supply reduction does not trigger automatic minting

## Sprint 7: Direct Interbank BTN Transfer

### Goal

Support direct BTN settlement from one bank treasury token account to another bank treasury token account.

### Backend Tasks

- Extend `backend/src/services/solana.service.js` with:
  - `transferBetweenBankTreasuries`
- Extend `backend/src/services/settlement.service.js` to:
  - validate source bank treasury token balance
  - validate destination bank BTN token account
  - execute transfer
  - store transaction signature and explorer URL

### Frontend Tasks

- Extend settlement creation form to capture:
  - source bank
  - destination bank
  - token mint
  - amount
  - transfer purpose
- Show route preview before submission:
  - `BTN transfer`
  - `Fiat via BIPS`

### Deliverables

- treasury-to-treasury BTN transfer working
- route preview visible in UI

## Sprint 8: Fiat Fallback With Burn And BIPS Outgoing

### Goal

When destination bank cannot receive BTN, redeem value from BTN and settle in fiat through BIPS.

### Backend Tasks

- Extend `backend/src/services/solana.service.js` with:
  - `burnFromBankTreasury`
- Extend `backend/src/services/settlement.service.js` to:
  - perform account inquiry
  - validate beneficiary account
  - create BIPS outgoing transfer
  - record request id, reference number, and status
- Decide execution order:
  - lock request
  - perform burn or reserve hold
  - perform BIPS outgoing
  - persist result and reconciliation state

### API Tasks

- Require frontend-generated `request_id` for BIPS-bound flows.
- Add settlement payload fields:
  - beneficiary account number
  - beneficiary account name
  - beneficiary bank code
  - source account number
  - source account name
  - transfer purpose
  - request id

### Frontend Tasks

- Extend settlement create form for fiat fallback details.
- Show account inquiry response before final execution if required by business flow.
- Show BIPS reference number on detail page.

### Deliverables

- fallback route from BTN to fiat through BIPS working
- settlement records include BIPS references

## Sprint 9: Reconciliation, Retry, And Operational Safety

### Goal

Handle the reality that BIPS may time out, show success incorrectly, or require later verification.

### Backend Tasks

- Add `backend/src/services/settlementReconciliation.service.js`.
- Optionally add `backend/scripts/reconcile-bips.js`.
- Poll:
  - `pg_transaction_status`
  - `live-inquery`
- Reconcile pending settlements from:
  - `INQUIRY_PENDING`
  - `BIPS_PENDING`
- Add duplicate request protection using request id.
- Add safe retry rules.
- Add manual intervention flags for operations.

### Status Tasks

- Expand settlement state handling for:
  - pending inquiry
  - inquiry failure
  - BIPS pending
  - settled
  - failed
  - manual review

### Frontend Tasks

- Add status badges and timeline states for reconciliation.
- Add admin action to manually trigger reconciliation.

### Deliverables

- pending BIPS cases can be reconciled
- operational retry and manual review path exists

## Sprint 10: Settlement UI And Monitoring

### Goal

Provide operations visibility for bank transfers, reserve issuance, and BIPS transaction progression.

### Frontend Tasks

- Add `DK_Token_Frontend/src/modules/settlements/settlements.api.js`.
- Add `DK_Token_Frontend/src/modules/settlements/settlements.schemas.js`.
- Add `DK_Token_Frontend/src/pages/settlements/SettlementsPage.jsx`.
- Add `DK_Token_Frontend/src/pages/settlements/SettlementCreatePage.jsx`.
- Add `DK_Token_Frontend/src/pages/settlements/SettlementDetailsPage.jsx`.
- Add timeline visualization using existing shared components where possible.
- Reuse:
  - `PageHeader`
  - `InfoPanel`
  - `StatusChip`
  - `RequestTimeline`

### Dashboard Tasks

- Extend `backend/src/services/dashboard.service.js` for settlement metrics.
- Extend `DK_Token_Frontend/src/pages/dashboard/DashboardPage.jsx`.
- Add dashboard metrics:
  - reserve mint count
  - BTN transfer count
  - fiat fallback count
  - pending reconciliation count
  - failed settlement count

### Deliverables

- operational dashboard for settlement
- dedicated settlement list and detail UX

## Sprint 11: Contract Hardening And Policy Enforcement

### Goal

Optionally strengthen the on-chain policy model after off-chain workflow is stable.

### Smart Contract Tasks

- Review `dk-token/programs/dk-token/src/lib.rs`.
- Review `dk-token/programs/dk-token/src/instructions/*`.
- Review `dk-token/programs/dk-token/src/state/*`.
- Decide whether to add a bank registry PDA.
- Decide whether to restrict mint, transfer, and burn to approved treasury accounts on-chain.
- Decide whether to tag requests with settlement business type.

### Test Tasks

- Extend `dk-token/tests/dk-token.ts`.
- Add contract-level tests for bank treasury restrictions if implemented.

### Deliverables

- stronger on-chain guardrails if required

## Sprint 12: Test Coverage And UAT

### Goal

Validate the mixed Solana and BIPS flows end to end.

### Backend Test Tasks

- Add service-level tests for:
  - reserve mint request creation
  - route selection
  - direct BTN transfer
  - fallback to BIPS
  - duplicate request id rejection
  - reconciliation path

### Frontend Test Tasks

- Validate bank master screens.
- Validate settlement create flow.
- Validate settlement detail and timeline rendering.

### Integration Scenarios

- reserve-backed mint success
- direct interbank BTN transfer success
- destination bank has no BTN account and fallback goes to BIPS
- BIPS account inquiry failure
- BIPS timeout
- BIPS duplicate request id
- on-chain burn completed and BIPS still pending
- settlement reconciliation resolves delayed BIPS outcome

### Deliverables

- UAT checklist
- validated end-to-end flows

## Files Expected To Change

### Backend Existing Files

- `backend/.env.example`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.js`
- `backend/src/config/env.js`
- `backend/src/routes/index.js`
- `backend/src/utils/enums.js`
- `backend/src/services/solana.service.js`
- `backend/src/services/dashboard.service.js`

### Backend New Files

- `backend/src/routes/bank.routes.js`
- `backend/src/controllers/bank.controller.js`
- `backend/src/services/bank.service.js`
- `backend/src/validators/bank.validation.js`
- `backend/src/models/bank.model.js`
- `backend/src/routes/settlement.routes.js`
- `backend/src/controllers/settlement.controller.js`
- `backend/src/services/settlement.service.js`
- `backend/src/validators/settlement.validation.js`
- `backend/src/models/settlement.model.js`
- `backend/src/services/bips.service.js`
- `backend/src/services/settlementReconciliation.service.js`
- `backend/scripts/reconcile-bips.js`

### Frontend Existing Files

- `DK_Token_Frontend/src/app/router.jsx`
- `DK_Token_Frontend/src/utils/constants.js`
- `DK_Token_Frontend/src/pages/dashboard/DashboardPage.jsx`

### Frontend New Files

- `DK_Token_Frontend/src/modules/banks/banks.api.js`
- `DK_Token_Frontend/src/modules/banks/banks.schemas.js`
- `DK_Token_Frontend/src/modules/settlements/settlements.api.js`
- `DK_Token_Frontend/src/modules/settlements/settlements.schemas.js`
- `DK_Token_Frontend/src/pages/banks/BanksPage.jsx`
- `DK_Token_Frontend/src/pages/banks/BankDetailsPage.jsx`
- `DK_Token_Frontend/src/pages/settlements/SettlementsPage.jsx`
- `DK_Token_Frontend/src/pages/settlements/SettlementCreatePage.jsx`
- `DK_Token_Frontend/src/pages/settlements/SettlementDetailsPage.jsx`

## Recommended Build Order

1. Sprint 0
2. Sprint 1
3. Sprint 2
4. Sprint 3
5. Sprint 4
6. Sprint 5
7. Sprint 6
8. Sprint 7
9. Sprint 8
10. Sprint 9
11. Sprint 10
12. Sprint 11
13. Sprint 12

## Immediate Next Sprint Recommendation

Start with Sprint 1 and Sprint 2 together now that the business rules from Sprint 0 are drafted.

That gives the repo:

- bank master data
- treasury mappings
- schema foundation for settlements
- reserve capacity controls
- enough structure to begin BIPS integration without rework
