const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInterbankTransferRequestSchema,
  createRedemptionRequestSchema,
  settlementRecordExecutionSchema,
} = require('../src/validators/settlement.validation');

const baseTransferPayload = {
  sourceBankId: '11111111-1111-1111-1111-111111111111',
  destinationBankId: '22222222-2222-2222-2222-222222222222',
  tokenMintAddress: '9xQeWvG816bUx9EPfEZd7ocYBJE7o1TzP1KkM4v1kv7x',
  amount: '1000',
  transferPurpose: 'Interbank settlement',
};

test('redemption settlement validation requires requestId for BIPS-bound payout', () => {
  const parsed = createRedemptionRequestSchema.safeParse({
    body: {
      ...baseTransferPayload,
      sourceBankId: baseTransferPayload.sourceBankId,
      destinationBankId: baseTransferPayload.destinationBankId,
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
  assert.match(parsed.error.issues[0].message, /required/i);
});

test('interbank transfer settlement validation allows requestId and fiat fallback details', () => {
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

test('settlement execution validation only accepts SETTLED or FAILED status', () => {
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
