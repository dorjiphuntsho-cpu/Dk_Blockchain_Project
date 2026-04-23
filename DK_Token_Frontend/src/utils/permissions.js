import { EXECUTION_MODES, ON_CHAIN_PENDING_STATUSES, REQUEST_STATUSES, ROLES } from './constants';

export function hasRole(user, allowedRoles = []) {
  return user?.roles?.some((role) => allowedRoles.includes(role));
}

export function canManageUsers(user) {
  return hasRole(user, [ROLES.ADMIN]);
}

export function canViewWallets(user) {
  return hasRole(user, [ROLES.ADMIN, ROLES.MAKER, ROLES.CHECKER, ROLES.EXECUTOR]);
}

export function canEditDraftRequest(user, request) {
  return hasRole(user, [ROLES.MAKER]) && request?.status === REQUEST_STATUSES.DRAFT && request?.makerUserId === user?.id;
}

export function canSubmitDraftRequest(user, request) {
  return canEditDraftRequest(user, request);
}

export function canApproveRequest(user, request) {
  return hasRole(user, [ROLES.CHECKER]) &&
    request?.status === REQUEST_STATUSES.PENDING_APPROVAL &&
    request?.makerUserId !== user?.id;
}

export function canRejectRequest(user, request) {
  return canApproveRequest(user, request);
}

export function canMarkReady(user, request) {
  return false;
}

export function canRecordExecution(user, request) {
  return hasRole(user, [ROLES.ADMIN, ROLES.EXECUTOR]) &&
    ON_CHAIN_PENDING_STATUSES.includes(request?.status);
}

export function canExecuteRequest(user, request) {
  return canRecordExecution(user, request) && request?.executionMode !== EXECUTION_MODES.BROWSER_WALLET;
}

export function canInitiateWalletExecution(user, request, executionPayload) {
  return hasRole(user, [ROLES.MAKER]) &&
    request?.makerUserId === user?.id &&
    ON_CHAIN_PENDING_STATUSES.includes(request?.status) &&
    Boolean(executionPayload?.walletInitiation?.supported) &&
    !executionPayload?.walletInitiation?.recorded;
}

export function canApproveWalletExecution(user, request, executionPayload) {
  return hasRole(user, [ROLES.CHECKER]) &&
    ON_CHAIN_PENDING_STATUSES.includes(request?.status) &&
    Boolean(executionPayload?.walletInitiation?.recorded) &&
    Boolean(executionPayload?.walletInitiation?.onChainRequestAddress);
}
