const AUTH_STORAGE_KEY = 'token-admin-auth';

const walletResetHandlers = new Set();

export function registerWalletResetHandler(handler) {
  walletResetHandlers.add(handler);

  return () => {
    walletResetHandlers.delete(handler);
  };
}

export async function resetWalletSession() {
  await Promise.allSettled(
    [...walletResetHandlers].map((handler) => Promise.resolve().then(() => handler())),
  );
}

export async function resetAuthSession() {
  await resetWalletSession();

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
