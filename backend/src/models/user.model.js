const userInclude = {
  roles: {
    include: {
      role: true,
    },
  },
  wallets: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
      isPrimary: true,
      isActive: true,
    },
  },
};

function serializeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    cid: user.cid,
    customerType: user.customerType,
    linkedBankAccountNumber: user.linkedBankAccountNumber,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map((item) => item.role.name),
    wallets: user.wallets,
  };
}

module.exports = {
  userInclude,
  serializeUser,
};
