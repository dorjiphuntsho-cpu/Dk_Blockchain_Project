const SETTLEMENT_MODES = {
  ON_CHAIN_BTN: 'ON_CHAIN_BTN',
  BIPS_FIAT: 'BIPS_FIAT',
};

const SETTLEMENT_STATUSES = {
  BIPS_PENDING: 'BIPS_PENDING',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  SETTLED: 'SETTLED',
};

function resolveSettlementMode(destinationBank, tokenMintAddress) {
  if (!destinationBank) {
    return SETTLEMENT_MODES.BIPS_FIAT;
  }

  const hasActiveTokenAccount = (destinationBank.tokenAccounts || []).some((account) =>
    account.isActive && account.mintAddress === tokenMintAddress,
  );

  if (destinationBank.supportsBtn && hasActiveTokenAccount) {
    return SETTLEMENT_MODES.ON_CHAIN_BTN;
  }

  return SETTLEMENT_MODES.BIPS_FIAT;
}

function getReconciliationCandidateValues(value, values = []) {
  if (value === undefined || value === null) {
    return values;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    values.push(String(value).trim());
    return values;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => getReconciliationCandidateValues(item, values));
    return values;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => getReconciliationCandidateValues(item, values));
  }

  return values;
}

function assessBipsReconciliationResult(result, source) {
  if (!result) {
    return {
      source,
      outcome: 'UNKNOWN',
      signals: [],
    };
  }

  const values = getReconciliationCandidateValues(result.parsedResponse || {});
  const normalizedValues = values
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  const exactSuccessCodes = new Set(['00', '0000', 'success', 'successful', 'completed', 'settled']);
  const exactFailureCodes = new Set([
    '2000',
    '3012',
    '3019',
    '3401',
    '3413',
    '5000',
    '5003',
    '5401',
    '6001',
    'fail',
    'failed',
    'error',
    'rejected',
    'invalid',
  ]);

  if (normalizedValues.some((value) => exactSuccessCodes.has(value))) {
    return {
      source,
      outcome: 'SUCCESS',
      signals: values,
    };
  }

  if (
    normalizedValues.some((value) => value.includes('success'))
    || normalizedValues.some((value) => value.includes('completed'))
    || normalizedValues.some((value) => value.includes('settled'))
    || normalizedValues.some((value) => value.includes('credited'))
  ) {
    return {
      source,
      outcome: 'SUCCESS',
      signals: values,
    };
  }

  if (normalizedValues.some((value) => exactFailureCodes.has(value))) {
    return {
      source,
      outcome: 'FAILED',
      signals: values,
    };
  }

  if (
    normalizedValues.some((value) => value.includes('fail'))
    || normalizedValues.some((value) => value.includes('error'))
    || normalizedValues.some((value) => value.includes('reject'))
    || normalizedValues.some((value) => value.includes('invalid'))
    || normalizedValues.some((value) => value.includes('not found'))
    || normalizedValues.some((value) => value.includes('timeout'))
    || normalizedValues.some((value) => value.includes('unavailable'))
  ) {
    return {
      source,
      outcome: 'FAILED',
      signals: values,
    };
  }

  if (
    normalizedValues.some((value) => value.includes('pending'))
    || normalizedValues.some((value) => value.includes('processing'))
    || normalizedValues.some((value) => value.includes('in progress'))
    || normalizedValues.some((value) => value.includes('queued'))
    || normalizedValues.some((value) => value.includes('manual'))
  ) {
    return {
      source,
      outcome: 'PENDING',
      signals: values,
    };
  }

  return {
    source,
    outcome: 'UNKNOWN',
    signals: values,
  };
}

function resolveReconciledSettlementStatus(currentStatus, assessments) {
  if (assessments.some((item) => item.outcome === 'SUCCESS')) {
    return SETTLEMENT_STATUSES.SETTLED;
  }

  if (assessments.some((item) => item.outcome === 'FAILED')) {
    return SETTLEMENT_STATUSES.MANUAL_REVIEW;
  }

  if (currentStatus === SETTLEMENT_STATUSES.MANUAL_REVIEW) {
    return SETTLEMENT_STATUSES.MANUAL_REVIEW;
  }

  return SETTLEMENT_STATUSES.BIPS_PENDING;
}

function buildReconciliationErrorMessage(nextStatus, assessments, errors) {
  if (nextStatus === SETTLEMENT_STATUSES.SETTLED) {
    return null;
  }

  if (errors.length) {
    return `Reconciliation could not confirm final settlement. ${errors.join(' | ')}`;
  }

  if (assessments.some((item) => item.outcome === 'FAILED')) {
    return 'BIPS reconciliation indicates the fiat transfer needs manual review.';
  }

  if (assessments.some((item) => item.outcome === 'PENDING')) {
    return 'BIPS reconciliation indicates the fiat transfer is still pending.';
  }

  return 'BIPS reconciliation could not determine a final settlement state.';
}

module.exports = {
  SETTLEMENT_MODES,
  SETTLEMENT_STATUSES,
  resolveSettlementMode,
  assessBipsReconciliationResult,
  resolveReconciledSettlementStatus,
  buildReconciliationErrorMessage,
};
