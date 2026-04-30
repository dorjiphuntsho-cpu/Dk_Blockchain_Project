const { successResponse } = require('../utils/apiResponse');
const paymentsService = require('../services/payments.service');

async function ingestPaymentCallback(req, res) {
  const result = await paymentsService.ingestPaymentCallback(req.validated.body, req.headers);

  return successResponse(res, {
    statusCode: 201,
    message: 'Payment callback accepted',
    data: result,
  });
}

async function getPaymentTransaction(req, res) {
  const transaction = await paymentsService.getPaymentTransactionByReference(req.params.paymentReference);

  return successResponse(res, {
    message: 'Payment transaction fetched successfully',
    data: transaction,
  });
}

async function verifyPaymentStatus(req, res) {
  const result = await paymentsService.verifyPaymentStatus(req.params.paymentReference);

  return successResponse(res, {
    message: 'Payment status verified successfully',
    data: result,
  });
}

module.exports = {
  ingestPaymentCallback,
  getPaymentTransaction,
  verifyPaymentStatus,
};
