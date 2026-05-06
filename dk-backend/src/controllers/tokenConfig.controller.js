import { PublicKey } from "@solana/web3.js";
import { prisma } from "../prisma.js";

const CONFIG_ID = "default";

const isValidPublicKey = (value) => {
  if (!value) return true;

  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
};

export const getTokenConfig = async (req, res) => {
  try {
    const tokenConfig = await prisma.tokenConfig.findUnique({
      where: { id: CONFIG_ID },
    });

    res.json(tokenConfig || {
      id: CONFIG_ID,
      adminAddr: null,
      configAddr: null,
      mintAddr: null,
      checkers: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateTokenConfig = async (req, res) => {
  try {
    const { adminAddr, configAddr, mintAddr, checkers } = req.body;

    if (!isValidPublicKey(adminAddr)) {
      return res.status(400).json({ error: "adminAddr must be a valid public key" });
    }

    if (!isValidPublicKey(configAddr)) {
      return res.status(400).json({ error: "configAddr must be a valid public key" });
    }

    if (!isValidPublicKey(mintAddr)) {
      return res.status(400).json({ error: "mintAddr must be a valid public key" });
    }

    if (checkers !== undefined) {
      if (!Array.isArray(checkers)) {
        return res.status(400).json({ error: "checkers must be an array" });
      }

      if (!checkers.every((checker) => checker && isValidPublicKey(checker))) {
        return res.status(400).json({ error: "every checker must be a valid public key" });
      }
    }

    const data = {};
    if (adminAddr !== undefined) data.adminAddr = adminAddr || null;
    if (configAddr !== undefined) data.configAddr = configAddr || null;
    if (mintAddr !== undefined) data.mintAddr = mintAddr || null;
    if (checkers !== undefined) data.checkers = checkers;

    const tokenConfig = await prisma.tokenConfig.upsert({
      where: { id: CONFIG_ID },
      create: {
        id: CONFIG_ID,
        ...data,
      },
      update: data,
    });

    res.json(tokenConfig);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
