import { PublicKey } from "@solana/web3.js";
import { prisma } from "../prisma.js";
import { checkFiatPayoutStatus, sendFiatPayout } from "../services/bankApi.service.js";
import { inquireCbsAccount } from "../services/cbsApi.service.js";

const VALID_TYPES = new Set(["TOKEN", "FIAT"]);

const isValidPublicKey = (value) => {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
};

const getCbsAccountInfo = (cbsResult) => cbsResult?.response_data?.account_info || {};
const getCbsAccountStatus = (cbsResult) => cbsResult?.response_data?.account_status || {};

const assertCbsAccountCanReceive = (cbsResult) => {
  const accountStatus = getCbsAccountStatus(cbsResult);
  if (accountStatus.acc_status_code && accountStatus.acc_status_code !== "00") {
    return accountStatus.acc_status_details || "CBS account is not active";
  }

  return null;
};

export const createSettlement = async (req, res) => {
  try {
    const {
      bankId,
      senderWallet,
      recipientWallet,
      recipientRegistered,
      settlementType,
      amount,
      txSignature,
      receiverName,
      receiverAccount,
      productType = "LCY_ACC",
    } = req.body;
    const parsedAmount = Number(amount);

    if (!bankId || !senderWallet || !recipientWallet || !settlementType || amount === undefined) {
      return res.status(400).json({
        error: "bankId, senderWallet, recipientWallet, settlementType and amount required",
      });
    }

    if (!isValidPublicKey(senderWallet) || !isValidPublicKey(recipientWallet)) {
      return res.status(400).json({ error: "senderWallet and recipientWallet must be valid public keys" });
    }

    if (!VALID_TYPES.has(settlementType)) {
      return res.status(400).json({ error: "settlementType must be TOKEN or FIAT" });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const bank = await prisma.bank.findUnique({ where: { id: bankId } });

    if (!bank) {
      return res.status(404).json({ error: "Bank not found" });
    }

    if (bank.wallet !== senderWallet) {
      return res.status(400).json({ error: "senderWallet must match bank wallet" });
    }

    if (settlementType === "FIAT" && parsedAmount > bank.fiatReserve) {
      return res.status(400).json({ error: "amount exceeds bank fiat reserve" });
    }

    if (settlementType === "FIAT" && (!receiverName || !receiverAccount)) {
      return res.status(400).json({
        error: "receiverName and receiverAccount required for FIAT settlement",
      });
    }

    const bankApiResult = settlementType === "FIAT"
      ? await sendFiatPayout({
        fromBank: bank,
        receiverName,
        receiverAccount,
        amount: parsedAmount,
        currency: bank.currency,
      })
      : null;

    if (bankApiResult?.status !== "SUCCESS" && settlementType === "FIAT") {
      return res.status(502).json({
        error: "Mock bank API payout failed",
        bankApiStatus: bankApiResult?.status,
        bankApiMessage: bankApiResult?.message,
        bankInquiryId: bankApiResult?.inquiryId,
        bankTransactionId: bankApiResult?.transactionId,
      });
    }

    const settlement = await prisma.$transaction(async (tx) => {
      const saved = await tx.settlement.create({
        data: {
          bankId,
          senderWallet,
          recipientWallet,
          recipientRegistered: Boolean(recipientRegistered),
          settlementType,
          amount: parsedAmount,
          currency: bank.currency,
          status: settlementType === "TOKEN" ? "Token Sent" : "Fiat Transfer Queued",
          txSignature,
          receiverName: receiverName || null,
          receiverAccount: receiverAccount || null,
          cbsProductType: settlementType === "FIAT" ? productType : null,
          bankReference: bankApiResult?.reference || null,
          bankInquiryId: bankApiResult?.inquiryId || null,
          bankTransactionId: bankApiResult?.transactionId || null,
          bankApiStatus: bankApiResult?.status || null,
          bankApiMessage: bankApiResult?.message || null,
        },
        include: {
          bank: true,
        },
      });

      if (settlementType === "FIAT") {
        await tx.bank.update({
          where: { id: bankId },
          data: {
            fiatReserve: {
              decrement: parsedAmount,
            },
          },
        });
      }

      return saved;
    });

    res.status(201).json(settlement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const createUnregisteredFiatSettlement = async (req, res) => {
  try {
    const {
      bankId,
      senderWallet,
      recipientWallet,
      amount,
      txSignature,
      burnTxSignature,
      receiverAccount,
      productType = "LCY_ACC",
    } = req.body;
    const parsedAmount = Number(amount);

    if (!bankId || !senderWallet || amount === undefined || !receiverAccount) {
      return res.status(400).json({
        error: "bankId, senderWallet, amount and receiverAccount required",
      });
    }

    if (!isValidPublicKey(senderWallet)) {
      return res.status(400).json({ error: "senderWallet must be a valid public key" });
    }

    if (recipientWallet && !isValidPublicKey(recipientWallet)) {
      return res.status(400).json({ error: "recipientWallet must be a valid public key when provided" });
    }

    if (!/^\d{12}$/.test(String(receiverAccount))) {
      return res.status(400).json({ error: "receiverAccount must be a 12 digit account number" });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const bank = await prisma.bank.findUnique({ where: { id: bankId } });

    if (!bank) {
      return res.status(404).json({ error: "Bank not found" });
    }

    if (bank.wallet !== senderWallet) {
      return res.status(400).json({ error: "senderWallet must match bank wallet" });
    }

    if (parsedAmount > bank.fiatReserve) {
      return res.status(400).json({ error: "amount exceeds bank fiat reserve" });
    }

    const cbsAccount = await inquireCbsAccount({
      accountNo: String(receiverAccount),
      productType,
    });
    const accountBlockReason = assertCbsAccountCanReceive(cbsAccount);

    if (accountBlockReason) {
      return res.status(400).json({
        error: "CBS account cannot receive transfer",
        cbsStatus: getCbsAccountStatus(cbsAccount),
        message: accountBlockReason,
      });
    }

    const cbsAccountInfo = getCbsAccountInfo(cbsAccount);
    const receiverName = cbsAccountInfo.account_name;

    if (!receiverName) {
      return res.status(502).json({
        error: "CBS account inquiry did not return account name",
      });
    }

    const bankApiResult = await sendFiatPayout({
      fromBank: bank,
      receiverName,
      receiverAccount: String(receiverAccount),
      amount: parsedAmount,
      currency: bank.currency,
    });

    if (bankApiResult?.status !== "SUCCESS") {
      return res.status(502).json({
        error: "Bank FIAT transfer failed",
        bankApiStatus: bankApiResult?.status,
        bankApiMessage: bankApiResult?.message,
        bankInquiryId: bankApiResult?.inquiryId,
        bankTransactionId: bankApiResult?.transactionId,
      });
    }

    const settlement = await prisma.$transaction(async (tx) => {
      const saved = await tx.settlement.create({
        data: {
          bankId,
          senderWallet,
          recipientWallet: recipientWallet || `UNREGISTERED:${receiverAccount}`,
          recipientRegistered: false,
          settlementType: "FIAT",
          amount: parsedAmount,
          currency: bank.currency,
          status: "Fiat Transfer Queued",
          txSignature: burnTxSignature || txSignature || null,
          receiverName,
          receiverAccount: String(receiverAccount),
          cbsProductType: productType,
          bankReference: bankApiResult?.reference || null,
          bankInquiryId: bankApiResult?.inquiryId || null,
          bankTransactionId: bankApiResult?.transactionId || null,
          bankApiStatus: bankApiResult?.status || null,
          bankApiMessage: bankApiResult?.message || null,
        },
        include: {
          bank: true,
        },
      });

      await tx.bank.update({
        where: { id: bankId },
        data: {
          fiatReserve: {
            decrement: parsedAmount,
          },
        },
      });

      return saved;
    });

    res.status(201).json({
      settlement,
      cbsAccount: {
        response_code: cbsAccount.response_code,
        response_detail: cbsAccount.response_detail,
        account_status: getCbsAccountStatus(cbsAccount),
        account_info: {
          account_name: cbsAccountInfo.account_name,
          account_no: cbsAccountInfo.account_no,
        },
      },
      bankTransfer: {
        inquiryId: bankApiResult.inquiryId,
        transactionId: bankApiResult.transactionId,
        status: bankApiResult.status,
        message: bankApiResult.message,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
};

export const refreshSettlementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        bank: true,
      },
    });

    if (!settlement) {
      return res.status(404).json({ error: "Settlement not found" });
    }

    if (settlement.settlementType !== "FIAT") {
      return res.status(400).json({ error: "Only FIAT settlements have bank transfer status" });
    }

    if (!settlement.bankTransactionId || !settlement.receiverAccount) {
      return res.status(400).json({
        error: "Settlement does not have bankTransactionId and receiverAccount",
      });
    }

    const bankStatusResult = await checkFiatPayoutStatus({
      transactionId: settlement.bankTransactionId,
      receiverAccount: settlement.receiverAccount,
    });

    const refreshedStatus = bankStatusResult.status === "SUCCESS"
      ? "Fiat Transfer Sent"
      : bankStatusResult.status === "FAILED"
        ? "Fiat Transfer Failed"
        : settlement.status;

    const updated = await prisma.settlement.update({
      where: { id },
      data: {
        status: refreshedStatus,
        bankReference: bankStatusResult.reference || settlement.bankReference,
        bankApiStatus: bankStatusResult.status || settlement.bankApiStatus,
        bankApiMessage: bankStatusResult.message || settlement.bankApiMessage,
        bankStatusCheckedAt: new Date(),
      },
      include: {
        bank: true,
      },
    });

    res.json({
      settlement: updated,
      bankStatus: bankStatusResult,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getSettlements = async (req, res) => {
  try {
    const { bankId, recipientWallet } = req.query;

    if (recipientWallet && !isValidPublicKey(recipientWallet)) {
      return res.status(400).json({ error: "recipientWallet must be a valid public key" });
    }

    const settlements = await prisma.settlement.findMany({
      where: {
        ...(bankId ? { bankId } : {}),
        ...(recipientWallet ? { recipientWallet } : {}),
      },
      include: {
        bank: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(settlements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
