import { prisma } from "../prisma.js";

const VALID_STATUSES = new Set(["Pending", "Approved", "Rejected"]);

export const createMintRequest = async (req, res) => {
  try {
    const { requestAddr, maker, amount, bankId } = req.body;
    const parsedAmount = Number(amount);

    if (!requestAddr || !maker || amount === undefined) {
      return res.status(400).json({ error: "requestAddr, maker and amount required" });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const bank = bankId
      ? await prisma.bank.findUnique({ where: { id: bankId } })
      : await prisma.bank.findUnique({ where: { wallet: maker } }).catch(() => null);

    if (bankId && !bank) {
      return res.status(404).json({ error: "Bank not found" });
    }

    if (bank && bank.wallet !== maker) {
      return res.status(400).json({ error: "maker wallet must match bank wallet" });
    }

    if (bank && parsedAmount > bank.fiatReserve) {
      return res.status(400).json({ error: "amount exceeds bank fiat reserve" });
    }

    const mintRequest = await prisma.mintRequest.create({
      data: {
        requestAddr,
        maker,
        bankId: bank?.id,
        amount: parsedAmount,
        reserveSnapshot: bank?.fiatReserve,
      },
      include: {
        bank: true,
      },
    });

    res.status(201).json(mintRequest);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "requestAddr already exists" });
    }

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMintRequests = async (req, res) => {
  try {
    const mintRequests = await prisma.mintRequest.findMany({
      include: {
        bank: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(mintRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMintRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const mintRequest = await prisma.mintRequest.findUnique({
      where: { id },
      include: {
        bank: true,
      },
    });

    if (!mintRequest) {
      return res.status(404).json({ error: "Mint request not found" });
    }

    res.json(mintRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateMintRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, txSignature } = req.body;

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be Pending, Approved or Rejected" });
    }

    const mintRequest = await prisma.mintRequest.update({
      where: { id },
      data: {
        status,
        txSignature,
      },
      include: {
        bank: true,
      },
    });

    res.json(mintRequest);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Mint request not found" });
    }

    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const approveMintRequest = async (req, res) => {
  req.body.status = "Approved";
  return updateMintRequestStatus(req, res);
};

export const rejectMintRequest = async (req, res) => {
  req.body.status = "Rejected";
  return updateMintRequestStatus(req, res);
};
