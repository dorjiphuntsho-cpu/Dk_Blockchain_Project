const tokenRequestInclude = {
  sourceWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
      userId: true,
    },
  },
  destinationWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
      userId: true,
    },
  },
  makerUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  checkerUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  approvals: {
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      checkerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
};

const approvalInclude = {
  sourceWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
    },
  },
  destinationWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
    },
  },
  makerUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  checkerUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  approvals: {
    orderBy: {
      createdAt: 'desc',
    },
  },
};

const requestPayloadInclude = {
  sourceWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
    },
  },
  destinationWallet: {
    select: {
      id: true,
      walletAddress: true,
      label: true,
    },
  },
  makerUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
};

module.exports = {
  tokenRequestInclude,
  approvalInclude,
  requestPayloadInclude,
};
