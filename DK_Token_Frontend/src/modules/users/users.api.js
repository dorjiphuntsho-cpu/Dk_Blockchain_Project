import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';
import useAuthStore from '../auth/auth.store';

function actor() {
  return useAuthStore.getState().user;
}

export const usersApi = {
  list: async (params) => (ENABLE_MOCK_API ? mockAdapter.users.list(params) : (await axiosClient.get('/users', { params })).data),
  getById: async (id) => (ENABLE_MOCK_API ? mockAdapter.users.getById(id) : (await axiosClient.get(`/users/${id}`)).data),
  create: async (payload) => (ENABLE_MOCK_API ? mockAdapter.users.create(payload, actor()) : (await axiosClient.post('/users', payload)).data),
  update: async (id, payload) => (ENABLE_MOCK_API ? mockAdapter.users.update(id, payload, actor()) : (await axiosClient.patch(`/users/${id}`, payload)).data),
  updateStatus: async (id, isActive) =>
    (ENABLE_MOCK_API ? mockAdapter.users.updateStatus(id, isActive, actor()) : (await axiosClient.patch(`/users/${id}/status`, { isActive })).data),
  assignRoles: async (id, roles) =>
    (ENABLE_MOCK_API ? mockAdapter.users.assignRoles(id, roles, actor()) : (await axiosClient.post(`/users/${id}/roles`, { roles })).data),
};
