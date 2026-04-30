# Inter-Bank Transfer UAT Checklist

## Scope

This checklist covers the DK single-issuer inter-bank settlement model:

- reserve-backed minting by DK Bank
- interbank BTN treasury-to-treasury transfer
- BIPS fiat fallback when destination bank cannot receive BTN
- reconciliation for delayed or uncertain BIPS outcomes

## Environment Prerequisites

- backend is running against the intended database and `.env.devnet`
- frontend is running against the backend API
- Anchor program and IDL are rebuilt after Sprint 11 treasury-registry changes
- Solana config account exists on devnet
- on-chain checkers are configured
- required bank treasury token accounts are registered both:
  - in backend `bank_token_accounts`
  - in the on-chain treasury registry
- BIPS environment values are configured if real adapter testing is intended

## Bank Master Data

- [ ] `DK Bank` exists and is marked as issuer
- [ ] all six banks exist with expected bank codes
- [ ] reserve/BIPS settlement accounts are present for the banks under test
- [ ] treasury wallet and BTN token account are configured for BTN-enabled banks
- [ ] at least one destination bank is configured without BTN support to force BIPS fallback

## Solana Admin And Treasury Registry

- [ ] Solana Admin page loads and shows config status
- [ ] on-chain checker list is visible
- [ ] treasury tab shows on-chain registered treasury token accounts
- [ ] backend bank token accounts can be registered on chain from the UI
- [ ] removing and re-adding a treasury account updates on-chain status correctly

## Reserve-Backed Mint

- [ ] create a reserve ledger entry with approved available amount
- [ ] create a `RESERVE_MINT` settlement request
- [ ] settlement is created in `DRAFT`
- [ ] prepare mint request succeeds
- [ ] maker wallet initiates the mint request
- [ ] record initiation succeeds and settlement moves to `PENDING_APPROVAL`
- [ ] checker approval payload is generated successfully
- [ ] checker signs approval on chain
- [ ] record execution succeeds and settlement moves to `SETTLED`
- [ ] reserve ledger locked amount is consumed correctly

## Replenishment Mint

- [ ] create a `REPLENISHMENT_MINT` settlement request
- [ ] route stays on-chain
- [ ] maker and checker wallet flow behaves the same as reserve mint
- [ ] settlement completes as `SETTLED`
- [ ] replenishment does not auto-trigger only because supply decreased

## Direct Interbank BTN Transfer

- [ ] select a destination bank with BTN support and active treasury token account
- [ ] create an `INTERBANK_TRANSFER` settlement
- [ ] route resolves to `ON_CHAIN_BTN`
- [ ] prepare transfer request succeeds
- [ ] maker wallet initiates transfer
- [ ] checker wallet approves transfer
- [ ] record transfer execution succeeds
- [ ] settlement ends as `SETTLED`

## Fiat Fallback Via BIPS

- [ ] select a destination bank without BTN support
- [ ] create an `INTERBANK_TRANSFER` or `REDEMPTION` settlement with fiat details
- [ ] route resolves to `BIPS_FIAT`
- [ ] run inquiry succeeds
- [ ] inquiry response code and reference number are stored
- [ ] prepare burn request is allowed only after successful inquiry
- [ ] maker wallet initiates burn request
- [ ] checker wallet approves burn request
- [ ] BIPS outgoing is triggered after burn execution recording
- [ ] settlement moves to `BIPS_PENDING` on successful outgoing submission
- [ ] BIPS transaction id and reference number are visible in settlement detail

## Reconciliation And Exceptions

- [ ] settlement with `BIPS_PENDING` can be reconciled from the UI
- [ ] `npm run bips:reconcile` processes pending settlements
- [ ] successful downstream confirmation moves settlement to `SETTLED`
- [ ] failed downstream confirmation moves settlement to `MANUAL_REVIEW`
- [ ] unresolved downstream status remains `BIPS_PENDING`

## Negative Scenarios

- [ ] duplicate `request_id` is rejected or escalated according to BIPS/adapter response
- [ ] inquiry failure moves settlement to `INQUIRY_FAILED`
- [ ] burn execution cannot be recorded as settled without successful inquiry
- [ ] unregistered treasury token account cannot create on-chain mint/transfer/burn request
- [ ] on-chain treasury account removal blocks new treasury-restricted requests
- [ ] BIPS timeout or adapter failure leaves settlement in `MANUAL_REVIEW` or `BIPS_PENDING` as designed

## Frontend Screens

- [ ] Banks page loads and bank details page edits work
- [ ] Settlements page lists and filters records correctly
- [ ] Settlement create page shows route preview
- [ ] Settlement details page shows:
  - status
  - type
  - settlement mode
  - BIPS reference fields
  - on-chain fields
  - timeline
- [ ] dashboard shows settlement metrics and pending reconciliation queue

## Operational Sign-Off

- [ ] issuer mint flow validated
- [ ] direct BTN transfer validated
- [ ] BIPS fallback validated
- [ ] reconciliation validated
- [ ] treasury registry enforcement validated
- [ ] manual review procedure confirmed by operations

## Notes

- Real BIPS validation depends on adapter availability and test credentials.
- Full end-to-end validation should capture screenshots, tx signatures, settlement ids, and adapter references for each scenario.
