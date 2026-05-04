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
  prepareMintRequest: async (id, makerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement mint preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/mint-request`, {
        params: makerWalletAddress ? { makerWalletAddress } : undefined,
      })).data
  ),
  prepareTransferRequest: async (id, makerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement transfer preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/transfer-request`, {
        params: makerWalletAddress ? { makerWalletAddress } : undefined,
      })).data
  ),
  prepareBurnRequest: async (id, makerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement burn preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/burn-request`, {
        params: makerWalletAddress ? { makerWalletAddress } : undefined,
      })).data
  ),
  prepareMintCheckerApproval: async (id, checkerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement mint checker approval preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/checker-approval`, {
        params: checkerWalletAddress ? { checkerWalletAddress } : undefined,
      })).data
  ),
  prepareTransferCheckerApproval: async (id, checkerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement transfer checker approval preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/checker-transfer-approval`, {
        params: checkerWalletAddress ? { checkerWalletAddress } : undefined,
      })).data
  ),
  prepareBurnCheckerApproval: async (id, checkerWalletAddress) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement burn checker approval preparation')
      : (await axiosClient.get(`/settlements/${id}/prepare/checker-burn-approval`, {
        params: checkerWalletAddress ? { checkerWalletAddress } : undefined,
      })).data
  ),
  recordMintInitiation: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement mint initiation recording')
      : (await axiosClient.post(`/settlements/${id}/record-initiation`, payload)).data
  ),
  recordTransferInitiation: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement transfer initiation recording')
      : (await axiosClient.post(`/settlements/${id}/record-transfer-initiation`, payload)).data
  ),
  recordBurnInitiation: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement burn initiation recording')
      : (await axiosClient.post(`/settlements/${id}/record-burn-initiation`, payload)).data
  ),
  recordMintExecution: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement mint execution recording')
      : (await axiosClient.post(`/settlements/${id}/record-execution`, payload)).data
  ),
  recordTransferExecution: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement transfer execution recording')
      : (await axiosClient.post(`/settlements/${id}/record-transfer-execution`, payload)).data
  ),
  recordBurnExecution: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement burn execution recording')
      : (await axiosClient.post(`/settlements/${id}/record-burn-execution`, payload)).data
  ),
  approve: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement approval')
      : (await axiosClient.post(`/settlements/${id}/approve`, payload)).data
  ),
  reject: async (id, payload) => (
    ENABLE_MOCK_API
      ? unsupportedMock('Settlement rejection')
      : (await axiosClient.post(`/settlements/${id}/reject`, payload)).data
  ),
};
