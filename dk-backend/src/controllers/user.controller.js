import { prisma } from "../prisma.js";

const VALID_ROLES = new Set(["Admin", "Maker", "Checker", "User"]);

export const createUser = async (req, res) => {
  try {
    const { wallet, role } = req.body;

    if (!wallet || !role) {
      return res.status(400).json({ error: "wallet and role required" });
    }

    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ error: "role must be Admin, Maker, Checker or User" });
    }

    const user = await prisma.user.create({
      data: {
        wallet,
        role,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "wallet already exists" });
    }

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUserByWallet = async (req, res) => {
  try {
    const { wallet } = req.params;

    const user = await prisma.user.findUnique({
      where: { wallet },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
