const crypto = require('crypto');

const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function ensureConfigured() {
  const missing = [
    'BIPS_BASE_URL',
    'BIPS_API_USER_ID',
    'BIPS_API_PASSWORD',
    'BIPS_CLIENT_ID',
    'BIPS_CHANNEL_TYPE',
    'BIPS_ACCINQ_API_KEY',
    'BIPS_IMPSCR_API_KEY',
    'BIPS_SOURCE_BANK_CODE',
    'BIPS_SOURCE_BIN_NUMBER',
    'BIPS_SOURCE_PAN_NUMBER',
  ].filter((key) => !env[key]);

  if (missing.length) {
    throw new ApiError(500, `BIPS configuration is incomplete: ${missing.join(', ')}`);
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractFirstTagValue(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xml || '');
  return match ? match[1].trim() : null;
}

function extractAllSimpleTags(xml) {
  const content = xml || '';
  const regex = /<([A-Za-z0-9_:.-]+)>([\s\S]*?)<\/\1>/g;
  const values = {};
  let match = regex.exec(content);
  while (match) {
    const tagName = match[1].includes(':') ? match[1].split(':').pop() : match[1];
    if (!(tagName in values)) {
      values[tagName] = match[2].trim();
    }
    match = regex.exec(content);
  }
  return values;
}

function buildTimestampParts(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const traceAuditNumber = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  return {
    msgTimeStamp: `${year}${month}${date}${hours}${minutes}${seconds}`,
    txnDateAndTime: `${month}${date}${hours}${minutes}${seconds}`,
    localTime: `${hours}${minutes}${seconds}`,
    localDate: `${month}${date}`,
    traceAuditNumber,
    msgRefNo: `${date}${hours}${minutes}${traceAuditNumber}`,
    retrievalReferenceNumber: `${date}${hours}${minutes}${traceAuditNumber}`,
  };
}

function toMinorUnits(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }

  return String(Math.round(numeric * 100)).padStart(12, '0');
}

function buildSupportingInformationForInquiry(payload, requestMeta) {
  return [
    `SRC_NAME:${payload.sourceAccountName}`,
    `SRC_ACCT:${payload.sourceAccountNumber}`,
    `SRC_BANK:${payload.sourceBankCode || env.BIPS_SOURCE_BANK_CODE}`,
    `DEST_BANK:${payload.beneficiaryBankCode}`,
    `PURPOSE:${payload.transferPurpose}`,
    `REQ:${payload.requestId}`,
    `REF:${requestMeta.retrievalReferenceNumber}`,
  ].join('|').slice(0, 199);
}

function buildSupportingInformationForOutgoing(payload) {
  return [
    `SRC_NAME:${payload.sourceAccountName}`,
    `SRC_ACCT:${payload.sourceAccountNumber}`,
    `DEST_NAME:${payload.beneficiaryAccountName}`,
    `DEST_ACCT:${payload.beneficiaryAccountNumber}`,
    `DEST_BANK:${payload.beneficiaryBankCode}`,
    `PURPOSE:${payload.transferPurpose}`,
    `REQ:${payload.requestId}`,
    `REF:${payload.referenceNumber}`,
  ].join('|').slice(0, 199);
}

function buildAccountInquiryRequestXml(payload, requestMeta) {
  return [
    '<RequestXml>',
    `<PrimaryAccountNumber>${env.BIPS_SOURCE_BIN_NUMBER}999999999</PrimaryAccountNumber>`,
    '<ProcessingCode>350000</ProcessingCode>',
    `<TxnAmount>${toMinorUnits(payload.amount)}</TxnAmount>`,
    `<TxnDateAndTime>${requestMeta.txnDateAndTime}</TxnDateAndTime>`,
    `<TraceAuditNumber>${requestMeta.traceAuditNumber}</TraceAuditNumber>`,
    `<LocalTime>${requestMeta.localTime}</LocalTime>`,
    `<LocalDate>${requestMeta.localDate}</LocalDate>`,
    '<MerchantType>6012</MerchantType>',
    '<AcqCountryCode>064</AcqCountryCode>',
    '<PosEntryMode>900</PosEntryMode>',
    '<PosConditionCode>00</PosConditionCode>',
    '<TxnFeeAmount>D00000000</TxnFeeAmount>',
    `<AcqInstitutionIdCode>0${env.BIPS_SOURCE_BIN_NUMBER}</AcqInstitutionIdCode>`,
    `<RetrievalReferenceNumber>${requestMeta.retrievalReferenceNumber}</RetrievalReferenceNumber>`,
    '<CardAcceptorTerminalId>00000000</CardAcceptorTerminalId>',
    '<CardAcquirerId>000000000000000</CardAcquirerId>',
    '<AcceptorNameAndLocation>DK Thimphu000000000000000000000000000000</AcceptorNameAndLocation>',
    '<TxnCurrencyCode>064</TxnCurrencyCode>',
    `<AccountIdentification1>${payload.sourceAccountNumber}</AccountIdentification1>`,
    `<AccountIdentification2>${payload.beneficiaryAccountNumber}</AccountIdentification2>`,
    `<SupportingInformation>${escapeXml(buildSupportingInformationForInquiry(payload, requestMeta))}</SupportingInformation>`,
    '</RequestXml>',
  ].join('');
}

function buildOutgoingRequestXml(payload, requestMeta) {
  return [
    '<RequestXml>',
    `<PrimaryAccountNumber>${env.BIPS_SOURCE_BIN_NUMBER}999999999</PrimaryAccountNumber>`,
    '<ProcessingCode>260000</ProcessingCode>',
    `<TxnAmount>${toMinorUnits(payload.amount)}</TxnAmount>`,
    `<TxnDateAndTime>${requestMeta.txnDateAndTime}</TxnDateAndTime>`,
    `<TraceAuditNumber>${requestMeta.traceAuditNumber}</TraceAuditNumber>`,
    `<LocalTime>${requestMeta.localTime}</LocalTime>`,
    `<LocalDate>${requestMeta.localDate}</LocalDate>`,
    '<MerchantType>6012</MerchantType>',
    '<AcqCountryCode>064</AcqCountryCode>',
    '<PosEntryMode>900</PosEntryMode>',
    '<PosConditionCode>00</PosConditionCode>',
    '<TxnFeeAmount>D00000000</TxnFeeAmount>',
    `<AcqInstitutionIdCode>0${env.BIPS_SOURCE_BIN_NUMBER}</AcqInstitutionIdCode>`,
    `<RetrievalReferenceNumber>${payload.referenceNumber}</RetrievalReferenceNumber>`,
    '<CardAcceptorTerminalId>00000000</CardAcceptorTerminalId>',
    '<CardAcquirerId>000000000000000</CardAcquirerId>',
    '<AcceptorNameAndLocation>DK Thimphu000000000000000000000000000000</AcceptorNameAndLocation>',
    '<TxnCurrencyCode>064</TxnCurrencyCode>',
    `<AccountIdentification1>${payload.sourceAccountNumber}</AccountIdentification1>`,
    `<AccountIdentification2>${payload.beneficiaryAccountNumber}</AccountIdentification2>`,
    `<SupportingInformation>${escapeXml(buildSupportingInformationForOutgoing(payload))}</SupportingInformation>`,
    '</RequestXml>',
  ].join('');
}

function buildSoapEnvelope({ apiKey, requestXml, requestMeta }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://model.api.ycs.com/xsd" xmlns:ser="http://services.api.ycs.com">
  <soapenv:Body>
    <ser:serviceCall>
      <ser:naradaRequest>
        <xsd:requestBody>
          <xsd:request>${escapeXml(requestXml)}</xsd:request>
        </xsd:requestBody>
        <xsd:requestHeader>
          <xsd:apiKey>${apiKey}</xsd:apiKey>
          <xsd:apiPasswd>${env.BIPS_API_PASSWORD}</xsd:apiPasswd>
          <xsd:apiUserId>${env.BIPS_API_USER_ID}</xsd:apiUserId>
          <xsd:channelType>${env.BIPS_CHANNEL_TYPE}</xsd:channelType>
          <xsd:clientId>${env.BIPS_CLIENT_ID}</xsd:clientId>
          <xsd:msgRefNo>${requestMeta.msgRefNo}</xsd:msgRefNo>
          <xsd:msgTimeStamp>${requestMeta.msgTimeStamp}</xsd:msgTimeStamp>
          <xsd:sessionKey></xsd:sessionKey>
          <xsd:token></xsd:token>
        </xsd:requestHeader>
      </ser:naradaRequest>
    </ser:serviceCall>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.BIPS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'BIPS request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createLog(data) {
  return prisma.bipsTransactionLog.create({
    data,
  });
}

async function updateLog(id, data) {
  return prisma.bipsTransactionLog.update({
    where: { id },
    data,
  });
}

function parseSoapResponse(responseText) {
  const responseBody = extractFirstTagValue(responseText, 'response');
  const decodedResponseBody = responseBody ? decodeXmlEntities(responseBody) : null;
  const embeddedResponse = decodedResponseBody ? extractAllSimpleTags(decodedResponseBody) : {};

  return {
    responseCode: extractFirstTagValue(responseText, 'responseCode'),
    responseText: extractFirstTagValue(responseText, 'responseText'),
    msgRefNo: extractFirstTagValue(responseText, 'msgRefNo'),
    msgTimeStamp: extractFirstTagValue(responseText, 'msgTimeStamp'),
    embeddedResponseXml: decodedResponseBody,
    embeddedResponse,
  };
}

async function executeSoapRequest({
  requestType,
  apiPath,
  apiKey,
  requestPayload,
  requestMeta,
  requestXml,
  settlementRequestId = null,
  requestId = null,
  referenceNumber = null,
}) {
  ensureConfigured();

  const envelope = buildSoapEnvelope({ apiKey, requestXml, requestMeta });
  const url = `${env.BIPS_BASE_URL}${apiPath}`;
  const logEntry = await createLog({
    settlementRequestId,
    requestType,
    requestId,
    referenceNumber,
    rawRequest: {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: envelope,
    },
    parsedRequest: {
      payload: requestPayload,
      requestMeta,
      requestXml,
    },
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: envelope,
    });
    const responseText = await response.text();
    const parsed = parseSoapResponse(responseText);

    await updateLog(logEntry.id, {
      transactionId: parsed.msgRefNo || null,
      rawResponse: {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      },
      parsedResponse: parsed,
      responseStatus: parsed.responseCode || String(response.status),
      responseMessage: parsed.responseText || response.statusText,
    });

    return {
      logId: logEntry.id,
      requestMeta,
      httpStatus: response.status,
      rawResponse: responseText,
      parsedResponse: parsed,
    };
  } catch (error) {
    await updateLog(logEntry.id, {
      responseStatus: 'ERROR',
      responseMessage: error.message,
      rawResponse: {
        error: error.message,
      },
    });
    logger.error(`BIPS ${requestType} failed`, error);
    throw error;
  }
}

async function executeGetRequest({
  requestType,
  apiPath,
  query,
  settlementRequestId = null,
  requestId = null,
  referenceNumber = null,
  transactionId = null,
}) {
  ensureConfigured();

  const searchParams = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const url = `${env.BIPS_BASE_URL}${apiPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const logEntry = await createLog({
    settlementRequestId,
    requestType,
    requestId,
    referenceNumber,
    transactionId,
    rawRequest: {
      url,
      method: 'GET',
    },
    parsedRequest: {
      query,
    },
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    const responseText = await response.text();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = { body: responseText };
    }

    await updateLog(logEntry.id, {
      rawResponse: {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      },
      parsedResponse,
      responseStatus: String(response.status),
      responseMessage: response.statusText,
    });

    return {
      logId: logEntry.id,
      httpStatus: response.status,
      rawResponse: responseText,
      parsedResponse,
    };
  } catch (error) {
    await updateLog(logEntry.id, {
      responseStatus: 'ERROR',
      responseMessage: error.message,
      rawResponse: {
        error: error.message,
      },
    });
    logger.error(`BIPS ${requestType} failed`, error);
    throw error;
  }
}

async function accountInquiry(payload) {
  const requestMeta = buildTimestampParts();
  const requestXml = buildAccountInquiryRequestXml(payload, requestMeta);
  return executeSoapRequest({
    requestType: 'ACCOUNT_INQUIRY',
    apiPath: '/api/bips/account-inquery',
    apiKey: env.BIPS_ACCINQ_API_KEY,
    requestPayload: payload,
    requestMeta,
    requestXml,
    settlementRequestId: payload.settlementRequestId || null,
    requestId: payload.requestId,
    referenceNumber: requestMeta.retrievalReferenceNumber,
  });
}

async function outgoingTransfer(payload) {
  const requestMeta = buildTimestampParts();
  const requestXml = buildOutgoingRequestXml(payload, requestMeta);
  return executeSoapRequest({
    requestType: 'OUTGOING',
    apiPath: '/api/bips/outgoing',
    apiKey: env.BIPS_IMPSCR_API_KEY,
    requestPayload: payload,
    requestMeta,
    requestXml,
    settlementRequestId: payload.settlementRequestId || null,
    requestId: payload.requestId,
    referenceNumber: payload.referenceNumber,
  });
}

async function getPgStatus(query) {
  return executeGetRequest({
    requestType: 'PG_STATUS',
    apiPath: '/api/bips/pg_transaction_status',
    query: {
      transaction_id: query.transactionId,
    },
    settlementRequestId: query.settlementRequestId || null,
    requestId: query.requestId || null,
    transactionId: query.transactionId,
  });
}

async function liveInquiry(query) {
  return executeGetRequest({
    requestType: 'LIVE_INQUIRY',
    apiPath: '/api/bips/live-inquery',
    query: {
      transaction_id: query.transactionId,
      request_id: query.requestId,
      reference_number: query.referenceNumber,
    },
    settlementRequestId: query.settlementRequestId || null,
    requestId: query.requestId || null,
    referenceNumber: query.referenceNumber || null,
    transactionId: query.transactionId || null,
  });
}

module.exports = {
  accountInquiry,
  outgoingTransfer,
  getPgStatus,
  liveInquiry,
};
