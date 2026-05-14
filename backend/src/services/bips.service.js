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

function parseTlvFields(value) {
  const input = String(value || '');
  const fields = {};
  let index = 0;

  while (index + 6 <= input.length) {
    const tag = input.slice(index, index + 3);
    const length = Number(input.slice(index + 3, index + 6));
    index += 6;
    if (!Number.isInteger(length) || length < 0 || index + length > input.length) {
      break;
    }
    fields[tag] = input.slice(index, index + length);
    index += length;
  }

  return fields;
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

function encodeTlvField(tag, value, length = 3) {
  const normalized = String(value ?? '');
  return `${String(tag).padStart(3, '0')}${String(normalized.length).padStart(length, '0')}${normalized}`;
}

function buildInquiryAccountIdentifier(prefix, accountNumber) {
  return `${prefix}${String(accountNumber || '').replace(/\D/g, '')}`;
}

function buildInquiryPrimaryAccountNumber() {
  if (env.BIPS_SOURCE_PRIMARY_ACCOUNT_NUMBER) {
    return env.BIPS_SOURCE_PRIMARY_ACCOUNT_NUMBER;
  }

  return env.BIPS_SOURCE_PAN_NUMBER || `${env.BIPS_SOURCE_BIN_NUMBER}999999999`;
}

function buildAcqInstitutionIdCode() {
  const bin = String(env.BIPS_SOURCE_BIN_NUMBER || '').replace(/\D/g, '');
  if (!bin) {
    return '';
  }

  return `0${bin[0]}${bin}`;
}

function buildSupportingInformationForInquiry(payload, requestMeta) {
  const sourceName = String(payload.sourceAccountName || '');
  const transferPurpose = String(payload.transferPurpose || '');
  const sourceBankCode = String(payload.sourceBankCode || env.BIPS_SOURCE_BANK_CODE || '');
  const beneficiaryBankCode = String(payload.beneficiaryBankCode || '');

  return [
    '113001003003002006MOBILE',
    `003${String(sourceName.length).padStart(3, '0')}${sourceName}`,
    `004000005${String(transferPurpose.length).padStart(3, '0')}${transferPurpose}`,
    `006012${requestMeta.retrievalReferenceNumber}`,
    `007000008004${sourceBankCode}`,
    `009004${beneficiaryBankCode}`,
  ].join('').slice(0, 199);
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
  const primaryAccountNumber = buildInquiryPrimaryAccountNumber();
  const sourceAccountIdentifier = buildInquiryAccountIdentifier('12', payload.sourceAccountNumber);
  const beneficiaryAccountIdentifier = buildInquiryAccountIdentifier('13', payload.beneficiaryAccountNumber);
  return [
    '<RequestXml>',
    `<PrimaryAccountNumber>${primaryAccountNumber}</PrimaryAccountNumber>`,
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
    `<AcqInstitutionIdCode>${buildAcqInstitutionIdCode()}</AcqInstitutionIdCode>`,
    `<RetrievalReferenceNumber>${requestMeta.retrievalReferenceNumber}</RetrievalReferenceNumber>`,
    '<CardAcceptorTerminalId>00000000</CardAcceptorTerminalId>',
    '<CardAcquirerId>000000000000000</CardAcquirerId>',
    '<AcceptorNameAndLocation>DK Thimphu000000000000000000000000000000</AcceptorNameAndLocation>',
    '<TxnCurrencyCode>064</TxnCurrencyCode>',
    `<AccountIdentification1>${sourceAccountIdentifier}</AccountIdentification1>`,
    `<AccountIdentification2>${beneficiaryAccountIdentifier}</AccountIdentification2>`,
    `<SupportingInformation>${escapeXml(buildSupportingInformationForInquiry(payload, requestMeta))}</SupportingInformation>`,
    '</RequestXml>',
  ].join('');
}

function buildOutgoingRequestXml(payload, requestMeta) {
  return [
    '<RequestXml>',
    `<PrimaryAccountNumber>${env.BIPS_SOURCE_PRIMARY_ACCOUNT_NUMBER}</PrimaryAccountNumber>`,
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

function buildNaradaJsonPayload({ apiKey, requestXml, requestMeta, payload }) {
  return {
    Amount: Number(payload.amount),
    BeneficiaryAccountNumber: payload.beneficiaryAccountNumber,
    BeneficiaryBankCode: payload.beneficiaryBankCode,
    SourceAccountName: payload.sourceAccountName,
    SourceAccountNumber: payload.sourceAccountNumber,
    SourceBankCode: payload.sourceBankCode || env.BIPS_SOURCE_BANK_CODE,
    TransferPurpose: payload.transferPurpose,
    request_id: payload.requestId,
  };
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
    if (error?.cause?.code === 'ENOTFOUND') {
      const hostname = new URL(url).hostname;
      throw new ApiError(502, `BIPS host could not be resolved: ${hostname}`);
    }
    if (error?.cause?.code === 'ECONNREFUSED') {
      throw new ApiError(502, 'BIPS connection was refused by the remote host');
    }
    if (error?.cause?.code === 'ETIMEDOUT') {
      throw new ApiError(504, 'BIPS connection timed out');
    }
    if (error?.cause?.code === 'ECONNRESET') {
      throw new ApiError(502, 'BIPS connection was reset by the remote host');
    }
    const causeCode = error?.cause?.code;
    const causeMessage = error?.cause?.message || error?.message;

    if (causeCode && /CERT|TLS|SSL/i.test(causeCode)) {
      throw new ApiError(502, `BIPS TLS error: ${causeCode}${causeMessage ? ` - ${causeMessage}` : ''}`);
    }
    if (causeMessage) {
      throw new ApiError(502, `BIPS request failed: ${causeCode ? `${causeCode} - ` : ''}${causeMessage}`);
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

function normalizeAccountInquiryResponse(parsedResponse) {

  if (parsedResponse?.response_code) {
    return {
      response_code: parsedResponse.response_code,
      response_data: parsedResponse.response_data ?? null,
      response_description: parsedResponse.response_description ?? null,
      response_message: parsedResponse.response_message ?? null,
      response_time: parsedResponse.response_time || parsedResponse.responsetime || null,
    };
  }

  const embedded = parsedResponse?.embeddedResponse || {};
  const additionalData = parseTlvFields(embedded.AdditionalData);
  const responseCode = embedded.ResponseCode || parsedResponse?.responseCode;

  if (!responseCode) {
    return parsedResponse;
  }

  return {
    response_code: responseCode === '00' ? '0000' : responseCode,
    response_data: {
      account_type: additionalData['002'] || null,
      beneficiary_account_name: additionalData['001'] || null,
      reference_number: embedded.RetrievalReferenceNumber || null,
      status: additionalData['003'] || null,
    },
    response_description: parsedResponse?.responseText || null,
    response_message: parsedResponse?.responseText || null,
    response_time: parsedResponse?.msgTimeStamp || null,
  };
}

function extractBipsResponseCode(parsedResponse) {
  return parsedResponse?.response_code
    || parsedResponse?.embeddedResponse?.ResponseCode
    || parsedResponse?.responseCode
    || null;
}

function extractBipsResponseMessage(parsedResponse) {
  return parsedResponse?.response_message
    || parsedResponse?.response_description
    || parsedResponse?.responseText
    || null;
}

function extractInquiryReferenceNumber(parsedResponse) {
  return parsedResponse?.response_data?.reference_number
    || parsedResponse?.embeddedResponse?.RetrievalReferenceNumber
    || null;
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

async function executeJsonRequest({
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

  const payload = buildNaradaJsonPayload({ apiKey, requestXml, requestMeta, payload: requestPayload });
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
        'Content-Type': 'application/json',
      },
      body: payload,
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
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = parseSoapResponse(responseText);
    }
    const normalizedResponse =
      requestType === 'ACCOUNT_INQUIRY' ? normalizeAccountInquiryResponse(parsedResponse) : parsedResponse;

    await updateLog(logEntry.id, {
      transactionId: parsedResponse.msgRefNo || normalizedResponse?.response_data?.reference_number || null,
      rawResponse: {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      },
      parsedResponse: normalizedResponse,
      responseStatus:
        normalizedResponse.responseCode || normalizedResponse.response_code || String(response.status),
      responseMessage:
        normalizedResponse.responseText
        || normalizedResponse.response_message
        || normalizedResponse.response_detail
        || response.statusText,
    });

    return {
      logId: logEntry.id,
      httpStatus: response.status,
      rawResponse: responseText,
      parsedResponse: normalizedResponse,
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
  return executeJsonRequest({
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

async function processTransfer(payload) {
  const inquiryResult = await accountInquiry(payload);
  const inquiryCode = extractBipsResponseCode(inquiryResult.parsedResponse);
  const inquiryMessage = extractBipsResponseMessage(inquiryResult.parsedResponse);
  const referenceNumber = extractInquiryReferenceNumber(inquiryResult.parsedResponse);
  const inquirySucceeded = ['00', '0000'].includes(String(inquiryCode || ''));

  if (!inquirySucceeded) {
    return {
      completed: false,
      stage: 'ACCOUNT_INQUIRY',
      status: 'STOPPED',
      requestId: payload.requestId,
      inquiry: {
        responseCode: inquiryCode,
        responseMessage: inquiryMessage,
        referenceNumber,
        result: inquiryResult,
      },
      outgoing: null,
    };
  }

  if (!referenceNumber) {
    throw new ApiError(502, 'BIPS inquiry succeeded but did not return reference_number');
  }

  const outgoingResult = await outgoingTransfer({
    ...payload,
    referenceNumber,
  });
  const outgoingCode = extractBipsResponseCode(outgoingResult.parsedResponse);
  const outgoingMessage = extractBipsResponseMessage(outgoingResult.parsedResponse);
  const outgoingSucceeded = ['00', '0000'].includes(String(outgoingCode || ''));

  return {
    completed: outgoingSucceeded,
    stage: 'OUTGOING',
    status: outgoingSucceeded ? 'COMPLETED' : 'OUTGOING_FAILED',
    requestId: payload.requestId,
    inquiry: {
      responseCode: inquiryCode,
      responseMessage: inquiryMessage,
      referenceNumber,
      result: inquiryResult,
    },
    outgoing: {
      responseCode: outgoingCode,
      responseMessage: outgoingMessage,
      referenceNumber,
      result: outgoingResult,
    },
  };
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
  processTransfer,
  getPgStatus,
  liveInquiry,
};
