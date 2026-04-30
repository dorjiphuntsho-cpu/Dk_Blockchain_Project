const { listResponse, successResponse } = require('../utils/apiResponse');
const settlementService = require('../services/settlement.service');

async function createReserveMintRequest(req, res) {
  const result = await settlementService.createReserveMintRequest(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Reserve mint request created successfully',
    data: result,
  });
}

async function createReplenishmentMintRequest(req, res) {
  const result = await settlementService.createReplenishmentMintRequest(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Replenishment mint request created successfully',
    data: result,
  });
}

async function createInterbankTransferRequest(req, res) {
  const result = await settlementService.createInterbankTransferRequest(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Interbank transfer request created successfully',
    data: result,
  });
}

async function createRedemptionRequest(req, res) {
  const result = await settlementService.createRedemptionRequest(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'Redemption request created successfully',
    data: result,
  });
}

async function getSettlements(req, res) {
  const result = await settlementService.listSettlements(req.validated.query);

  return listResponse(res, {
    message: 'Settlements fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getSettlementById(req, res) {
  const result = await settlementService.getSettlementById(req.params.id);

  return successResponse(res, {
    message: 'Settlement fetched successfully',
    data: result,
  });
}

async function routeSettlement(req, res) {
  const result = await settlementService.routeSettlement(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Settlement route refreshed successfully',
    data: result,
  });
}

async function prepareMintSettlementRequest(req, res) {
  const result = await settlementService.prepareMintSettlementRequest(
    req.params.id,
    req.user,
    req.validated.query?.makerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement mint request payload prepared successfully',
    data: result,
  });
}

async function prepareTransferSettlementRequest(req, res) {
  const result = await settlementService.prepareTransferSettlementRequest(
    req.params.id,
    req.user,
    req.validated.query?.makerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement transfer request payload prepared successfully',
    data: result,
  });
}

async function prepareBurnSettlementRequest(req, res) {
  const result = await settlementService.prepareBurnSettlementRequest(
    req.params.id,
    req.user,
    req.validated.query?.makerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement burn request payload prepared successfully',
    data: result,
  });
}

async function prepareMintSettlementCheckerApproval(req, res) {
  const result = await settlementService.prepareMintSettlementCheckerApproval(
    req.params.id,
    req.user,
    req.validated.query?.checkerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement checker approval payload prepared successfully',
    data: result,
  });
}

async function prepareTransferSettlementCheckerApproval(req, res) {
  const result = await settlementService.prepareTransferSettlementCheckerApproval(
    req.params.id,
    req.user,
    req.validated.query?.checkerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement transfer checker approval payload prepared successfully',
    data: result,
  });
}

async function prepareBurnSettlementCheckerApproval(req, res) {
  const result = await settlementService.prepareBurnSettlementCheckerApproval(
    req.params.id,
    req.user,
    req.validated.query?.checkerWalletAddress,
  );

  return successResponse(res, {
    message: 'Settlement burn checker approval payload prepared successfully',
    data: result,
  });
}

async function recordMintSettlementInitiation(req, res) {
  const result = await settlementService.recordMintSettlementInitiation(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement wallet initiation recorded successfully',
    data: result,
  });
}

async function recordTransferSettlementInitiation(req, res) {
  const result = await settlementService.recordTransferSettlementInitiation(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement transfer initiation recorded successfully',
    data: result,
  });
}

async function recordBurnSettlementInitiation(req, res) {
  const result = await settlementService.recordBurnSettlementInitiation(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement burn initiation recorded successfully',
    data: result,
  });
}

async function recordMintSettlementExecution(req, res) {
  const result = await settlementService.recordMintSettlementExecution(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement execution recorded successfully',
    data: result,
  });
}

async function recordTransferSettlementExecution(req, res) {
  const result = await settlementService.recordTransferSettlementExecution(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement transfer execution recorded successfully',
    data: result,
  });
}

async function runSettlementInquiry(req, res) {
  const result = await settlementService.runSettlementInquiry(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Settlement BIPS inquiry completed successfully',
    data: result,
  });
}

async function recordBurnSettlementExecution(req, res) {
  const result = await settlementService.recordBurnSettlementExecution(
    req.params.id,
    req.validated.body,
    req.user.id,
  );

  return successResponse(res, {
    message: 'Settlement burn execution recorded successfully',
    data: result,
  });
}

async function reconcileSettlement(req, res) {
  const result = await settlementService.reconcileSettlement(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Settlement reconciliation completed successfully',
    data: result,
  });
}

async function reconcilePendingSettlements(req, res) {
  const result = await settlementService.reconcilePendingSettlements(req.validated.body || {}, req.user.id);

  return successResponse(res, {
    message: 'Pending settlement reconciliation completed successfully',
    data: result,
  });
}

async function approveSettlement(req, res) {
  const result = await settlementService.approveSettlement(req.params.id, req.user.id, req.validated.body);

  return successResponse(res, {
    message: 'Settlement approved successfully',
    data: result,
  });
}

async function rejectSettlement(req, res) {
  const result = await settlementService.rejectSettlement(req.params.id, req.user.id, req.validated.body);

  return successResponse(res, {
    message: 'Settlement rejected successfully',
    data: result,
  });
}

async function markSettlementReadyForExecution(req, res) {
  const result = await settlementService.markSettlementReadyForExecution(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Settlement marked ready for execution successfully',
    data: result,
  });
}

async function executeSettlement(req, res) {
  const result = await settlementService.executeSettlement(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Settlement executed successfully',
    data: result,
  });
}

module.exports = {
  createReserveMintRequest,
  createReplenishmentMintRequest,
  createInterbankTransferRequest,
  createRedemptionRequest,
  getSettlements,
  getSettlementById,
  routeSettlement,
  prepareMintSettlementRequest,
  prepareTransferSettlementRequest,
  prepareBurnSettlementRequest,
  prepareMintSettlementCheckerApproval,
  prepareTransferSettlementCheckerApproval,
  prepareBurnSettlementCheckerApproval,
  recordMintSettlementInitiation,
  recordTransferSettlementInitiation,
  recordBurnSettlementInitiation,
  recordMintSettlementExecution,
  recordTransferSettlementExecution,
  runSettlementInquiry,
  recordBurnSettlementExecution,
  reconcileSettlement,
  reconcilePendingSettlements,
  approveSettlement,
  rejectSettlement,
  markSettlementReadyForExecution,
  executeSettlement,
};
