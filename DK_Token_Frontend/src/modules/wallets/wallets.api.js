import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';
import useAuthStore from '../auth/auth.store';

function actor() {
  return useAuthStore.getState().user;
}

export const walletsApi = {
  list: async (params) => (ENABLE_MOCK_API ? mockAdapter.wallets.list(params) : (await axiosClient.get('/wallets', { params })).data),
  getById: async (id) => (ENABLE_MOCK_API ? mockAdapter.wallets.getById(id) : (await axiosClient.get(`/wallets/${id}`)).data),
  getTokenBalances: async (id) =>
    (ENABLE_MOCK_API
      ? mockAdapter.wallets.getTokenBalances(id)
      : (await axiosClient.get(`/wallets/${id}/token-balances`)).data),
  create: async (payload) => (ENABLE_MOCK_API ? mockAdapter.wallets.create(payload, actor()) : (await axiosClient.post('/wallets', payload)).data),
  update: async (id, payload) => (ENABLE_MOCK_API ? mockAdapter.wallets.update(id, payload, actor()) : (await axiosClient.patch(`/wallets/${id}`, payload)).data),
  updateStatus: async (id, isActive) =>
    (ENABLE_MOCK_API ? mockAdapter.wallets.updateStatus(id, isActive, actor()) : (await axiosClient.patch(`/wallets/${id}/status`, { isActive })).data),
};
