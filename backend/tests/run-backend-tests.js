const assert = require('node:assert/strict');

const {
  SETTLEMENT_MODES,
  SETTLEMENT_STATUSES,
  resolveSettlementMode,
  assessBipsReconciliationResult,
  resolveReconciledSettlementStatus,
  buildReconciliationErrorMessage,
} = require('../src/services/settlementPolicy.service');
const {
  createInterbankTransferRequestSchema,
  createRedemptionRequestSchema,
  settlementRecordExecutionSchema,
} = require('../src/validators/settlement.validation');

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const baseTransferPayload = {
  sourceBankId: '11111111-1111-1111-1111-111111111111',
  destinationBankId: '22222222-2222-2222-2222-222222222222',
  tokenMintAddress: '9xQeWvG816bUx9EPfEZd7ocYBJE7o1TzP1KkM4v1kv7x',
  amount: '1000',
  transferPurpose: 'Interbank settlement',
};

runTest('route selection uses on-chain settlement when destination supports BTN and has active token account', () => {
  const destinationBank = {
    supportsBtn: true,
    tokenAccounts: [
      { isActive: false, mintAddress: 'mint-a' },
      { isActive: true, mintAddress: 'mint-b' },
    ],
  };

  assert.equal(resolveSettlementMode(destinationBank, 'mint-b'), SETTLEMENT_MODES.ON_CHAIN_BTN);
});

runTest('route selection falls back to BIPS when destination lacks BTN capability', () => {
  const destinationBank = {
    supportsBtn: false,
    tokenAccounts: [{ isActive: true, mintAddress: 'mint-b' }],
  };

  assert.equal(resolveSettlementMode(destinationBank, 'mint-b'), SETTLEMENT_MODES.BIPS_FIAT);
});

runTest('reconciliation interprets success responses', () => {
  const result = assessBipsReconciliationResult({
    parsedResponse: {
      responseText: 'SUCCESS',
      responseCode: '00',
      nested: { paymentStatus: 'credited' },
    },
  }, 'PG_STATUS');

  assert.equal(result.outcome, 'SUCCESS');
});

runTest('reconciliation interprets failure responses', () => {
  const result = assessBipsReconciliationResult({
    parsedResponse: {
      responseCode: '5003',
      responseText: 'Service Unavailable',
    },
  }, 'LIVE_INQUIRY');

  assert.equal(result.outcome, 'FAILED');
});

runTest('pending reconciliation remains pending without final downstream state', () => {
  const status = resolveReconciledSettlementStatus(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'PG_STATUS', outcome: 'PENDING', signals: ['processing'] }],
  );

  assert.equal(status, SETTLEMENT_STATUSES.BIPS_PENDING);
});

runTest('failed reconciliation escalates to manual review', () => {
  const status = resolveReconciledSettlementStatus(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'LIVE_INQUIRY', outcome: 'FAILED', signals: ['failed'] }],
  );

  assert.equal(status, SETTLEMENT_STATUSES.MANUAL_REVIEW);
});

runTest('pending reconciliation message is descriptive', () => {
  const message = buildReconciliationErrorMessage(
    SETTLEMENT_STATUSES.BIPS_PENDING,
    [{ source: 'PG_STATUS', outcome: 'PENDING', signals: ['processing'] }],
    [],
  );

  assert.match(message, /still pending/i);
});

runTest('redemption validation requires requestId for BIPS payout', () => {
  const parsed = createRedemptionRequestSchema.safeParse({
    body: {
      ...baseTransferPayload,
      beneficiaryAccountName: 'Beneficiary',
      beneficiaryAccountNumber: '1234567890',
      beneficiaryBankCode: '1020',
      sourceAccountName: 'Issuer Treasury',
      sourceAccountNumber: '100200300',
    },
    params: {},
    query: {},
  });

  assert.equal(parsed.success, false);
});

runTest('interbank transfer validation accepts fiat fallback details', () => {
  const parsed = createInterbankTransferRequestSchema.safeParse({
    body: {
      ...baseTransferPayload,
      requestId: 'REQ-001',
      beneficiaryAccountName: 'Beneficiary',
      beneficiaryAccountNumber: '1234567890',
      beneficiaryBankCode: '1020',
      sourceAccountName: 'Issuer Treasury',
      sourceAccountNumber: '100200300',
    },
    params: {},
    query: {},
  });

  assert.equal(parsed.success, true);
});

runTest('execution validation rejects unsupported status transitions', () => {
  const parsed = settlementRecordExecutionSchema.safeParse({
    body: {
      status: 'BIPS_PENDING',
    },
    params: {
      id: '33333333-3333-3333-3333-333333333333',
    },
    query: {},
  });

  assert.equal(parsed.success, false);
});

if (!process.exitCode) {
  console.log('All backend settlement tests passed.');
}
