const bcrypt = require('bcrypt');

const prisma = require('../config/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { buildPagination, getPagination, getSortOptions } = require('../utils/pagination');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../utils/enums');
const { normalizeLinkedBankAccountNumbers, userInclude, serializeUser } = require('../models/user.model');
const auditLogService = require('./auditLog.service');

function resolveLinkedBankAccounts(payload, existingUser = null) {
  const requestedPrimary = payload.linkedBankAccountNumber;
  const requestedAccounts = payload.linkedBankAccountNumbers;

  if (requestedPrimary === undefined && requestedAccounts === undefined) {
    return null;
  }

  const merged = [];
  const seen = new Set();
  const pushAccount = (value) => {
    const accountNumber = String(value || '').trim();
    if (!accountNumber || seen.has(accountNumber)) {
      return;
    }
    seen.add(accountNumber);
    merged.push(accountNumber);
  };

  if (requestedPrimary !== undefined && requestedPrimary !== null) {
    pushAccount(requestedPrimary);
  }
  if (Array.isArray(requestedAccounts)) {
    requestedAccounts.forEach(pushAccount);
  } else if (existingUser?.linkedBankAccountNumbers?.length) {
    existingUser.linkedBankAccountNumbers.forEach(pushAccount);
  }
  if (requestedPrimary === undefined && existingUser?.linkedBankAccountNumber) {
    pushAccount(existingUser.linkedBankAccountNumber);
  }

  return {
    linkedBankAccountNumber: merged[0] || null,
    linkedBankAccountNumbers: merged,
  };
}

async function getRoleRecords(roleNames, tx = prisma) {
  const roles = await tx.role.findMany({
    where: {
      name: {
        in: roleNames,
      },
    },
  });

  if (roles.length !== roleNames.length) {
    throw new ApiError(400, 'One or more roles are invalid');
  }

  return roles;
}

async function createUser(payload, actorUserId) {
  const roleNames = payload.roles || [];
  const passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
  const mpinHash = payload.mpin ? await bcrypt.hash(payload.mpin, env.BCRYPT_SALT_ROUNDS) : null;
  const linkedAccounts = resolveLinkedBankAccounts(payload) || {
    linkedBankAccountNumber: payload.linkedBankAccountNumber || null,
    linkedBankAccountNumbers: payload.linkedBankAccountNumber ? [payload.linkedBankAccountNumber] : [],
  };

  const user = await prisma.$transaction(async (tx) => {
    const roles = roleNames.length ? await getRoleRecords(roleNames, tx) : [];

    const createdUser = await tx.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email.toLowerCase(),
        passwordHash,
        cid: payload.cid || null,
        customerType: payload.customerType || null,
        linkedBankAccountNumber: linkedAccounts.linkedBankAccountNumber,
        linkedBankAccountNumbers: linkedAccounts.linkedBankAccountNumbers,
        mpinHash,
        roles: roles.length
          ? {
              create: roles.map((role) => ({
                roleId: role.id,
              })),
            }
          : undefined,
      },
      include: userInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: createdUser.id,
        action: AUDIT_ACTIONS.CREATE,
        metadata: {
          fullName: createdUser.fullName,
          email: createdUser.email,
          cid: createdUser.cid,
          customerType: createdUser.customerType,
          linkedBankAccountNumber: createdUser.linkedBankAccountNumber,
          linkedBankAccountNumbers: createdUser.linkedBankAccountNumbers,
          roles: roleNames,
        },
      },
      tx,
    );

    for (const roleName of roleNames) {
      await auditLogService.createAuditLog(
        {
          actorUserId,
          entityType: AUDIT_ENTITY_TYPES.ROLE_ASSIGNMENT,
          entityId: createdUser.id,
          action: AUDIT_ACTIONS.ASSIGN_ROLE,
          metadata: {
            roleName,
          },
        },
        tx,
      );
    }

    return createdUser;
  });

  return serializeUser(user);
}

async function listUsers(query) {
  const { page, limit, skip } = getPagination(query);
  const orderBy = getSortOptions(query, ['fullName', 'email', 'createdAt', 'updatedAt'], { createdAt: 'desc' });
  const search = query.search?.trim();

  const where = {
    ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
    ...(search
      ? {
          OR: [
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              cid: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              linkedBankAccountNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const [users, totalItems] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: userInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users.map(serializeUser),
    pagination: buildPagination({ page, limit, totalItems }),
  };
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return serializeUser(user);
}

async function updateUser(id, payload, actorUserId) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });

  if (!existingUser) {
    throw new ApiError(404, 'User not found');
  }

  const updateData = {};
  const changedFields = {};

  if (payload.fullName !== undefined && payload.fullName !== existingUser.fullName) {
    updateData.fullName = payload.fullName;
    changedFields.fullName = {
      previous: existingUser.fullName,
      current: payload.fullName,
    };
  }

  if (payload.email !== undefined && payload.email.toLowerCase() !== existingUser.email) {
    updateData.email = payload.email.toLowerCase();
    changedFields.email = {
      previous: existingUser.email,
      current: payload.email.toLowerCase(),
    };
  }

  if (payload.password) {
    updateData.passwordHash = await bcrypt.hash(payload.password, env.BCRYPT_SALT_ROUNDS);
    changedFields.password = {
      previous: '***',
      current: '***',
    };
  }

  if (payload.cid !== undefined && payload.cid !== existingUser.cid) {
    updateData.cid = payload.cid;
    changedFields.cid = {
      previous: existingUser.cid,
      current: payload.cid,
    };
  }

  if (payload.customerType !== undefined && payload.customerType !== existingUser.customerType) {
    updateData.customerType = payload.customerType;
    changedFields.customerType = {
      previous: existingUser.customerType,
      current: payload.customerType,
    };
  }

  if (
    payload.linkedBankAccountNumber !== undefined
    || payload.linkedBankAccountNumbers !== undefined
  ) {
    const linkedAccounts = resolveLinkedBankAccounts(payload, existingUser);
    const previousAccounts = normalizeLinkedBankAccountNumbers(existingUser);

    updateData.linkedBankAccountNumber = linkedAccounts.linkedBankAccountNumber;
    updateData.linkedBankAccountNumbers = linkedAccounts.linkedBankAccountNumbers;
    changedFields.linkedBankAccountNumber = {
      previous: existingUser.linkedBankAccountNumber,
      current: linkedAccounts.linkedBankAccountNumber,
    };
    changedFields.linkedBankAccountNumbers = {
      previous: previousAccounts,
      current: linkedAccounts.linkedBankAccountNumbers,
    };
  }

  if (payload.mpin) {
    updateData.mpinHash = await bcrypt.hash(payload.mpin, env.BCRYPT_SALT_ROUNDS);
    changedFields.mpin = {
      previous: '***',
      current: '***',
    };
  }

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: updateData,
      include: userInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: id,
        action: AUDIT_ACTIONS.UPDATE,
        metadata: {
          changedFields,
        },
      },
      tx,
    );

    return updatedUser;
  });

  return serializeUser(user);
}

async function updateUserStatus(id, isActive, actorUserId) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });

  if (!existingUser) {
    throw new ApiError(404, 'User not found');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: { isActive },
      include: userInclude,
    });

    await auditLogService.createAuditLog(
      {
        actorUserId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: id,
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        metadata: {
          previousStatus: existingUser.isActive,
          newStatus: isActive,
        },
      },
      tx,
    );

    return updatedUser;
  });

  return serializeUser(user);
}

async function assignRoles(userId, roleNames, actorUserId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const currentRoleNames = user.roles.map((item) => item.role.name);
  const duplicateRoles = roleNames.filter((roleName) => currentRoleNames.includes(roleName));

  if (duplicateRoles.length) {
    throw new ApiError(409, `Roles already assigned: ${duplicateRoles.join(', ')}`);
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const roles = await getRoleRecords(roleNames, tx);

    for (const role of roles) {
      await tx.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });

      await auditLogService.createAuditLog(
        {
          actorUserId,
          entityType: AUDIT_ENTITY_TYPES.ROLE_ASSIGNMENT,
          entityId: userId,
          action: AUDIT_ACTIONS.ASSIGN_ROLE,
          metadata: {
            roleName: role.name,
          },
        },
        tx,
      );
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: userInclude,
    });
  });

  return serializeUser(updatedUser);
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  assignRoles,
};
