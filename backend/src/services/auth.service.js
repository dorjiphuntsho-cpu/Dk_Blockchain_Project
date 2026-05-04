const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const cbsService = require('./cbs.service');
const solanaService = require('./solana.service');

function mapUserProfile(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    cid: user.cid,
    customerType: user.customerType,
    linkedBankAccountNumber: user.linkedBankAccountNumber,
    isActive: user.isActive,
    roles: user.roles.map((item) => item.role.name),
    wallets: user.wallets.map((wallet) => ({
      id: wallet.id,
      walletAddress: wallet.walletAddress,
      label: wallet.label,
      isPrimary: wallet.isPrimary,
      isActive: wallet.isActive,
    })),
  };
}

function formatTokenSupply(rawAmount, decimals) {
  const normalizedRawAmount = String(rawAmount ?? '0');
  const normalizedDecimals = Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;

  if (normalizedDecimals === 0) {
    return normalizedRawAmount;
  }

  const padded = normalizedRawAmount.padStart(normalizedDecimals + 1, '0');
  const whole = padded.slice(0, -normalizedDecimals) || '0';
  const fraction = padded.slice(-normalizedDecimals).replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

function normalizeTokenLabel(value) {
  return String(value || '').trim().toUpperCase();
}

function selectPortalManagedToken(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const exactBtnSymbolMatch = tokens.find((token) => normalizeTokenLabel(token.symbol) === 'BTN');
  if (exactBtnSymbolMatch) {
    return exactBtnSymbolMatch;
  }

  const btnNameMatch = tokens.find((token) => normalizeTokenLabel(token.name).includes('BTN'));
  if (btnNameMatch) {
    return btnNameMatch;
  }

  return tokens[0];
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      wallets: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = jwt.sign(
    {
      userId: user.id,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );

  return {
    token,
    user: mapUserProfile(user),
  };
}

async function customerLogin({ cid, mpin }) {
  const user = await prisma.user.findUnique({
    where: { cid },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      wallets: true,
    },
  });

  if (!user || !user.isActive || !user.mpinHash) {
    throw new ApiError(401, 'Invalid CID or MPIN');
  }

  const isMpinValid = await bcrypt.compare(mpin, user.mpinHash);

  if (!isMpinValid) {
    throw new ApiError(401, 'Invalid CID or MPIN');
  }

  const token = jwt.sign(
    {
      userId: user.id,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );

  return {
    token,
    user: mapUserProfile(user),
  };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      wallets: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return mapUserProfile(user);
}

async function getCustomerPortalSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallets: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(404, 'User not found');
  }

  const managedTokens = await prisma.managedToken.findMany({
    orderBy: [
      { createdAt: 'desc' },
    ],
  });
  const managedToken = selectPortalManagedToken(managedTokens);
  const issuerBank = await prisma.bank.findFirst({
    where: {
      isIssuer: true,
      isActive: true,
    },
    include: {
      accounts: {
        where: {
          isActive: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
  });

  let token = null;

  if (managedToken) {
    const hydratedToken = await solanaService.hydrateManagedToken(managedToken);
    const decimals = hydratedToken.onChain?.decimals ?? hydratedToken.decimals ?? 0;
    const rawSupply = hydratedToken.onChain?.supply ?? '0';
    let distributionInventory = null;

    if (issuerBank?.id && hydratedToken.mintAddress) {
      try {
        const distributionTokenAccount = await solanaService.resolveBankDistributionTokenAccount(
          issuerBank.id,
          hydratedToken.mintAddress,
        );
        const distributionBalance = await solanaService.getTokenAccountBalance(
          distributionTokenAccount.tokenAccountAddress,
        );

        distributionInventory = {
          purpose: distributionTokenAccount.purpose,
          tokenAccountAddress: distributionTokenAccount.tokenAccountAddress,
          walletAddress: distributionTokenAccount.treasuryWalletAddress,
          rawAmount: distributionBalance.rawAmount,
          displayAmount: formatTokenSupply(distributionBalance.rawAmount, decimals),
        };
      } catch (error) {
        distributionInventory = {
          purpose: 'DISTRIBUTION',
          tokenAccountAddress: null,
          walletAddress: null,
          rawAmount: null,
          displayAmount: null,
          warning: error.message,
        };
      }
    }

    token = {
      id: hydratedToken.id,
      name: hydratedToken.name || 'BTN Token',
      symbol: hydratedToken.symbol || 'BTN',
      mintAddress: hydratedToken.mintAddress,
      decimals,
      totalSupplyRaw: rawSupply,
      totalSupplyDisplay: formatTokenSupply(rawSupply, decimals),
      referencePrice: env.BTN_REFERENCE_PRICE,
      referencePriceCurrency: env.BTN_REFERENCE_PRICE_CURRENCY,
      distributionInventory,
      explorerUrl: hydratedToken.explorerUrl || null,
      warning: hydratedToken.warning || null,
    };
  } else {
    token = {
      id: null,
      name: 'BTN Token',
      symbol: 'BTN',
      mintAddress: null,
      decimals: 0,
      totalSupplyRaw: null,
      totalSupplyDisplay: null,
      referencePrice: env.BTN_REFERENCE_PRICE,
      referencePriceCurrency: env.BTN_REFERENCE_PRICE_CURRENCY,
      distributionInventory: null,
      explorerUrl: null,
      warning: 'No managed BTN token is registered yet.',
    };
  }

  const primaryWallet = user.wallets[0] || null;
  const reserveAccount = issuerBank?.accounts.find((account) => account.accountType === 'RESERVE') || null;
  const walletBalances = primaryWallet
    ? await solanaService.getWalletTokenBalances(primaryWallet.walletAddress)
    : [];
  const btnWalletBalance = managedToken?.mintAddress
    ? walletBalances.find((item) => item.mintAddress === managedToken.mintAddress) || null
    : null;
  const recentPayments = await prisma.paymentTransaction.findMany({
    where: {
      OR: [
        {
          customerReference: {
            startsWith: `BTN_BUY:${user.id}:`,
          },
        },
        {
          customerReference: {
            startsWith: `BTN_SELL:${user.id}:`,
          },
        },
      ],
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: 10,
  });
  let linkedAccount = null;

  if (user.linkedBankAccountNumber) {
    try {
      const inquiryResult = await cbsService.accountInquiry({
        accountNumber: user.linkedBankAccountNumber,
      });

      linkedAccount = {
        accountNumber: inquiryResult.summary.accountNumber || user.linkedBankAccountNumber,
        accountName: inquiryResult.summary.accountName,
        productType: inquiryResult.summary.productType,
        currencyCode: inquiryResult.summary.currencyCode,
        availableBalance: inquiryResult.summary.availableBalance,
        usdEquivalentAvailableBalance: inquiryResult.summary.usdEquivalentAvailableBalance,
        inquiryId: inquiryResult.summary.inquiryId,
        inquiryTimestamp: inquiryResult.summary.inquiryTimestamp,
        inquiryExpiryTimestamp: inquiryResult.summary.inquiryExpiryTimestamp,
        restrictionSummary: inquiryResult.summary.restrictionSummary,
        warning: null,
      };
    } catch (error) {
      linkedAccount = {
        accountNumber: user.linkedBankAccountNumber,
        accountName: null,
        productType: null,
        currencyCode: 'BTN',
        availableBalance: null,
        usdEquivalentAvailableBalance: null,
        inquiryId: null,
        inquiryTimestamp: null,
        inquiryExpiryTimestamp: null,
        restrictionSummary: null,
        warning: error.message,
      };
    }
  }

  return {
    customer: {
      id: user.id,
      fullName: user.fullName,
      cid: user.cid,
      linkedBankAccountNumber: user.linkedBankAccountNumber,
      primaryWalletAddress: primaryWallet?.walletAddress || null,
      btnBalance: btnWalletBalance?.amount || '0',
      btnBalanceRaw: btnWalletBalance?.rawAmount || '0',
      primaryAccountNumber: user.linkedBankAccountNumber || null,
    },
    linkedAccount,
    walletBalances,
    token,
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      paymentReference: payment.paymentReference,
      gatewayTransactionId: payment.gatewayTransactionId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      statusMessage: payment.statusMessage,
      fulfillmentStatus: payment.parsedPayload?.fulfillment?.status || null,
      fulfillmentError: payment.parsedPayload?.fulfillment?.error || null,
      confirmedAt: payment.confirmedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })),
    linkedBank: issuerBank
      ? {
          id: issuerBank.id,
          name: issuerBank.name,
          code: issuerBank.code,
          supportsBtn: issuerBank.supportsBtn,
          isIssuer: issuerBank.isIssuer,
          reserveAccountNumber: reserveAccount?.accountNumber || null,
          reserveAccountName: reserveAccount?.accountName || null,
        }
      : null,
  };
}

module.exports = {
  customerLogin,
  login,
  getCurrentUser,
  getCustomerPortalSummary,
};
