import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';

export const auditLogsApi = {
  list: async (params) =>
    (ENABLE_MOCK_API ? mockAdapter.auditLogs.list(params) : (await axiosClient.get('/audit-logs', { params })).data),
};
