const { successResponse, listResponse } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');

async function createWallet(req, res) {
  const wallet = await walletService.createWallet(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Wallet created successfully',
    data: wallet,
  });
}

async function getWallets(req, res) {
  const result = await walletService.listWallets(req.validated.query);

  return listResponse(res, {
    message: 'Wallets fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getWalletById(req, res) {
  const wallet = await walletService.getWalletById(req.params.id);

  return successResponse(res, {
    message: 'Wallet fetched successfully',
    data: wallet,
  });
}

async function updateWallet(req, res) {
  const wallet = await walletService.updateWallet(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Wallet updated successfully',
    data: wallet,
  });
}

async function updateWalletStatus(req, res) {
  const wallet = await walletService.updateWalletStatus(req.params.id, req.validated.body.isActive, req.user.id);

  return successResponse(res, {
    message: 'Wallet status updated successfully',
    data: wallet,
  });
}

module.exports = {
  createWallet,
  getWallets,
  getWalletById,
  updateWallet,
  updateWalletStatus,
};
