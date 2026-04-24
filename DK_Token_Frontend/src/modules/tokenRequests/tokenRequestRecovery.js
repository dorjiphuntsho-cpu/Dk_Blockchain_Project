const STORAGE_KEY = 'dk-token-request-recovery-v1';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readRecoveryState() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function writeRecoveryState(value) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function savePendingInitiationRecovery(requestId, payload) {
  if (!requestId || !payload) {
    return;
  }

  const state = readRecoveryState();
  state[requestId] = {
    payload,
    savedAt: new Date().toISOString(),
    type: 'MAKER_INITIATION',
  };
  writeRecoveryState(state);
}

export function getPendingInitiationRecovery(requestId) {
  if (!requestId) {
    return null;
  }

  const state = readRecoveryState();
  return state[requestId]?.type === 'MAKER_INITIATION' ? state[requestId] : null;
}

export function clearPendingInitiationRecovery(requestId) {
  if (!requestId) {
    return;
  }

  const state = readRecoveryState();
  if (!state[requestId]) {
    return;
  }

  delete state[requestId];
  writeRecoveryState(state);
}
