const { listResponse, successResponse } = require('../utils/apiResponse');
const reserveService = require('../services/reserve.service');

async function getReserves(req, res) {
  const result = await reserveService.listReserves(req.validated.query);

  return listResponse(res, {
    message: 'Reserves fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getReserveTransactions(req, res) {
  const transactions = await reserveService.getReserveTransactions();

  return successResponse(res, {
    message: 'Reserve transactions fetched successfully',
    data: transactions,
  });
}

async function getReserveById(req, res) {
  const reserve = await reserveService.getReserveLedgerOrThrow(req.params.id);

  return successResponse(res, {
    message: 'Reserve fetched successfully',
    data: reserve,
  });
}

async function approveReserve(req, res) {
  const reserve = await reserveService.approveReserve(req.params.id, req.user.id);

  return successResponse(res, {
    message: 'Reserve approved successfully',
    data: reserve,
  });
}

async function rejectReserve(req, res) {
  const reserve = await reserveService.rejectReserve(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'Reserve rejected successfully',
    data: reserve,
  });
}

module.exports = {
  getReserves,
  getReserveTransactions,
  getReserveById,
  approveReserve,
  rejectReserve,
};
