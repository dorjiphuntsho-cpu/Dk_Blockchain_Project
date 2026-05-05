import axiosClient from '../../services/axiosClient';
import { ENABLE_MOCK_API } from '../../utils/constants';

function unsupportedMock(name) {
  throw new Error(`${name} is not available when mock API is enabled.`);
}

export const reservesApi = {
  listTransactions: async () => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve transactions')
      : (await axiosClient.get('/reserves/transactions')).data
  ),
  list: async (params) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve list')
      : (await axiosClient.get('/reserves', { params })).data
  ),
  getById: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve detail')
      : (await axiosClient.get(`/reserves/${id}`)).data
  ),
  approve: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve approve')
      : (await axiosClient.post(`/reserves/${id}/approve`)).data
  ),
  reject: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve reject')
      : (await axiosClient.post(`/reserves/${id}/reject`, payload)).data
  ),
};
