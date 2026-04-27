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

export function canCancelPendingRequest(user, request) {
  return hasRole(user, [ROLES.MAKER]) &&
    request?.status === REQUEST_STATUSES.PENDING_APPROVAL &&
    request?.makerUserId === user?.id;
}

export function canApproveRequest(user, request) {
  return hasRole(user, [ROLES.CHECKER]) &&
    request?.status === REQUEST_STATUSES.PENDING_APPROVAL &&
    request?.makerUserId !== user?.id;
}

export function canRejectRequest(user, request) {
  return canApproveRequest(user, request);
}

export function canMarkReady() {
  return false;
}

export function canRecordExecution() {
  return false;
}

export function canExecuteRequest() {
  return false;
}

export function canInitiateWalletExecution(user, request, executionPayload) {
  return hasRole(user, [ROLES.MAKER]) &&
    request?.makerUserId === user?.id &&
    ON_CHAIN_PENDING_STATUSES.includes(request?.status) &&
    Boolean(executionPayload?.walletInitiation?.supported) &&
    !executionPayload?.walletInitiation?.recorded;
}

export function canApproveWalletExecution(user, request) {
  return hasRole(user, [ROLES.CHECKER]) &&
    request?.status === REQUEST_STATUSES.PENDING_APPROVAL &&
    request?.makerUserId !== user?.id;
}
