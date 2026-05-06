const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
};

export const api = {
  createBank: ({ name, wallet, currency, fiatReserve }) =>
    request("/banks", {
      method: "POST",
      body: JSON.stringify({ name, wallet, currency, fiatReserve }),
    }),

  getBanks: () => request("/banks"),

  getBankByWallet: (wallet) => request(`/banks/wallet/${wallet}`),

  updateBankReserve: (id, fiatReserve) =>
    request(`/banks/${id}/reserve`, {
      method: "PATCH",
      body: JSON.stringify({ fiatReserve }),
    }),

  inquireCbsAccount: ({ accountNo, productType }) =>
    request("/cbs/account-inquiry", {
      method: "POST",
      body: JSON.stringify({ accountNo, productType }),
    }),

  getCbsTestAccounts: () => request("/cbs/test-accounts"),

  createSettlement: ({
    bankId,
    senderWallet,
    recipientWallet,
    recipientRegistered,
    settlementType,
    amount,
    txSignature,
    receiverName,
    receiverAccount,
    productType,
  }) =>
    request("/settlements", {
      method: "POST",
      body: JSON.stringify({
        bankId,
        senderWallet,
        recipientWallet,
        recipientRegistered,
        settlementType,
        amount,
        txSignature,
        receiverName,
        receiverAccount,
        productType,
      }),
    }),

  createUnregisteredFiatSettlement: ({
    bankId,
    senderWallet,
    recipientWallet,
    amount,
    burnTxSignature,
    receiverAccount,
    productType,
  }) =>
    request("/settlements/fiat/unregistered", {
      method: "POST",
      body: JSON.stringify({
        bankId,
        senderWallet,
        recipientWallet,
        amount,
        burnTxSignature,
        receiverAccount,
        productType,
      }),
    }).then((data) => (
      data?.settlement
        ? { ...data.settlement, cbsAccount: data.cbsAccount, bankTransfer: data.bankTransfer }
        : data
    )),

  refreshSettlementStatus: (id) =>
    request(`/settlements/${id}/status`, {
      method: "POST",
    }).then((data) => (
      data?.settlement
        ? { ...data.settlement, bankStatus: data.bankStatus }
        : data
    )),

  getSettlements: ({ bankId, recipientWallet } = {}) => {
    const params = new URLSearchParams();
    if (bankId) params.set("bankId", bankId);
    if (recipientWallet) params.set("recipientWallet", recipientWallet);
    const query = params.toString();
    return request(query ? `/settlements?${query}` : "/settlements");
  },

  createUser: ({ wallet, role }) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify({ wallet, role }),
    }),

  getUserByWallet: (wallet) => request(`/users/wallet/${wallet}`),

  getMintRequests: () => request("/mint-requests"),

  getTokenConfig: () => request("/token-config"),

  updateTokenConfig: ({ adminAddr, configAddr, mintAddr, checkers }) =>
    request("/token-config", {
      method: "PUT",
      body: JSON.stringify({ adminAddr, configAddr, mintAddr, checkers }),
    }),

  createMintRequest: ({ requestAddr, maker, amount, bankId }) =>
    request("/mint-requests", {
      method: "POST",
      body: JSON.stringify({ requestAddr, maker, amount, bankId }),
    }),

  approveMintRequest: (id, txSignature) =>
    request(`/mint-requests/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ txSignature }),
    }),

  rejectMintRequest: (id, txSignature) =>
    request(`/mint-requests/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ txSignature }),
    }),
};
