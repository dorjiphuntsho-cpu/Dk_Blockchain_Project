import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';
import useAuthStore from '../auth/auth.store';

function actor() {
  return useAuthStore.getState().user;
}

export const tokenRequestsApi = {
  list: async (params) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.list(params) : (await axiosClient.get('/token-requests', { params })).data),
  getById: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.getById(id) : (await axiosClient.get(`/token-requests/${id}`)).data),
  create: async (payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.create(payload, actor()) : (await axiosClient.post('/token-requests', payload)).data),
  update: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.update(id, payload, actor()) : (await axiosClient.patch(`/token-requests/${id}`, payload)).data),
  submit: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.submit(id, actor()) : (await axiosClient.post(`/token-requests/${id}/submit`)).data),
  cancel: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.cancel(id, actor()) : (await axiosClient.post(`/token-requests/${id}/cancel`)).data),
  approve: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.approve(id, payload, actor()) : (await axiosClient.post(`/token-requests/${id}/approve`, payload)).data),
  reject: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.reject(id, payload, actor()) : (await axiosClient.post(`/token-requests/${id}/reject`, payload)).data),
  markReady: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.markReady(id, actor()) : (await axiosClient.post(`/token-requests/${id}/mark-ready`)).data),
  getExecutionPayload: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.getExecutionPayload(id, actor()) : (await axiosClient.get(`/token-requests/${id}/execution-payload`)).data),
  prepareMintRequest: async (id) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareMintRequest(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/mint-request`)).data),
  prepareTransferRequest: async (id) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareTransferRequest(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/transfer-request`)).data),
  prepareBurnRequest: async (id) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareBurnRequest(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/burn-request`)).data),
  prepareMakerCancellation: async (id, makerWalletAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareMakerCancellation(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/maker-cancel`, {
        params: makerWalletAddress ? { makerWalletAddress } : undefined,
      })).data),
  prepareCheckerApproval: async (id, checkerWalletAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareCheckerApproval(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/checker-approval`, {
        params: checkerWalletAddress ? { checkerWalletAddress } : undefined,
      })).data),
  prepareCheckerRejection: async (id, checkerWalletAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.tokenRequests.prepareCheckerRejection(id, actor())
      : (await axiosClient.get(`/token-requests/${id}/prepare/checker-rejection`, {
        params: checkerWalletAddress ? { checkerWalletAddress } : undefined,
      })).data),
  recordInitiation: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.recordInitiation(id, payload, actor()) : (await axiosClient.post(`/token-requests/${id}/record-initiation`, payload)).data),
  recordCancellation: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.recordCancellation(id, payload, actor()) : (await axiosClient.post(`/token-requests/${id}/record-cancellation`, payload)).data),
  execute: async (id) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.execute(id, actor()) : (await axiosClient.post(`/token-requests/${id}/execute`)).data),
  recordExecution: async (id, payload) =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.recordExecution(id, payload, actor()) : (await axiosClient.post(`/token-requests/${id}/record-execution`, payload)).data),
  dashboard: async () =>
    (ENABLE_MOCK_API ? mockAdapter.tokenRequests.dashboard(actor()) : (await axiosClient.get('/dashboard')).data),
};
