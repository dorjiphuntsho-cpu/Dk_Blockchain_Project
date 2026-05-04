import axiosClient from '../../services/axiosClient';
import { ENABLE_MOCK_API } from '../../utils/constants';

export const cbsApi = {
  getIssuerReserveBalance: async () => {
    if (ENABLE_MOCK_API) {
      return {
        success: true,
        data: {
          bank: {
            name: 'DK Bank',
            code: '1060',
            supportsBtn: true,
            isIssuer: true,
          },
          reserveAccount: {
            accountName: 'DK Bank Reserve Account',
            accountNumber: '100100364185',
            currency: 'BTN',
          },
          inquiry: {
            availableBalance: '0.00',
            currencyCode: 'BTN',
            accountName: 'DK Bank Reserve Account',
            restrictionSummary: {
              canCredit: true,
              canDebit: true,
              transactionsBlocked: false,
            },
          },
        },
      };
    }

    return (await axiosClient.get('/cbs/issuer-reserve-balance')).data;
  },
};
