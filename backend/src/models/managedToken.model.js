const managedTokenInclude = {
  creatorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
};

module.exports = {
  managedTokenInclude,
};
