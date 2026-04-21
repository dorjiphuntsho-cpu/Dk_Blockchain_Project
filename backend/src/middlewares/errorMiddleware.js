const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function errorMiddleware(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let errors = error.errors || [];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      statusCode = 409;
      message = 'Resource already exists';
      errors = [
        {
          message: `Unique constraint failed on: ${error.meta?.target?.join(', ') || 'unknown field'}`,
        },
      ];
    }

    if (error.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found';
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Database validation failed';
  } else if (!(error instanceof ApiError)) {
    logger.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

module.exports = errorMiddleware;
