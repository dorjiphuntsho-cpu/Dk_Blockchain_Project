import usePortalAuthStore from '../modules/portal/portalAuth.store';

function usePortalAuth() {
  const store = usePortalAuthStore();

  return {
    ...store,
    isAuthenticated: Boolean(store.token && store.customer),
  };
}

export default usePortalAuth;
