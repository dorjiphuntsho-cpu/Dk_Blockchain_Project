function successResponse(res, { statusCode = 200, message, data = {} }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function listResponse(res, { statusCode = 200, message, items, pagination }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      items,
      pagination,
    },
  });
}

module.exports = {
  successResponse,
  listResponse,
};
