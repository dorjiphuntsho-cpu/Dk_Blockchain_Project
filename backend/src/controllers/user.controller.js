const { successResponse, listResponse } = require('../utils/apiResponse');
const userService = require('../services/user.service');

async function createUser(req, res) {
  const user = await userService.createUser(req.validated.body, req.user.id);

  return successResponse(res, {
    statusCode: 201,
    message: 'User created successfully',
    data: user,
  });
}

async function getUsers(req, res) {
  const result = await userService.listUsers(req.validated.query);

  return listResponse(res, {
    message: 'Users fetched successfully',
    items: result.items,
    pagination: result.pagination,
  });
}

async function getUserById(req, res) {
  const user = await userService.getUserById(req.params.id);

  return successResponse(res, {
    message: 'User fetched successfully',
    data: user,
  });
}

async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.validated.body, req.user.id);

  return successResponse(res, {
    message: 'User updated successfully',
    data: user,
  });
}

async function updateUserStatus(req, res) {
  const user = await userService.updateUserStatus(req.params.id, req.validated.body.isActive, req.user.id);

  return successResponse(res, {
    message: 'User status updated successfully',
    data: user,
  });
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
};
