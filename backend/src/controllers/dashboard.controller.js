const { successResponse } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

async function getDashboardOverview(req, res) {
  const overview = await dashboardService.getDashboardOverview(req.user);

  return successResponse(res, {
    message: 'Dashboard overview fetched successfully',
    data: overview,
  });
}

module.exports = {
  getDashboardOverview,
};
