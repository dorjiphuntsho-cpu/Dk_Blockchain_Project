import axiosClient from '../../services/axiosClient';
import { ENABLE_MOCK_API } from '../../utils/constants';

function unsupportedMock(name) {
  throw new Error(`${name} is not available when mock API is enabled.`);
}

export const settlementsApi = {
  list: async (params) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement list')
      : (await axiosClient.get('/settlements', { params })).data
  ),
  getById: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement detail')
      : (await axiosClient.get(`/settlements/${id}`)).data
  ),
  createReserveMint: async (payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Reserve mint settlement creation')
      : (await axiosClient.post('/settlements/reserve-mint', payload)).data
  ),
  createReplenishmentMint: async (payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Replenishment mint settlement creation')
      : (await axiosClient.post('/settlements/replenishment-mint', payload)).data
  ),
  createInterbankTransfer: async (payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Interbank transfer settlement creation')
      : (await axiosClient.post('/settlements/interbank-transfer', payload)).data
  ),
  createRedemption: async (payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Redemption settlement creation')
      : (await axiosClient.post('/settlements/redemptions', payload)).data
  ),
  route: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement reroute')
      : (await axiosClient.post(`/settlements/${id}/route`)).data
  ),
  runInquiry: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement inquiry')
      : (await axiosClient.post(`/settlements/${id}/run-inquiry`)).data
  ),
  reconcile: async (id) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement reconcile')
      : (await axiosClient.post(`/settlements/${id}/reconcile`)).data
  ),
  reconcilePending: async (payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Pending settlement reconcile')
      : (await axiosClient.post('/settlements/reconcile-pending', payload)).data
  ),
};
