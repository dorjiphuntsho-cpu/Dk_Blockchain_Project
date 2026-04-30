import axiosClient from '../../services/axiosClient';
import { mockAdapter } from '../../services/mockAdapter';
import { ENABLE_MOCK_API } from '../../utils/constants';

export const solanaAdminApi = {
  getConfigStatus: async () =>
    (ENABLE_MOCK_API ? mockAdapter.solanaAdmin.getConfigStatus() : (await axiosClient.get('/solana/config-status')).data),
  prepareMintCreation: async () =>
    (ENABLE_MOCK_API ? mockAdapter.solanaAdmin.prepareMintCreation() : (await axiosClient.get('/solana/prepare/mint-creation')).data),
  recordCreatedTokenMint: async (payload) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.recordCreatedTokenMint(payload)
      : (await axiosClient.post('/solana/token-mints/record', payload)).data),
  createTokenMint: async (payload) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.createTokenMint(payload)
      : (await axiosClient.post('/solana/token-mints', payload)).data),
  addChecker: async (checkerAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.addChecker(checkerAddress)
      : (await axiosClient.post('/solana/checkers', { checkerAddress })).data),
  addTreasuryAccount: async (treasuryAccountAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.addTreasuryAccount(treasuryAccountAddress)
      : (await axiosClient.post('/solana/treasury-accounts', { treasuryAccountAddress })).data),
  removeChecker: async (checkerAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.removeChecker(checkerAddress)
      : (await axiosClient.delete(`/solana/checkers/${checkerAddress}`)).data),
  removeTreasuryAccount: async (treasuryAccountAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.removeTreasuryAccount(treasuryAccountAddress)
      : (await axiosClient.delete(`/solana/treasury-accounts/${treasuryAccountAddress}`)).data),
  setAdmin: async (newAdminAddress) =>
    (ENABLE_MOCK_API
      ? mockAdapter.solanaAdmin.setAdmin(newAdminAddress)
      : (await axiosClient.post('/solana/admin', { newAdminAddress })).data),
};
