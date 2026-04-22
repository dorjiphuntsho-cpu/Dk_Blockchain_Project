const { successResponse } = require('../utils/apiResponse');
const solanaService = require('../services/solana.service');
const managedTokenService = require('../services/managedToken.service');

async function getConfigStatus(_req, res) {
  const status = await solanaService.getConfigStatus();

  return successResponse(res, {
    message: 'Solana config status fetched successfully',
    data: status,
  });
}

async function addChecker(req, res) {
  const status = await solanaService.addChecker(req.validated.body.checkerAddress);

  return successResponse(res, {
    message: 'Checker added successfully',
    data: status,
  });
}

async function removeChecker(req, res) {
  const status = await solanaService.removeChecker(req.validated.params.checkerAddress);

  return successResponse(res, {
    message: 'Checker removed successfully',
    data: status,
  });
}

async function setAdmin(req, res) {
  const status = await solanaService.setAdmin(req.validated.body.newAdminAddress);

  return successResponse(res, {
    message: 'On-chain admin updated successfully',
    data: status,
  });
}

async function createTokenMint(req, res) {
  const mint = await solanaService.createTokenMint(req.validated.body.decimals);
  const persistedMint = await managedTokenService.createManagedTokenRecord(mint, req.user.id);
  const hydratedMint = await solanaService.hydrateManagedToken(persistedMint);

  return successResponse(res, {
    statusCode: 201,
    message: 'Managed token mint created successfully',
    data: hydratedMint,
  });
}

module.exports = {
  addChecker,
  createTokenMint,
  getConfigStatus,
  removeChecker,
  setAdmin,
};
