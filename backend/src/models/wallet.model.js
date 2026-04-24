const walletInclude = {
  user: {
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  },
};

module.exports = {
  walletInclude,
};
