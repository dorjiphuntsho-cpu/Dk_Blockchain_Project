const { successResponse } = require('../utils/apiResponse');
const solanaService = require('../services/solana.service');
const managedTokenService = require('../services/managedToken.service');
const blockchainService = require('../services/blockchain.service');

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

async function prepareMintCreation(_req, res) {
  const payload = await blockchainService.prepareMintCreationPayload();

  return successResponse(res, {
    message: 'Mint creation payload prepared successfully',
    data: payload,
  });
}

async function recordCreatedTokenMint(req, res) {
  const persistedMint = await managedTokenService.createManagedTokenRecord(req.validated.body, req.user.id);
  const hydratedMint = await solanaService.hydrateManagedToken(persistedMint);

  return successResponse(res, {
    statusCode: 201,
    message: 'Managed token mint recorded successfully',
    data: hydratedMint,
  });
}

async function createTokenMint(req, res) {
  const mint = await solanaService.createTokenMint(req.validated.body);
  const mintWithAdmin = { ...mint, adminWalletAddress: req.validated.body.adminWalletAddress };
  const persistedMint = await managedTokenService.createManagedTokenRecord(mintWithAdmin, req.user.id);
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
  recordCreatedTokenMint,
  prepareMintCreation,
  getConfigStatus,
  removeChecker,
  setAdmin,
};
