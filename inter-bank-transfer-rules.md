# Inter-Bank Transfer Rules

## Purpose

Use this file to record the final business rules, regulatory requirements, and operational decisions for the inter-bank transfer system.

This document should be treated as the source of truth for Phase 0 decisions before implementation begins.

## Regulation And Policy Notes

The rules in this file are the implementation baseline until replaced by formally approved business or regulatory wording.

All inter-bank settlement activity must be:

- auditable
- linked to an approved reserve or settlement reference
- traceable across on-chain and BIPS actions

No token issuance is allowed without a reserve basis.

No fiat fallback should be treated as final until BIPS response and reconciliation confirm the result.

## Core Definitions

### Reserve Balance

Reserve balance means the fiat value held by DK Bank to support BTN issuance.

For implementation purposes, reserve balance is the approved and auditable fiat-backed amount recorded in the platform, not just an assumed bank balance.

### Circulating Supply

Circulating supply means BTN tokens that have been minted into circulation and are currently held in treasury-distributed or user-accessible token accounts.

Tokens that are burned are no longer part of circulating supply.

### Reserve-Backed Minting

Reserve-backed minting means DK Bank creates new BTN only when there is sufficient approved fiat reserve support recorded in the system.

### Redemption

Redemption means BTN value is removed from token circulation and settled back into fiat value through the approved settlement flow.

### Replenishment Mint

Replenishment mint means DK Bank mints additional BTN after circulating supply has decreased and approved reserve balance is available to support that issuance.

Replenishment mint is not automatic. It is an approved operational action.

## Decision Log

### Reserve Proof

Status: Draft Approved

Decision: DK Bank is the primary issuing bank for BTN. DK Bank mints BTN tokens based on the fiat reserve it holds. Every mint must be backed by an equivalent fiat reserve balance or reserve reference recorded in the system.

Notes:
This means token issuance must always map to available fiat reserve support held by DK Bank. The exact reserve evidence can later be narrowed to balance confirmation, treasury reference number, or approved reserve record.
Minting capacity must never exceed approved reserve-backed capacity.

### Mint Approval Model

Status: Draft Approved

Decision: Admin creates and manages the BTN token mint configuration. DK Bank performs reserve-backed minting based on its reserve position. Maker initiates mint requests when operationally needed. Checker approves mint requests before execution. Token mint creation itself does not require checker approval for the first version, but token issuance into circulation does require checker approval.

Notes:
Recommended answer to the open question: do not add checker approval for initial token mint creation in version one. Add checker approval for reserve-backed issuance, because that is the regulated value-creation step.
This includes replenishment minting after supply reduction.

### Treasury Model

Status: Draft Approved

Decision: DK Bank must have one reserve settlement account for fiat backing, one operational BIPS settlement account, one treasury wallet for blockchain operations, and one BTN treasury token account for each supported BTN mint. Other banks may participate as transfer or redemption counterparties, but DK Bank is the issuing institution that maintains the reserve-backed mint model.

Notes:
Bank treasury accounts must be modeled separately from normal user wallets. User wallets represent platform users. Treasury records represent banks as settlement institutions. DK Bank acts as issuer and reserve holder.
The first release should assume a single issuing institution model with DK Bank as the issuer.

### BTN Vs BIPS Routing Rule

Status: Draft Approved

Decision: If the destination bank has an active BTN treasury token account for the selected BTN mint and is flagged as supporting BTN settlement, the system must use direct BTN transfer. If the destination bank does not have BTN settlement capability, the system must use BIPS fiat fallback.

Notes:
The routing decision must be stored on the settlement request and must not change silently after approval.

### Fiat Fallback Order

Status: Draft Approved

Decision: The fiat fallback order is:

1. create settlement request
2. perform beneficiary account inquiry
3. checker approves the settlement
4. lock settlement for execution
5. burn or redeem the BTN amount from the source treasury side
6. send BIPS outgoing transfer
7. move the transaction to reconciliation until final confirmation is known

Notes:
Account inquiry must happen before burn. The system should not perform BIPS outgoing without a valid inquiry response.

### Burn And BIPS Failure Handling

Status: Draft Approved

Decision: When the receiving bank does not have BTN settlement capability, the equivalent BTN amount is redeemed from the source treasury side and fiat is sent through BIPS to the destination settlement account. If the burn succeeds but BIPS fails, times out, or returns an uncertain outcome, the settlement must move to `MANUAL_REVIEW`.

Notes:
Do not auto-remint tokens in version one. Compensation or reversal should be a manual operational action with audit logging because auto-reminting creates double-settlement risk.

### Account Inquiry Requirement

Status: Draft Approved

Decision: Account inquiry is mandatory for every BIPS-bound transfer before outgoing settlement is attempted.

Notes:
This matches the BIPS process flow and reduces invalid beneficiary transfer risk.

### Incoming BIPS To Mint Rule

Status: Draft Approved

Decision: If a user wants BTN tokens, the equivalent fiat amount must first be moved from the user account into the DK Bank reserve account. That fiat movement creates or updates a reserve-backed ledger entry. BTN minting should happen only after the reserve-backed mint approval flow is completed.

Notes:
Incoming fiat increases the reserve backing available to DK Bank. Fiat receipt proves funding, but issuance still requires workflow approval.
User fiat funding does not automatically mint BTN at the time of receipt unless an approved issuance workflow executes it.

### Supply Replenishment Rule

Status: Draft Approved

Decision: If circulating BTN supply decreases because tokens are redeemed, burned, or otherwise removed from circulation, DK Bank may mint additional BTN later only if approved reserve balance is available to support that minting. Accumulated fiat in the reserve account increases the reserve capacity available for future minting.

Notes:
This means fiat accumulated in reserve can be used to support new minting when supply needs replenishment, but replenishment must still go through approval workflow. Supply reduction alone does not trigger automatic minting.

### Mint Trigger Rule

Status: Draft Approved

Decision: New minting may be triggered by:

- new user fiat added to the reserve account
- approved reserve increase recorded by DK Bank
- operational need to replenish available BTN inventory after supply reduction

All minting triggers must result in an explicit mint request and approval trail.

Notes:
The system should not auto-mint solely because reserve increased or supply decreased. Minting remains a controlled action.

### Retry And Reconciliation Rule

Status: Draft Approved

Decision: Retries are allowed only when the settlement is not already confirmed as successful and not already marked as duplicated. Before retrying, the system must check stored BIPS logs, call `pg_transaction_status` if available, call `live-inquery` if available, and confirm that the same `request_id` has not already completed.

Notes:
The system must never blindly resend a BIPS outgoing request. Every retry must be governed by idempotency and reconciliation checks.

### Reserve Protection Rule

Status: Draft Approved

Decision: The platform must prevent mint approval when the approved reserve-backed capacity is insufficient for the requested amount. The platform must also prevent the same reserve support from being counted twice across multiple mint requests.

Notes:
This rule requires reserve ledger accounting with available, locked, consumed, and released states.

### Manual Intervention Rule

Status: Draft Approved

Decision: Manual intervention is required when:

- burn succeeded but BIPS is not confirmed
- duplicate `request_id` is detected
- account inquiry succeeded but outgoing transfer timed out
- adapter returned success but downstream confirmation is missing or inconsistent
- beneficiary dispute, forced credit, or exception handling is required

All manual actions must record operator identity, timestamp, reason, action taken, and final outcome.

Notes:
Manual intervention should be visible in the audit trail and in the settlement timeline.

## Open Questions

- Confirm whether reserve proof requires attachment upload, reference number only, or both.
- Confirm whether admin and executor are the same role in the first release.
- Confirm whether the platform will support only one BTN mint at launch or multiple mint variants, even though the first release should assume one issuing institution.
- Confirm whether partial settlement is allowed during exception handling.
- Confirm the exact operational wording for `MANUAL_REVIEW` and who is authorized to close it.

## Approval

- Business owner:
- Compliance owner:
- Technical owner:
- Date:
