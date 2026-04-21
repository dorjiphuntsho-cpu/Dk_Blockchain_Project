import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authApi } from './auth.api';

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      login: async (credentials) => {
        set({ isLoading: true });

        try {
          const response = await authApi.login(credentials);
          set({
            token: response.data.token,
            user: response.data.user,
            isLoading: false,
          });

          return response.data.user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      hydrateUser: async () => {
        const currentToken = useAuthStore.getState().token;

        if (!currentToken) {
          return null;
        }

        try {
          const response = await authApi.getCurrentUser();
          set({ user: response.data });
          return response.data;
        } catch (error) {
          set({ token: null, user: null });
          throw error;
        }
      },
      logout: () => set({ token: null, user: null, isLoading: false }),
    }),
    {
      name: 'token-admin-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useAuthStore;
