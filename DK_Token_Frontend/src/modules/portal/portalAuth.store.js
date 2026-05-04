import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { portalApi } from './portal.api';

const usePortalAuthStore = create(
  persist(
    (set) => ({
      token: null,
      customer: null,
      isLoading: false,
      login: async ({ cid, mpin }) => {
        set({ isLoading: true });

        try {
          const response = await portalApi.login({ cid, mpin });
          set({
            token: response.data.token,
            customer: response.data.user,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      logout: async () => {
        set({ token: null, customer: null, isLoading: false });
      },
    }),
    {
      name: 'btn-user-portal-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default usePortalAuthStore;
