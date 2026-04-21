const prisma = require('../config/prisma');

async function getRoles() {
  return prisma.role.findMany({
    orderBy: {
      name: 'asc',
    },
  });
}

module.exports = {
  getRoles,
};
