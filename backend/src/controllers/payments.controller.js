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

async function fetchGatewayAuthorizationToken(req, res) {
  const result = await paymentsService.fetchGatewayAuthorizationToken(req.validated.body || {});

  return successResponse(res, {
    message: 'Payment gateway authorization token fetched successfully',
    data: result,
  });
}

async function fetchGatewaySigningKey(req, res) {
  const result = await paymentsService.fetchGatewaySigningKey({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return res
    .status(200)
    .type('text/plain; charset=utf-8')
    .send(result.privateKeyPem);
}

async function generateGatewaySignature(req, res) {
  const result = await paymentsService.generateGatewaySignature(req.validated.body);

  return successResponse(res, {
    message: 'Payment gateway signature generated successfully',
    data: result,
  });
}

async function authorizeGatewayPullPayment(req, res) {
  const result = await paymentsService.authorizeGatewayPullPayment({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway account authorization request completed successfully',
    data: result,
  });
}

async function createGatewayDebitRequest(req, res) {
  const result = await paymentsService.createGatewayDebitRequest({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway debit request completed successfully',
    data: result,
  });
}

async function inquireGatewayBeneficiaryAccount(req, res) {
  const result = await paymentsService.inquireGatewayBeneficiaryAccount({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway beneficiary inquiry completed successfully',
    data: result,
  });
}

async function initiateGatewayIntraTransaction(req, res) {
  const result = await paymentsService.initiateGatewayIntraTransaction({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway intra transaction initiated successfully',
    data: result,
  });
}

async function getGatewayTransactionStatusForToday(req, res) {
  const result = await paymentsService.getGatewayTransactionStatusForToday({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway current-day transaction status fetched successfully',
    data: result,
  });
}

async function getGatewayTransactionStatusForHistory(req, res) {
  const result = await paymentsService.getGatewayTransactionStatusForHistory({
    ...(req.validated.body || {}),
    authorizationHeader: req.headers.authorization,
  });

  return successResponse(res, {
    message: 'Payment gateway subsequent-day transaction status fetched successfully',
    data: result,
  });
}

async function authorizePullPayment(req, res) {
  const result = await paymentsService.authorizePullPayment(req.validated.body);

  return successResponse(res, {
    message: 'Pull payment authorization completed successfully',
    data: result,
  });
}

async function debitPullPayment(req, res) {
  const result = await paymentsService.debitPullPayment(req.validated.body);

  return successResponse(res, {
    message: 'Pull payment debit completed successfully',
    data: result,
  });
}

async function beneficiaryAccountInquiry(req, res) {
  const result = await paymentsService.beneficiaryAccountInquiry(req.validated.body);

  return successResponse(res, {
    message: 'Beneficiary account inquiry completed successfully',
    data: result,
  });
}

async function initiateIntraTransaction(req, res) {
  const result = await paymentsService.initiateIntraTransaction(req.validated.body);

  return successResponse(res, {
    message: 'Intra transaction initiated successfully',
    data: result,
  });
}

async function getCurrentPaymentStatus(req, res) {
  const result = await paymentsService.getCurrentPaymentStatus(req.validated.body);

  return successResponse(res, {
    message: 'Current-day payment status fetched successfully',
    data: result,
  });
}

async function getHistoricalPaymentStatus(req, res) {
  const result = await paymentsService.getHistoricalPaymentStatus(req.validated.body);

  return successResponse(res, {
    message: 'Historical payment status fetched successfully',
    data: result,
  });
}

async function initiateCustomerBuyBtn(req, res) {
  const result = await paymentsService.initiateCustomerBuyBtn(req.user.id, req.validated.body);

  return successResponse(res, {
    statusCode: 201,
    message: 'Customer BTN purchase payment initiated successfully',
    data: result,
  });
}

async function initiateCustomerSellBtn(req, res) {
  const result = await paymentsService.initiateCustomerSellBtn(req.user.id, req.validated.body);

  return successResponse(res, {
    statusCode: 201,
    message: 'Customer BTN sell payout initiated successfully',
    data: result,
  });
}

async function getCustomerPaymentTransaction(req, res) {
  const result = await paymentsService.getCustomerPaymentTransaction(req.user.id, req.params.paymentReference);

  return successResponse(res, {
    message: 'Customer payment transaction fetched successfully',
    data: result,
  });
}

async function verifyCustomerPaymentStatus(req, res) {
  const result = await paymentsService.verifyCustomerPaymentStatus(req.user.id, req.params.paymentReference);

  return successResponse(res, {
    message: 'Customer payment status verified successfully',
    data: result,
  });
}

module.exports = {
  authorizeGatewayPullPayment,
  authorizePullPayment,
  beneficiaryAccountInquiry,
  createGatewayDebitRequest,
  debitPullPayment,
  fetchGatewayAuthorizationToken,
  fetchGatewaySigningKey,
  generateGatewaySignature,
  getGatewayTransactionStatusForHistory,
  getGatewayTransactionStatusForToday,
  getCurrentPaymentStatus,
  getCustomerPaymentTransaction,
  getHistoricalPaymentStatus,
  ingestPaymentCallback,
  initiateCustomerBuyBtn,
  initiateCustomerSellBtn,
  initiateIntraTransaction,
  initiateGatewayIntraTransaction,
  inquireGatewayBeneficiaryAccount,
  getPaymentTransaction,
  verifyCustomerPaymentStatus,
  verifyPaymentStatus,
};
