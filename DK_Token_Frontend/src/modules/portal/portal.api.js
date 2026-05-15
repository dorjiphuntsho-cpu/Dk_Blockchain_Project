import axios from 'axios';

import { API_BASE_URL } from '../../utils/constants';

const portalClient = axios.create({
  baseURL: API_BASE_URL,
});

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export const portalApi = {
  login: async (payload) => {
    const response = await portalClient.post('/auth/customer-login', payload);
    return response.data;
  },
  getSummary: async (token) => {
    const response = await portalClient.get('/auth/customer-portal-summary', authHeaders(token));
    return response.data;
  },
  getBankOptions: async (token) => {
    const response = await portalClient.get('/auth/customer-bank-options', authHeaders(token));
    return response.data;
  },
  updateBankAccounts: async (token, payload) => {
    const response = await portalClient.patch('/auth/customer-bank-accounts', payload, authHeaders(token));
    return response.data;
  },
  buyBtn: async (token, payload) => {
    const response = await portalClient.post('/payments/customer/buy-btn', payload, authHeaders(token));
    return response.data;
  },
  confirmBuyBtn: async (token, paymentReference, payload) => {
    const response = await portalClient.post(
      `/payments/customer/${paymentReference}/confirm-buy`,
      payload,
      authHeaders(token),
    );
    return response.data;
  },
  sellBtn: async (token, payload) => {
    const response = await portalClient.post('/payments/customer/sell-btn', payload, authHeaders(token));
    return response.data;
  },
  transferBtn: async (token, payload) => {
    const response = await portalClient.post('/payments/customer/transfer-btn', payload, authHeaders(token));
    return response.data;
  },
  getCustomerPayment: async (token, paymentReference) => {
    const response = await portalClient.get(`/payments/customer/${paymentReference}`, authHeaders(token));
    return response.data;
  },
  verifyCustomerPaymentStatus: async (token, paymentReference) => {
    const response = await portalClient.post(
      `/payments/customer/${paymentReference}/verify-status`,
      {},
      authHeaders(token),
    );
    return response.data;
  },
};
