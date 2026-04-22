const { successResponse, listResponse } = require('../utils/apiResponse');
const managedTokenService = require('../services/managedToken.service');

async function getManagedTokens(req, res) {
  const result = await managedTokenService.listManagedTokens(req.validated.query);

  return listResponse(res, {
    message: 'Managed tokens fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getManagedTokenById(req, res) {
  const token = await managedTokenService.getManagedTokenById(req.params.id);

  return successResponse(res, {
    message: 'Managed token fetched successfully',
    data: token,
  });
}

module.exports = {
  getManagedTokenById,
  getManagedTokens,
};
