const env = require('./config/env');
const { bootstrapApplication } = require('./config/bootstrap');
const logger = require('./utils/logger');

let server;

async function startServer() {
  await bootstrapApplication();

  const app = require('./app');

  server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully.`);
  if (!server) {
    process.exit(0);
    return;
  }

  const prisma = require('./config/prisma');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((error) => {
  logger.error('Failed to start server.', error);
  process.exit(1);
});
