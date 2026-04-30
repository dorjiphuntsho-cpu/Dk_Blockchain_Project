import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';
import useAuthStore from '../auth/auth.store';

function actor() {
  return useAuthStore.getState().user;
}

export const banksApi = {
  list: async (params) => (ENABLE_MOCK_API ? mockAdapter.banks.list(params) : (await axiosClient.get('/banks', { params })).data),
  getById: async (id) => (ENABLE_MOCK_API ? mockAdapter.banks.getById(id) : (await axiosClient.get(`/banks/${id}`)).data),
  update: async (id, payload) => (ENABLE_MOCK_API ? mockAdapter.banks.update(id, payload, actor()) : (await axiosClient.patch(`/banks/${id}`, payload)).data),
  createAccount: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.banks.createAccount(id, payload, actor()) : (await axiosClient.post(`/banks/${id}/accounts`, payload)).data),
  updateAccount: async (id, accountId, payload) =>
    (ENABLE_MOCK_API
      ? mockAdapter.banks.updateAccount(id, accountId, payload, actor())
      : (await axiosClient.patch(`/banks/${id}/accounts/${accountId}`, payload)).data),
  createTokenAccount: async (id, payload) =>
    (ENABLE_MOCK_API
      ? mockAdapter.banks.createTokenAccount(id, payload, actor())
      : (await axiosClient.post(`/banks/${id}/token-accounts`, payload)).data),
  updateTokenAccount: async (id, tokenAccountId, payload) =>
    (ENABLE_MOCK_API
      ? mockAdapter.banks.updateTokenAccount(id, tokenAccountId, payload, actor())
      : (await axiosClient.patch(`/banks/${id}/token-accounts/${tokenAccountId}`, payload)).data),
};
