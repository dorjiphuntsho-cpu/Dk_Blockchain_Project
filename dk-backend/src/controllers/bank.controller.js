import { PublicKey } from "@solana/web3.js";
import { prisma } from "../prisma.js";

const isValidPublicKey = (value) => {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
};

export const createBank = async (req, res) => {
  try {
    const { name, wallet, currency = "BTN", fiatReserve } = req.body;
    const parsedReserve = Number(fiatReserve);

    if (!name || !wallet || fiatReserve === undefined) {
      return res.status(400).json({ error: "name, wallet and fiatReserve required" });
    }

    if (!isValidPublicKey(wallet)) {
      return res.status(400).json({ error: "wallet must be a valid public key" });
    }

    if (!Number.isFinite(parsedReserve) || parsedReserve < 0) {
      return res.status(400).json({ error: "fiatReserve must be a non-negative number" });
    }

    const bank = await prisma.bank.create({
      data: {
        name,
        wallet,
        currency,
        fiatReserve: parsedReserve,
      },
    });

    res.status(201).json(bank);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "bank wallet already exists" });
    }

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getBanks = async (req, res) => {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(banks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getBankByWallet = async (req, res) => {
  try {
    const { wallet } = req.params;

    const bank = await prisma.bank.findUnique({
      where: { wallet },
    });

    if (!bank) {
      return res.status(404).json({ error: "Bank not found" });
    }

    res.json(bank);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateBankReserve = async (req, res) => {
  try {
    const { id } = req.params;
    const { fiatReserve } = req.body;
    const parsedReserve = Number(fiatReserve);

    if (!Number.isFinite(parsedReserve) || parsedReserve < 0) {
      return res.status(400).json({ error: "fiatReserve must be a non-negative number" });
    }

    const bank = await prisma.bank.update({
      where: { id },
      data: {
        fiatReserve: parsedReserve,
      },
    });

    res.json(bank);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Bank not found" });
    }

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
