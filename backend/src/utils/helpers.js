/**
 * Generates a unique request ID.
 * Per BIPS spec, request_id must be generated on the frontend
 * and passed through. This helper is provided for reference/testing only.
 * In production: call generateRequestId() in your React app.
 */
const generateRequestId = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${timestamp}${random}`;
};

/**
 * Maps BIPS error codes to user-friendly messages and HTTP status codes.
 */
const BIPS_ERROR_MAP = {
    "0000": { message: "Success", httpStatus: 200 },
    "2000": { message: "Account inquiry failed", httpStatus: 200 },
    "3001": { message: "Record not found", httpStatus: 404 },
    "3012": { message: "Invalid request", httpStatus: 400 },
    "3019": { message: "Duplicate transaction — check if prior transfer succeeded before retrying", httpStatus: 400 },
    "3401": { message: "Missing request ID", httpStatus: 400 },
    "3413": { message: "Record not found", httpStatus: 404 },
    "5000": { message: "Internal system error", httpStatus: 500 },
    "6001": { message: "Request timed out from BIPS provider", httpStatus: 408 },
    "5003": { message: "BIPS service unavailable", httpStatus: 503 },
    "5401": { message: "RMA system is down", httpStatus: 500 },
};

const resolveBipsError = (code) =>
    BIPS_ERROR_MAP[code] || { message: "Unknown error", httpStatus: 500 };

const isBipsRecordNotFound = (code) => ["3001", "3413"].includes(String(code || "").trim());

module.exports = { generateRequestId, resolveBipsError, isBipsRecordNotFound, BIPS_ERROR_MAP };
