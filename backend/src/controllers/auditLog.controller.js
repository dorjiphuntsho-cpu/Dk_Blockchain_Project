const { successResponse, listResponse } = require('../utils/apiResponse');
const auditLogService = require('../services/auditLog.service');

async function getAuditLogs(req, res) {
  const result = await auditLogService.listAuditLogs(req.validated.query);

  return listResponse(res, {
    message: 'Audit logs fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function createAuditLog(req, res) {
  const auditLog = await auditLogService.createAuditLog(req.body);

  return successResponse(res, {
    statusCode: 201,
    message: 'Audit log created successfully',
    data: auditLog,
  });
}

module.exports = {
  getAuditLogs,
  createAuditLog,
};
