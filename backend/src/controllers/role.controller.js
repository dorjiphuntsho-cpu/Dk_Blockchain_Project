const { successResponse } = require('../utils/apiResponse');
const roleService = require('../services/role.service');
const userService = require('../services/user.service');

async function getRoles(_req, res) {
  const roles = await roleService.getRoles();

  return successResponse(res, {
    message: 'Roles fetched successfully',
    data: roles,
  });
}

async function assignRoles(req, res) {
  const user = await userService.assignRoles(req.params.id, req.validated.body.roles, req.user.id);

  return successResponse(res, {
    message: 'Roles assigned successfully',
    data: user,
  });
}

module.exports = {
  getRoles,
  assignRoles,
};
