import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';

export const managedTokensApi = {
  list: async (params) =>
    (ENABLE_MOCK_API ? mockAdapter.managedTokens.list(params) : (await axiosClient.get('/managed-tokens', { params })).data),
  getById: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.managedTokens.getById(id) : (await axiosClient.get(`/managed-tokens/${id}`)).data),
};
