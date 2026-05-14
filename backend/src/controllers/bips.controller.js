const { successResponse } = require('../utils/apiResponse');
const bipsService = require('../services/bips.service');

async function accountInquiry(req, res) {
  const result = await bipsService.accountInquiry(req.validated.body);

  return successResponse(res, {
    message: 'BIPS account inquiry completed',
    data: result,
  });
}

async function outgoingTransfer(req, res) {
  const result = await bipsService.outgoingTransfer(req.validated.body);

  return successResponse(res, {
    message: 'BIPS outgoing transfer completed',
    data: result,
  });
}

async function getPgStatus(req, res) {
  const result = await bipsService.getPgStatus(req.validated.query);

  return successResponse(res, {
    message: 'BIPS PG status fetched',
    data: result,
  });
}

async function liveInquiry(req, res) {
  const result = await bipsService.liveInquiry(req.validated.query);

  return successResponse(res, {
    message: 'BIPS live inquiry fetched',
    data: result,
  });
}

module.exports = {
  accountInquiry,
  outgoingTransfer,
  getPgStatus,
  liveInquiry,
};
