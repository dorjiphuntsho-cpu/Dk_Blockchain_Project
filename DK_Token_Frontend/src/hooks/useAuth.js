import { useMemo } from 'react';

import useAuthStore from '../modules/auth/auth.store';

function useAuth() {
  const store = useAuthStore();

  return useMemo(() => ({
    ...store,
    isAuthenticated: Boolean(store.token && store.user),
  }), [store]);
}

export default useAuth;
