const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SETTLEMENT_MODES,
  SETTLEMENT_STATUSES,
  resolveSettlementMode,
  assessBipsReconciliationResult,
  resolveReconciledSettlementStatus,
  buildReconciliationErrorMessage,
} = require('../src/services/settlementPolicy.service');

test('resolveSettlementMode chooses on-chain settlement for BTN-enabled destination bank with matching active token account', () => {
  const destinationBank = {
    supportsBtn: true,
    tokenAccounts: [
      { isActive: false, mintAddress: 'mint-a' },
      { isActive: true, mintAddress: 'mint-b' },
    ],
  };

  const result = resolveSettlementMode(destinationBank, 'mint-b');

  assert.equal(result, SETTLEMENT_MODES.ON_CHAIN_BTN);
});

test('resolveSettlementMode falls back to BIPS when destination bank lacks BTN capability', () => {
  const destinationBank = {
    supportsBtn: false,
    tokenAccounts: [
      { isActive: true, mintAddress: 'mint-b' },
    ],
  };

  const result = resolveSettlementMode(destinationBank, 'mint-b');

  assert.equal(result, SETTLEMENT_MODES.BIPS_FIAT);
});

test('assessBipsReconciliationResult classifies success signals', () => {
  const result = assessBipsReconciliationResult({
    parsedResponse: {
      responseText: 'SUCCESS',
      responseCode: '00',
      nested: {
        paymentStatus: 'credited',
      },
    },
  }, 'PG_STATUS');

  assert.equal(result.outcome, 'SUCCESS');
  assert.equal(result.source, 'PG_STATUS');
});

test('assessBipsReconciliationResult classifies failure signals', () => {
  const result = assessBipsReconciliationResult({
    parsedResponse: {
      responseCode: '5003',
      responseText: 'Service Unavailable',
    },
  }, 'LIVE_INQUIRY');

  assert.equal(result.outcome, 'FAILED');
  assert.equal(result.source, 'LIVE_INQUIRY');
});

test('resolveReconciledSettlementStatus keeps pending settlements pending when no final result is available', () => {
  const result = resolveReconciledSettlementStatus(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'PG_STATUS', outcome: 'PENDING', signals: ['pending'] }],
  );

  assert.equal(result, SETTLEMENT_STATUSES.BIPS_PENDING);
});

test('resolveReconciledSettlementStatus escalates failed reconciliation to manual review', () => {
  const result = resolveReconciledSettlementStatus(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'LIVE_INQUIRY', outcome: 'FAILED', signals: ['failed'] }],
  );

  assert.equal(result, SETTLEMENT_STATUSES.MANUAL_REVIEW);
});

test('buildReconciliationErrorMessage describes unresolved BIPS pending state', () => {
  const result = buildReconciliationErrorMessage(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'PG_STATUS', outcome: 'PENDING', signals: ['processing'] }],
    [],
  );

  assert.match(result, /still pending/i);
});
