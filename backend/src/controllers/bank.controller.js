const { listResponse, successResponse } = require('../utils/apiResponse');
const bankService = require('../services/bank.service');

async function getBanks(req, res) {
  const result = await bankService.listBanks(req.validated.query);

  return listResponse(res, {
    message: 'Banks fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getBankById(req, res) {
  const bank = await bankService.getBankById(req.params.id);

  return successResponse(res, {
    message: 'Bank fetched successfully',
    data: bank,
  });
}

async function updateBank(req, res) {
  const bank = await bankService.updateBank(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Bank updated successfully',
    data: bank,
  });
}

async function createBankAccount(req, res) {
  const bank = await bankService.createBankAccount(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Bank account created successfully',
    data: bank,
  });
}

async function updateBankAccount(req, res) {
  const bank = await bankService.updateBankAccount(req.params.id, req.params.accountId, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Bank account updated successfully',
    data: bank,
  });
}

async function createBankTokenAccount(req, res) {
  const bank = await bankService.createBankTokenAccount(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Bank token account created successfully',
    data: bank,
  });
}

async function updateBankTokenAccount(req, res) {
  const bank = await bankService.updateBankTokenAccount(
    req.params.id,
    req.params.tokenAccountId,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Bank token account updated successfully',
    data: bank,
  });
}

module.exports = {
  getBanks,
  getBankById,
  updateBank,
  createBankAccount,
  updateBankAccount,
  createBankTokenAccount,
  updateBankTokenAccount,
};
