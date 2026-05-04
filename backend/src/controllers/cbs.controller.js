const { successResponse } = require('../utils/apiResponse');
const cbsService = require('../services/cbs.service');

async function accountInquiry(req, res) {
  const result = await cbsService.accountInquiry(req.validated.body);

  return successResponse(res, {
    message: 'CBS account inquiry completed successfully',
    data: result,
  });
}

async function issuerReserveBalance(_req, res) {
  const result = await cbsService.getIssuerReserveBalance();

  return successResponse(res, {
    message: 'CBS issuer reserve balance fetched successfully',
    data: result,
  });
}

module.exports = {
  accountInquiry,
  issuerReserveBalance,
};
