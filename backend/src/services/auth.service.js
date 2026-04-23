const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function mapUserProfile(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    roles: user.roles.map((item) => item.role.name),
    wallets: user.wallets.map((wallet) => ({
      id: wallet.id,
      walletAddress: wallet.walletAddress,
      label: wallet.label,
      isPrimary: wallet.isPrimary,
      isActive: wallet.isActive,
    })),
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      wallets: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = jwt.sign(
    {
      userId: user.id,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );

  return {
    token,
    user: mapUserProfile(user),
  };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      wallets: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return mapUserProfile(user);
}

module.exports = {
  login,
  getCurrentUser,
};
