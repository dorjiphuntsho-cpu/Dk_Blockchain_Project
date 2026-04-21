import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';

export const authApi = {
  login: async (payload) => {
    if (ENABLE_MOCK_API) {
      return mockAdapter.auth.login(payload);
    }

    const response = await axiosClient.post('/auth/login', payload);
    return response.data;
  },
  getCurrentUser: async () => {
    if (ENABLE_MOCK_API) {
      const persisted = JSON.parse(window.localStorage.getItem('token-admin-auth') || '{}');
      const token = persisted?.state?.token;
      return mockAdapter.auth.me(token);
    }

    const response = await axiosClient.get('/auth/me');
    return response.data;
  },
};
