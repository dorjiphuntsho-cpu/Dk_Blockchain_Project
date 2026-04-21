const walletInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
    },
  },
};

module.exports = {
  walletInclude,
};
