import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { useState, useEffect, useCallback } from "react";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { api } from "./services/api";
import { getProgram } from "./utils/anchor";
import "./App.css";

/* ─── helpers ─── */
const shorten = (addr) => addr.slice(0, 6) + "…" + addr.slice(-4);
const USER_ROLES = ["Maker", "Checker", "User", "Admin"];
const DEFAULT_PUBLIC_KEY = "11111111111111111111111111111111";
const formatAmount = (value) => Number(value || 0).toLocaleString();
const parseAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};
const getCbsAccountStatus = (cbsResult) => cbsResult?.response_data?.account_status || {};
const getCbsAccountInfo = (cbsResult) => cbsResult?.response_data?.account_info || {};
const getCbsMetaInfo = (cbsResult) => cbsResult?.response_data?.meta_info || {};
const getCbsBalanceInfo = (cbsResult) => cbsResult?.response_data?.balance_info || {};
const getCbsTransferLimit = (cbsResult) => cbsResult?.response_data?.daily_max_transfer_limit?.intra_transfer || {};
const isCbsAccountReceivable = (cbsResult) => {
  const status = getCbsAccountStatus(cbsResult);
  return !status.acc_status_code || status.acc_status_code === "00";
};
const formatDateTime = (value) => value
  ? new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  : "";
const mapMintRequestToHistory = (request) => ({
  backendId: request.id,
  addr: request.requestAddr,
  amount: request.amount,
  bank: request.bank,
  reserveSnapshot: request.reserveSnapshot,
  status: request.status,
  txSignature: request.txSignature,
  ts: new Date(request.createdAt).getTime(),
  type: "Mint",
});

/* ─── sub-components ─── */
const StatusBadge = ({ status }) => {
  const map = {
    Pending: { cls: "badge-pending", dot: "dot-pending" },
    Approved: { cls: "badge-approved", dot: "dot-approved" },
    Rejected: { cls: "badge-rejected", dot: "dot-rejected" },
    Sent: { cls: "badge-approved", dot: "dot-approved" },
    Burned: { cls: "badge-rejected", dot: "dot-rejected" },
    "Token Sent": { cls: "badge-approved", dot: "dot-approved" },
    "Fiat Paid Demo": { cls: "badge-approved", dot: "dot-approved", label: "Fiat Transfer Sent" },
    "Fiat Transfer Queued": { cls: "badge-pending", dot: "dot-pending" },
    "Fiat Transfer Sent": { cls: "badge-approved", dot: "dot-approved" },
    "Fiat Transfer Failed": { cls: "badge-rejected", dot: "dot-rejected" },
    SUCCESS: { cls: "badge-approved", dot: "dot-approved" },
    FAILED: { cls: "badge-rejected", dot: "dot-rejected" },
  };
  const { cls, dot, label } = map[status] || map.Pending;
  return (
    <span className={`status-badge ${cls}`}>
      <span className={`badge-dot ${dot}`} />
      {label || status}
    </span>
  );
};

const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast-${t.type}`}>
        <span className="toast-icon">{t.type === "error" ? "✕" : "✓"}</span>
        {t.msg}
      </div>
    ))}
  </div>
);

const SettlementHistoryRow = ({ settlement, perspective, loading, onRefreshStatus }) => {
  const isFiat = settlement.settlementType === "FIAT";
  const counterparty = perspective === "bank"
    ? shorten(settlement.recipientWallet)
    : settlement.bank?.name || shorten(settlement.senderWallet);
  const checkedAt = settlement.bankStatusCheckedAt
    ? `Checked ${formatDateTime(settlement.bankStatusCheckedAt)}`
    : null;

  return (
    <div className="history-row">
      <div className="history-left">
        <span className={`history-type ${settlement.settlementType === "TOKEN" ? "type-transfer" : "type-burn"}`}>
          {settlement.settlementType}
        </span>
        <span className="history-addr">{counterparty}</span>
        {settlement.receiverName && (
          <span className="history-note">{settlement.receiverName}</span>
        )}
        {settlement.receiverAccount && (
          <span className="history-time">CBS {settlement.receiverAccount}</span>
        )}
        {settlement.cbsProductType && (
          <span className="history-time">{settlement.cbsProductType}</span>
        )}
        {settlement.bankTransactionId && (
          <span className="history-time">Bank txn {settlement.bankTransactionId}</span>
        )}
      </div>
      <div className="history-right">
        <span className="history-amount">
          {formatAmount(settlement.amount)} {settlement.settlementType === "TOKEN" ? "DKT" : settlement.currency}
        </span>
        <StatusBadge status={settlement.status} />
        {settlement.bankApiStatus && (
          <span className="history-time">{settlement.bankApiStatus}</span>
        )}
        {settlement.bankApiMessage && (
          <span className="history-note">{settlement.bankApiMessage}</span>
        )}
        {settlement.bankReference && (
          <span className="history-time">{settlement.bankReference}</span>
        )}
        <span className="history-time">{checkedAt || formatDateTime(settlement.createdAt)}</span>
        {isFiat && (
          <button
            className="btn btn-sm"
            onClick={() => onRefreshStatus(settlement.id)}
            disabled={loading || !settlement.bankTransactionId}
          >
            Refresh Status
          </button>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub1, sub2, accent }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${accent}`}>{value}</div>
    <div className="stat-sub">{sub1}</div>
    {sub2 && <div className="stat-sub2">{sub2}</div>}
  </div>
);

const SystemHealthPanel = ({ items }) => (
  <div className="system-health">
    {items.map((item) => (
      <button
        key={item.label}
        className={`health-item health-${item.state}`}
        onClick={item.action}
        type="button"
      >
        <span className="health-topline">
          <span className="health-label">{item.label}</span>
          <span className="health-state">{item.stateText}</span>
        </span>
        <strong>{item.value}</strong>
      </button>
    ))}
  </div>
);

const DemoChecklist = ({ items }) => (
  <div className="card demo-check-card">
    <div className="card-title">Demo Readiness</div>
    <div className="demo-check-list">
      {items.map((item) => (
        <div className={`demo-check-item ${item.done ? "demo-done" : ""}`} key={item.label}>
          <span className="demo-check-mark">{item.done ? "✓" : "•"}</span>
          <span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </span>
        </div>
      ))}
    </div>
  </div>
);

const RoleWorkspace = ({ authorityRole, backendRole, backendStatus, onChainConfig, onSetup }) => {
  const mode = authorityRole === "Checker" || authorityRole === "Admin" ? "Review Queue" : "Mint Desk";

  return (
    <div className="role-workspace">
      <div>
        <div className="role-kicker">Current Workspace</div>
        <div className="role-heading">{mode}</div>
      </div>
      <div className="role-meta-grid">
        <div className="role-meta">
          <span>On-chain role</span>
          <strong>{authorityRole}</strong>
        </div>
        <div className="role-meta">
          <span>Backend label</span>
          <strong>{backendRole || "none"}</strong>
        </div>
        <div className="role-meta">
          <span>Backend</span>
          <strong>{backendStatus}</strong>
        </div>
      </div>
      {!onChainConfig && (
        <button className="btn btn-sm" onClick={onSetup}>
          Setup
        </button>
      )}
    </div>
  );
};

const FlowGuide = ({ steps }) => (
  <div className="flow-guide">
    {steps.map((step, index) => (
      <div className={`flow-step ${step.state}`} key={step.title}>
        <div className="flow-index">{index + 1}</div>
        <div className="flow-content">
          <div className="flow-title">{step.title}</div>
          <div className="flow-desc">{step.desc}</div>
        </div>
        <div className="flow-state">{step.stateText}</div>
      </div>
    ))}
  </div>
);

const FlowActionCard = ({ title, label, status, action, disabled, children }) => (
  <div className="flow-action-card">
    <div>
      <div className="flow-action-label">{label}</div>
      <div className="flow-action-title">{title}</div>
      {children && <div className="flow-action-copy">{children}</div>}
    </div>
    <button className="btn btn-accent" onClick={action} disabled={disabled}>
      {status}
    </button>
  </div>
);

const CheckerQueue = ({ items, canReviewMintRequest, loading, onApprove, onReject, onOpenSetup }) => (
  <div className="card checker-queue-card">
    <div className="card-title">Checker Queue</div>
    {!canReviewMintRequest && (
      <div className="permission-note">
        This wallet is not in the active on-chain checker list.
        <button className="inline-action" onClick={onOpenSetup}>Open Setup</button>
      </div>
    )}
    {items.length === 0 ? (
      <div className="empty-state">No pending approvals</div>
    ) : (
      <div className="review-list">
        {items.map((item) => (
          <div className="review-row" key={item.addr}>
            <div className="review-main">
              <span className="review-id">{shorten(item.addr)}</span>
              <span className="review-maker">
                {item.bank ? item.bank.name : "Maker request"}
                {item.reserveSnapshot !== null && item.reserveSnapshot !== undefined
                  ? ` · reserve ${item.reserveSnapshot.toLocaleString()} ${item.bank?.currency || ""}`
                  : ""}
              </span>
            </div>
            <div className="review-side">
              <span className="review-amount">{item.amount.toLocaleString()} DKT</span>
              <button className="btn-approve" onClick={() => onApprove(item.addr)} disabled={loading || !canReviewMintRequest}>
                Approve
              </button>
              <button className="btn-reject" onClick={() => onReject(item.addr)} disabled={loading || !canReviewMintRequest}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PipelineItem = ({ id, type, amount, checkers, progress, statusText, onApprove, onReject, status }) => {
  const pillClass = type === "Mint" ? "pipe-pill-mint" : type === "Burn" ? "pipe-pill-burn" : "pipe-pill-transfer";
  return (
    <div className="pipe-item">
      <div className="pipe-item-header">
        <div className="pipe-item-id">
          <span className={`pipe-type-pill ${pillClass}`}>{type}</span>
          <span className="pipe-id-text">{id} · {amount.toLocaleString()} DKT</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="pipe-flow">
        <span className="pf-node pf-maker">Maker submits</span>
        {checkers.map((c, i) => (
          <span className="pf-step" key={c.label}>
            <span className="pf-arrow" key={`arr-${i}`}>→</span>
            <span key={`c-${i}`} className={`pf-node ${c.done ? "pf-done" : c.active ? "pf-active" : "pf-idle"}`}>
              {c.label}{c.done ? " ✓" : ""}
            </span>
          </span>
        ))}
      </div>
      <div className="pipe-bar">
        <div className="pipe-fill" style={{ width: `${progress}%`, background: progress === 100 ? "var(--green)" : "var(--amber)" }} />
      </div>
      <div className="pipe-status-row">
        <span className="pipe-status-text">{statusText}</span>
        {status === "Pending" && onApprove && (
          <div className="pipe-actions">
            <button className="btn-approve" onClick={onApprove}>Approve →</button>
            <button className="btn-reject" onClick={onReject}>Reject ✕</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   FIXED UTILITIES
══════════════════════════════════════════ */

/**
 * Sends a transaction and waits for confirmation.
 * Always fetches a fresh blockhash right before signing.
 */
const sendAndConfirm = async (connection, wallet, transaction) => {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const result = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  return sig;
};

/**
 * Polls until an on-chain account exists.
 * Used after ATA creation so the next instruction doesn't race.
 */
const waitForAccount = async (connection, pubkey, maxMs = 45_000, intervalMs = 1_500) => {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const info = await connection.getAccountInfo(pubkey, "confirmed");
    if (info) return info;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Account ${pubkey.toBase58()} not found after ${maxMs / 1000}s`);
};

/**
 * FIX: Get-or-create ATA with guaranteed on-chain confirmation before returning.
 *
 * Old bug: after sending the ATA creation tx, the function returned immediately.
 * The *next* instruction then fired before the ATA existed on-chain → account-not-found
 * error on the first attempt, success only after the ATA was finally propagated
 * (hence needing 3+ clicks).
 *
 * Fix: after sending, we call waitForAccount() to poll until the ATA is confirmed
 * before returning the address to the caller.
 */
const getOrCreateATA = async (connection, wallet, mint, owner) => {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const info = await connection.getAccountInfo(ata, "confirmed");
  if (info) return ata; // already exists, fast path

  // ATA doesn't exist — create it
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      ata,
      owner,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await sendAndConfirm(connection, wallet, tx);

  // ← KEY FIX: wait until the account is actually visible on-chain
  await waitForAccount(connection, ata);

  return ata;
};

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [configPubkey, setConfigPubkey] = useState(null);
  const [mintPubkey, setMintPubkey] = useState(null);
  const [configAddress, setConfigAddress] = useState(null);
  const [mintAddress, setMintAddress] = useState(null);
  const [checkerInput, setCheckerInput] = useState("");
  const [checkers, setCheckers] = useState([]);
  const [amount, setAmount] = useState("");
  const [requestAddress, setRequestAddress] = useState(null);
  const [requestStatus, setRequestStatus] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [bankTask, setBankTask] = useState("profile");
  const [userTask, setUserTask] = useState("profile");
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingMint, setIsCreatingMint] = useState(false);
  const [history, setHistory] = useState([]);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [burnAmt, setBurnAmt] = useState("");
  const [balance, setBalance] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("Maker");
  const [onChainConfig, setOnChainConfig] = useState(null);
  const [currentBank, setCurrentBank] = useState(null);
  const [bankDirectory, setBankDirectory] = useState([]);
  const [bankTokenBalances, setBankTokenBalances] = useState({});
  const [bankName, setBankName] = useState("");
  const [bankCurrency, setBankCurrency] = useState("BTN");
  const [bankReserve, setBankReserve] = useState("");
  const [bankMintAmount, setBankMintAmount] = useState("");
  const [bankDktBalance, setBankDktBalance] = useState(null);
  const [bankRecipient, setBankRecipient] = useState("");
  const [bankTransferAmount, setBankTransferAmount] = useState("");
  const [bankSettlements, setBankSettlements] = useState([]);
  const [bankRecipientStatus, setBankRecipientStatus] = useState(null);
  const [fiatReceiverAccount, setFiatReceiverAccount] = useState("");
  const [fiatProductType, setFiatProductType] = useState("LCY_ACC");
  const [cbsAccountStatus, setCbsAccountStatus] = useState(null);
  const [cbsTestAccounts, setCbsTestAccounts] = useState([]);
  const [fiatPayoutConfirm, setFiatPayoutConfirm] = useState(null);
  const [userDktBalance, setUserDktBalance] = useState(null);
  const [userSettlements, setUserSettlements] = useState([]);
  const [userFiatAccountStatus, setUserFiatAccountStatus] = useState(null);

  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!wallet.connected) { setRequestStatus(null); setBalance(null); }
  }, [wallet.publicKey]);

  const refreshWalletTokenBalance = useCallback(async () => {
    if (!mintAddress || !wallet.publicKey) {
      setUserDktBalance(null);
      return;
    }

    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const info = await connection.getAccountInfo(ata);
      if (!info) {
        setUserDktBalance("0");
        return;
      }

      const bal = await connection.getTokenAccountBalance(ata);
      setUserDktBalance(bal.value.uiAmountString);
    } catch (err) {
      toast(err.message, "error");
    }
  }, [connection, mintAddress, toast, wallet.publicKey]);

  const loadUserSettlements = useCallback(async () => {
    if (!wallet.publicKey) {
      setUserSettlements([]);
      setUserFiatAccountStatus(null);
      return;
    }

    try {
      const settlements = await api.getSettlements({
        recipientWallet: wallet.publicKey.toBase58(),
      });
      setUserSettlements(settlements);
      setUserFiatAccountStatus(null);
      setBackendStatus("connected");
    } catch (err) {
      setBackendStatus("offline");
      toast(`User settlement history unavailable: ${err.message}`, "error");
    }
  }, [toast, wallet.publicKey]);

  const loadMintRequests = useCallback(async () => {
    try {
      const requests = await api.getMintRequests();
      const mintHistory = requests.map(mapMintRequestToHistory);
      setHistory((prev) => {
        const nonMintHistory = prev.filter((item) => item.type !== "Mint");
        return [...mintHistory, ...nonMintHistory].sort((a, b) => b.ts - a.ts);
      });

      const latestPending = mintHistory.find((item) => item.status === "Pending");
      if (latestPending) {
        setRequestAddress(latestPending.addr);
        setRequestStatus(latestPending.status);
      }

      setBackendStatus("connected");
    } catch (err) {
      setBackendStatus("offline");
      toast(`Backend unavailable: ${err.message}`, "error");
    }
  }, [toast]);

  useEffect(() => {
    loadMintRequests();
  }, [loadMintRequests]);

  const loadTokenConfig = useCallback(async () => {
    try {
      const tokenConfig = await api.getTokenConfig();

      if (tokenConfig.configAddr) {
        setConfigAddress(tokenConfig.configAddr);
        setConfigPubkey(new PublicKey(tokenConfig.configAddr));
      }

      if (tokenConfig.mintAddr) {
        setMintAddress(tokenConfig.mintAddr);
        setMintPubkey(new PublicKey(tokenConfig.mintAddr));
      }

      setBackendStatus("connected");
    } catch (err) {
      setBackendStatus("offline");
      toast(`Token config unavailable: ${err.message}`, "error");
    }
  }, [toast]);

  useEffect(() => {
    loadTokenConfig();
  }, [loadTokenConfig]);

  useEffect(() => {
    const loadCbsTestAccounts = async () => {
      try {
        const data = await api.getCbsTestAccounts();
        setCbsTestAccounts(data.accounts || []);
        setFiatProductType(data.productType || "LCY_ACC");
      } catch {
        setCbsTestAccounts([]);
      }
    };

    loadCbsTestAccounts();
  }, []);

  const refreshOnChainConfig = useCallback(async (address = configAddress) => {
    if (!address || !wallet.publicKey) return null;

    const program = getProgram(wallet, connection);
    const config = await program.account.config.fetch(new PublicKey(address));
    const adminAddr = config.admin.toBase58();
    const mintAddr = config.mint.toBase58();
    const checkerAddrs = config.checkers.map((checker) => checker.toBase58());
    const normalized = {
      adminAddr,
      configAddr: address,
      mintAddr: mintAddr === DEFAULT_PUBLIC_KEY ? null : mintAddr,
      checkers: checkerAddrs,
    };

    setOnChainConfig(normalized);
    setCheckers(config.checkers);

    if (normalized.mintAddr) {
      setMintAddress(normalized.mintAddr);
      setMintPubkey(new PublicKey(normalized.mintAddr));
    }

    await api.updateTokenConfig(normalized);
    setBackendStatus("connected");
    return normalized;
  }, [configAddress, connection, wallet]);

  useEffect(() => {
    if (!configAddress || !wallet.publicKey) return;

    refreshOnChainConfig().catch((err) => {
      setOnChainConfig(null);
      toast(`Could not load on-chain config: ${err.message}`, "error");
    });
  }, [configAddress, refreshOnChainConfig, toast, wallet.publicKey]);

  useEffect(() => {
    if (!wallet.publicKey) {
      setCurrentUser(null);
      setCurrentBank(null);
      setUserDktBalance(null);
      setUserSettlements([]);
      return;
    }

    const loadUser = async () => {
      try {
        const user = await api.getUserByWallet(wallet.publicKey.toBase58());
        setCurrentUser(user);
        setBackendStatus("connected");
      } catch {
        setCurrentUser(null);
      }
    };

    loadUser();
  }, [wallet.publicKey]);

  useEffect(() => {
    if (!wallet.publicKey) return;

    refreshWalletTokenBalance();
    loadUserSettlements();
  }, [loadUserSettlements, refreshWalletTokenBalance, wallet.publicKey]);

  const refreshCurrentBank = useCallback(async () => {
    if (!wallet.publicKey) {
      setCurrentBank(null);
      return null;
    }

    try {
      const bank = await api.getBankByWallet(wallet.publicKey.toBase58());
      setCurrentBank(bank);
      setBankName(bank.name);
      setBankCurrency(bank.currency);
      setBankReserve(String(bank.fiatReserve));
      setBackendStatus("connected");
      return bank;
    } catch (err) {
      setCurrentBank(null);
      if (err.message !== "Bank not found") {
        toast(`Bank record unavailable: ${err.message}`, "error");
      }
      return null;
    }
  }, [toast, wallet.publicKey]);

  useEffect(() => {
    refreshCurrentBank();
  }, [refreshCurrentBank]);

  const refreshBankBalance = useCallback(async () => {
    if (!mintAddress || !wallet.publicKey) {
      setBankDktBalance(null);
      return;
    }

    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const info = await connection.getAccountInfo(ata);
      if (!info) {
        setBankDktBalance("0");
        return;
      }

      const bal = await connection.getTokenAccountBalance(ata);
      setBankDktBalance(bal.value.uiAmountString);
    } catch (err) {
      toast(err.message, "error");
    }
  }, [connection, mintAddress, toast, wallet.publicKey]);

  useEffect(() => {
    if (currentBank) {
      refreshBankBalance();
    }
  }, [currentBank, refreshBankBalance]);

  useEffect(() => {
    if (currentBank) {
      setBankTask("profile");
    }
  }, [currentBank?.id]);

  const loadBankSettlements = useCallback(async (bankId = currentBank?.id) => {
    if (!bankId) {
      setBankSettlements([]);
      return;
    }

    try {
      const settlements = await api.getSettlements({ bankId });
      setBankSettlements(settlements);
      setBackendStatus("connected");
    } catch (err) {
      setBackendStatus("offline");
      toast(`Settlement history unavailable: ${err.message}`, "error");
    }
  }, [currentBank?.id, toast]);

  const loadBankDirectory = useCallback(async () => {
    try {
      const banks = await api.getBanks();
      setBankDirectory(banks);
      setBackendStatus("connected");

      if (!mintAddress) {
        setBankTokenBalances({});
        return;
      }

      const mint = new PublicKey(mintAddress);
      const balances = {};
      await Promise.all(banks.map(async (bank) => {
        try {
          const owner = new PublicKey(bank.wallet);
          const ata = await getAssociatedTokenAddress(
            mint,
            owner,
            false,
            TOKEN_2022_PROGRAM_ID
          );
          const info = await connection.getAccountInfo(ata);
          if (!info) {
            balances[bank.id] = "0";
            return;
          }

          const bal = await connection.getTokenAccountBalance(ata);
          balances[bank.id] = bal.value.uiAmountString;
        } catch {
          balances[bank.id] = null;
        }
      }));
      setBankTokenBalances(balances);
    } catch (err) {
      setBackendStatus("offline");
      toast(`Bank directory unavailable: ${err.message}`, "error");
    }
  }, [connection, mintAddress, toast]);

  useEffect(() => {
    if (currentBank) {
      loadBankSettlements(currentBank.id);
    }
  }, [currentBank, loadBankSettlements]);

  useEffect(() => {
    if (tab === "bank") {
      loadBankDirectory();
    }
  }, [loadBankDirectory, tab]);

  const registerBank = async () => {
    if (!wallet.publicKey) {
      toast("Connect bank wallet first", "error");
      return;
    }

    setLoading(true);
    try {
      const bank = await api.createBank({
        name: bankName,
        wallet: wallet.publicKey.toBase58(),
        currency: bankCurrency,
        fiatReserve: Number(bankReserve),
      });
      setCurrentBank(bank);
      setBackendStatus("connected");
      loadBankDirectory();
      toast(`${bank.name} registered`);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const createBankMintRequest = async () => {
    if (!currentBank) {
      toast("Register this wallet as a bank first", "error");
      return;
    }
    if (!configPubkey) {
      toast("Initialize system first", "error");
      return;
    }
    if (!mintAddress) {
      toast("Admin must create the mint first", "error");
      return;
    }
    if (!bankMintAmount || isNaN(Number(bankMintAmount)) || Number(bankMintAmount) <= 0) {
      toast("Enter a valid mint amount", "error");
      return;
    }
    if (Number(bankMintAmount) > currentBank.fiatReserve) {
      toast("Mint amount cannot be greater than bank fiat reserve", "error");
      return;
    }

    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const requestKeypair = Keypair.generate();
      const mintAmount = Number(bankMintAmount);

      await program.methods.createMintRequest(new anchor.BN(mintAmount * 1e6))
        .accounts({
          request: requestKeypair.publicKey,
          config: configPubkey,
          maker: wallet.publicKey,
        })
        .signers([requestKeypair]).rpc();

      await waitForAccount(connection, requestKeypair.publicKey);

      const addr = requestKeypair.publicKey.toBase58();
      const savedRequest = await api.createMintRequest({
        requestAddr: addr,
        maker: wallet.publicKey.toBase58(),
        amount: mintAmount,
        bankId: currentBank.id,
      });

      setRequestAddress(addr);
      setRequestStatus("Pending");
      setBankMintAmount("");
      setBackendStatus("connected");
      setHistory((h) => [
        {
          backendId: savedRequest.id,
          addr,
          amount: savedRequest.amount,
          bank: savedRequest.bank,
          reserveSnapshot: savedRequest.reserveSnapshot,
          status: savedRequest.status,
          txSignature: null,
          ts: Date.now(),
          type: "Mint",
        },
        ...h,
      ]);
      toast("Bank mint request submitted for checker approval");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const registerConnectedWallet = async () => {
    if (!wallet.publicKey) {
      toast("Connect wallet first", "error");
      return;
    }

    setLoading(true);
    try {
      const user = await api.createUser({
        wallet: wallet.publicKey.toBase58(),
        role: selectedRole,
      });
      setCurrentUser(user);
      setBackendStatus("connected");
      toast(`Wallet registered as ${user.role}`);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const createTokenTransferSettlement = async (recipientKey, transferAmount, recipientRegistered) => {
    const program = getProgram(wallet, connection);
    const mint = new PublicKey(mintAddress);
    const fromATA = await getOrCreateATA(connection, wallet, mint, wallet.publicKey);
    const toATA = await getOrCreateATA(connection, wallet, mint, recipientKey);

    const txSignature = await program.methods.transferTokens(new anchor.BN(transferAmount * 1e6))
      .accounts({
        fromTokenAccount: fromATA,
        toTokenAccount: toATA,
        mint,
        sender: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    return api.createSettlement({
      bankId: currentBank.id,
      senderWallet: wallet.publicKey.toBase58(),
      recipientWallet: recipientKey.toBase58(),
      recipientRegistered,
      settlementType: "TOKEN",
      amount: transferAmount,
      txSignature,
    });
  };

  const createFiatFallbackSettlement = async (recipientKey, transferAmount, payoutDetails = {}) => {
    const program = getProgram(wallet, connection);
    const mint = new PublicKey(mintAddress);
    const ata = await getOrCreateATA(connection, wallet, mint, wallet.publicKey);
    const receiverAccount = payoutDetails.receiverAccount || fiatReceiverAccount;
    const productType = payoutDetails.productType || fiatProductType;

    const txSignature = await program.methods.burnTokens(new anchor.BN(transferAmount * 1e6))
      .accounts({
        mint,
        userTokenAccount: ata,
        user: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    return api.createUnregisteredFiatSettlement({
      bankId: currentBank.id,
      senderWallet: wallet.publicKey.toBase58(),
      recipientWallet: recipientKey.toBase58(),
      amount: transferAmount,
      burnTxSignature: txSignature,
      receiverAccount,
      productType,
    });
  };

  const checkBankRecipient = async () => {
    if (!bankRecipient) {
      toast("Enter recipient wallet first", "error");
      return null;
    }

    let recipientKey;
    try {
      recipientKey = new PublicKey(bankRecipient.trim());
    } catch {
      setBankRecipientStatus({ type: "invalid", message: "Invalid wallet address" });
      toast("Invalid recipient public key", "error");
      return null;
    }

    try {
      const user = await api.getUserByWallet(recipientKey.toBase58());
      const status = {
        type: "registered",
        message: `Registered user: ${user.role}`,
        user,
        wallet: recipientKey.toBase58(),
      };
      setBankRecipientStatus(status);
      return status;
    } catch {
      const status = {
        type: "unregistered",
        message: "Not registered: sending will burn DKT and use CBS + bank payout",
        user: null,
        wallet: recipientKey.toBase58(),
      };
      setBankRecipientStatus(status);
      return status;
    }
  };

  const checkCbsReceiverAccount = async ({ manageLoading = true } = {}) => {
    const accountNo = fiatReceiverAccount.trim();
    const productType = fiatProductType.trim() || "LCY_ACC";

    if (!/^\d{12}$/.test(accountNo)) {
      const status = { type: "invalid", message: "CBS account must be 12 digits" };
      setCbsAccountStatus(status);
      toast(status.message, "error");
      return status;
    }

    if (manageLoading) setLoading(true);
    try {
      const cbsResult = await api.inquireCbsAccount({ accountNo, productType });
      const accountStatus = getCbsAccountStatus(cbsResult);
      const accountInfo = getCbsAccountInfo(cbsResult);
      const balanceInfo = getCbsBalanceInfo(cbsResult);
      const transferLimit = getCbsTransferLimit(cbsResult);
      const metaInfo = getCbsMetaInfo(cbsResult);
      const canReceive = isCbsAccountReceivable(cbsResult);
      const status = {
        type: canReceive ? "valid" : "invalid",
        message: canReceive
          ? `CBS verified${accountInfo.account_name ? `: ${accountInfo.account_name}` : ""}`
          : accountStatus.acc_status_details || "CBS account cannot receive transfer",
        data: cbsResult,
        accountInfo,
        accountStatus,
        balanceInfo,
        transferLimit,
        metaInfo,
        accountNo,
        productType,
      };
      setCbsAccountStatus(status);
      toast(status.message, canReceive ? "success" : "error");
      return status;
    } catch (err) {
      const status = { type: "invalid", message: err.message };
      setCbsAccountStatus(status);
      toast(err.message, "error");
      return status;
    } finally {
      if (manageLoading) setLoading(false);
    }
  };

  const refreshUserFiatAccount = async () => {
    if (!latestUserFiatSettlement?.receiverAccount) {
      toast("No FIAT receiver account found for this wallet", "error");
      return;
    }

    setLoading(true);
    try {
      const productType = latestUserFiatSettlement.cbsProductType || "LCY_ACC";
      const cbsResult = await api.inquireCbsAccount({
        accountNo: latestUserFiatSettlement.receiverAccount,
        productType,
      });
      setUserFiatAccountStatus({
        data: cbsResult,
        productType,
        accountInfo: getCbsAccountInfo(cbsResult),
        accountStatus: getCbsAccountStatus(cbsResult),
        balanceInfo: getCbsBalanceInfo(cbsResult),
        transferLimit: getCbsTransferLimit(cbsResult),
        metaInfo: getCbsMetaInfo(cbsResult),
      });
      toast("Receiver CBS account refreshed");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const finalizeBankSettlement = async (settlement, recipientKey, transferAmount) => {
    setBankSettlements((items) => [settlement, ...items]);

    setHistory((h) => [
      {
        addr: recipientKey.toBase58(),
        amount: transferAmount,
        status: settlement.settlementType === "TOKEN" ? "Sent" : "Burned",
        ts: Date.now(),
        type: settlement.settlementType === "TOKEN" ? "Transfer" : "Burn",
      },
      ...h,
    ]);

    setBankRecipient("");
    setBankTransferAmount("");
    setBankRecipientStatus(null);
    setFiatReceiverAccount("");
    setFiatProductType("LCY_ACC");
    setCbsAccountStatus(null);
    setFiatPayoutConfirm(null);
    await refreshCurrentBank();
    await loadBankSettlements(currentBank.id);
    await loadBankDirectory();
    refreshBankBalance();
    toast(
      settlement.settlementType === "TOKEN"
        ? `Registered user received ${transferAmount} DKT`
        : `Fiat payout queued: ${settlement.bankTransactionId || settlement.bankReference || settlement.id}`
    );
  };

  const confirmFiatPayout = async () => {
    if (!fiatPayoutConfirm) return;

    setLoading(true);
    try {
      const recipientKey = new PublicKey(fiatPayoutConfirm.recipientWallet);
      const settlement = await createFiatFallbackSettlement(
        recipientKey,
        fiatPayoutConfirm.transferAmount,
        fiatPayoutConfirm
      );
      await finalizeBankSettlement(settlement, recipientKey, fiatPayoutConfirm.transferAmount);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const sendFromBank = async () => {
    if (!currentBank) { toast("Register this wallet as a bank first", "error"); return; }
    if (!mintAddress) { toast("No mint configured", "error"); return; }
    if (!bankRecipient || !bankTransferAmount) { toast("Fill recipient and amount", "error"); return; }
    if (!Number.isFinite(Number(bankTransferAmount)) || Number(bankTransferAmount) <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }

    let recipientKey;
    try {
      recipientKey = new PublicKey(bankRecipient.trim());
    } catch {
      toast("Invalid recipient public key", "error");
      return;
    }

    setLoading(true);
    try {
      const transferAmount = Number(bankTransferAmount);
      let registeredUser = null;

      const recipientStatus = await checkBankRecipient();
      if (!recipientStatus || recipientStatus.type === "invalid") {
        setLoading(false);
        return;
      }

      registeredUser = recipientStatus.user;

      if (!registeredUser) {
        if (!/^\d{12}$/.test(fiatReceiverAccount.trim())) {
          toast("Receiver bank account must be 12 digits", "error");
          setLoading(false);
          return;
        }

        const cbsStatus = cbsAccountStatus?.type === "valid" && cbsAccountStatus.accountNo === fiatReceiverAccount.trim()
          ? cbsAccountStatus
          : await checkCbsReceiverAccount({ manageLoading: false });

        if (cbsStatus.type !== "valid") {
          setLoading(false);
          return;
        }

        setFiatPayoutConfirm({
          transferAmount,
          recipientWallet: recipientKey.toBase58(),
          receiverAccount: fiatReceiverAccount.trim(),
          productType: fiatProductType.trim() || "LCY_ACC",
          bankName: currentBank.name,
          currency: currentBank.currency,
          accountName: cbsStatus.accountInfo?.account_name || "—",
          availableBalance: cbsStatus.balanceInfo?.btn_available_balance || null,
          inquiryId: cbsStatus.metaInfo?.inquiry_id || null,
        });
        setLoading(false);
        return;
      }

      const settlement = registeredUser
        ? await createTokenTransferSettlement(recipientKey, transferAmount, true)
        : await createFiatFallbackSettlement(recipientKey, transferAmount);
      await finalizeBankSettlement(settlement, recipientKey, transferAmount);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const refreshFiatSettlementStatus = async (settlementId) => {
    setLoading(true);
    try {
      const updated = await api.refreshSettlementStatus(settlementId);
      setBankSettlements((items) => (
        items.map((item) => (item.id === settlementId ? updated : item))
      ));
      setUserSettlements((items) => (
        items.map((item) => (item.id === settlementId ? updated : item))
      ));
      toast(`Bank status updated: ${updated.bankApiStatus || updated.status}`);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  const copy = (text, label = "Address") => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard`);
  };

  const addChecker = () => {
    if (!checkerInput.trim()) return;
    try {
      const pk = new PublicKey(checkerInput.trim());
      if (checkers.some((c) => c.toBase58() === pk.toBase58())) {
        toast("Checker already added", "error"); return;
      }
      setCheckers([...checkers, pk]);
      setCheckerInput("");
      toast("Checker added");
    } catch { toast("Invalid public key", "error"); }
  };

  /* ── initialize ── */
  const initialize = async () => {
    if (!wallet.connected) { toast("Connect wallet first", "error"); return; }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const configKeypair = Keypair.generate();
      const checkerPubkeys = [...checkers];
      if (!checkerPubkeys.some((c) => c.toBase58() === wallet.publicKey.toBase58()))
        checkerPubkeys.push(wallet.publicKey);
      await program.methods.initialize(checkerPubkeys)
        .accounts({ config: configKeypair.publicKey, admin: wallet.publicKey })
        .signers([configKeypair]).rpc();
      const newConfigAddress = configKeypair.publicKey.toBase58();
      const checkerAddrs = checkerPubkeys.map((checker) => checker.toBase58());
      setConfigAddress(newConfigAddress);
      setConfigPubkey(configKeypair.publicKey);
      setOnChainConfig({
        adminAddr: wallet.publicKey.toBase58(),
        configAddr: newConfigAddress,
        mintAddr: null,
        checkers: checkerAddrs,
      });
      await api.updateTokenConfig({
        adminAddr: wallet.publicKey.toBase58(),
        configAddr: newConfigAddress,
        checkers: checkerAddrs,
      });
      setBackendStatus("connected");
      toast("System initialized!");
    } catch (err) { toast(err.message, "error"); }
    setLoading(false);
  };

  /* ── metadata ── */
  const createTokenMetadata = async (mintPub) => {
    try {
      const mint = mintPub instanceof PublicKey ? mintPub : new PublicKey(mintPub);
      const NAME = "DK Token"; const SYMBOL = "DKT";
      const URI = "https://gateway.pinata.cloud/ipfs/bafkreifs63vvjazrnabs653zx3cmmqwewy3ndo3urxsue3ag2e3ajdmbry";
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METADATA_PROGRAM_ID
      );
      const instruction = createCreateMetadataAccountV3Instruction(
        { metadata: metadataPDA, mint, mintAuthority: wallet.publicKey, payer: wallet.publicKey, updateAuthority: wallet.publicKey },
        { createMetadataAccountArgsV3: { data: { name: NAME, symbol: SYMBOL, uri: URI, sellerFeeBasisPoints: 0, creators: null, collection: null, uses: null }, isMutable: true, collectionDetails: null } }
      );
      const tx = new Transaction().add(instruction);
      await sendAndConfirm(connection, wallet, tx);
    } catch (err) {
      toast("Mint created but metadata failed: " + err.message, "error");
    }
  };

  /**
   * FIX: createMint now waits for the mint account to be visible on-chain
   * before proceeding to metadata creation. Previously, metadata could fire
   * before the mint account was propagated → intermittent failures.
   */
  const createMint = async () => {
    if (!configPubkey) { toast("Initialize first", "error"); return; }
    if (onChainConfig && wallet.publicKey?.toBase58() !== onChainConfig.adminAddr) {
      toast("Only the on-chain admin can create the mint", "error");
      return;
    }
    setIsCreatingMint(true);
    try {
      const program = getProgram(wallet, connection);
      const mintKeypair = Keypair.generate();

      await program.methods.createMint()
        .accounts({
          config: configPubkey,
          mint: mintKeypair.publicKey,
          admin: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([mintKeypair]).rpc();

      // ← FIX: wait for mint account to land on-chain before using it
      await waitForAccount(connection, mintKeypair.publicKey);

      setMintPubkey(mintKeypair.publicKey);
      setMintAddress(mintKeypair.publicKey.toBase58());
      const updatedConfig = {
        ...(onChainConfig || {}),
        adminAddr: onChainConfig?.adminAddr || wallet.publicKey.toBase58(),
        configAddr: configPubkey.toBase58(),
        mintAddr: mintKeypair.publicKey.toBase58(),
        checkers: onChainConfig?.checkers || checkers.map((checker) => checker.toBase58()),
      };
      setOnChainConfig(updatedConfig);
      await api.updateTokenConfig({
        ...updatedConfig,
      });
      setBackendStatus("connected");

      await createTokenMetadata(mintKeypair.publicKey);
      toast("Mint + metadata created!");
    } catch (err) {
      toast(err.message, "error");
    }
    setIsCreatingMint(false);
  };

  /**
   * FIX: createMintRequest now also waits for the request account to land
   * before updating state. This prevents stale reads in approveRequest.
   */
  const createMintRequest = async () => {
    if (!configPubkey) { toast("Initialize system first", "error"); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast("Enter a valid amount", "error"); return; }
    if (!wallet.publicKey) { toast("Connect wallet first", "error"); return; }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const requestKeypair = Keypair.generate();

      await program.methods.createMintRequest(new anchor.BN(Number(amount) * 1e6))
        .accounts({
          request: requestKeypair.publicKey,
          config: configPubkey,
          maker: wallet.publicKey,
        })
        .signers([requestKeypair]).rpc();

      // ← FIX: wait until request account is confirmed on-chain
      await waitForAccount(connection, requestKeypair.publicKey);

      const addr = requestKeypair.publicKey.toBase58();
      let savedRequest = null;

      try {
        savedRequest = await api.createMintRequest({
          requestAddr: addr,
          maker: wallet.publicKey.toBase58(),
          amount: Number(amount),
          bankId: currentBank?.id,
        });
        setBackendStatus("connected");
      } catch (err) {
        setBackendStatus("offline");
        toast(`On-chain request created, but backend save failed: ${err.message}`, "error");
      }

      setRequestAddress(addr);
      setRequestStatus("Pending");
      setHistory((h) => [
        {
          backendId: savedRequest?.id,
          addr,
          amount: Number(amount),
          bank: savedRequest?.bank,
          reserveSnapshot: savedRequest?.reserveSnapshot,
          status: "Pending",
          txSignature: null,
          ts: Date.now(),
          type: "Mint",
        },
        ...h,
      ]);
      toast("Mint request submitted");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  /**
   * FIX: approveRequest uses the fixed getOrCreateATA (which now waits for
   * the ATA to be confirmed before returning). This eliminates the most common
   * cause of needing to click multiple times — the ATA didn't exist yet when
   * approveRequest first ran.
   */
  const approveRequest = async (targetAddress = requestAddress) => {
    if (!targetAddress) { toast("No request to approve", "error"); return; }
    if (!onChainConfig?.checkers.includes(wallet.publicKey?.toBase58())) {
      toast("This wallet is not an on-chain checker", "error");
      return;
    }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const mint = new PublicKey(mintAddress);
      const requestPubkey = new PublicKey(targetAddress);

      // Fetch the request account (it's confirmed now, so this is safe)
      const requestAccount = await program.account.mintRequest.fetch(requestPubkey);

      if (requestAccount.maker.toBase58() === wallet.publicKey.toBase58()) {
        toast("Maker cannot approve their own request", "error");
        setLoading(false);
        return;
      }

      // ← FIX: getOrCreateATA now blocks until ATA is confirmed
      const makerATA = await getOrCreateATA(connection, wallet, mint, requestAccount.maker);

      const txSignature = await program.methods.approveRequest()
        .accounts({
          request: requestPubkey,
          config: configPubkey,
          mint,
          makerTokenAccount: makerATA,
          checker: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const historyItem = history.find((item) => item.addr === targetAddress);
      if (historyItem?.backendId) {
        try {
          await api.approveMintRequest(historyItem.backendId, txSignature);
          setBackendStatus("connected");
        } catch (err) {
          setBackendStatus("offline");
          toast(`On-chain approval succeeded, but backend update failed: ${err.message}`, "error");
        }
      }

      setRequestAddress(targetAddress);
      setRequestStatus("Approved");
      setHistory((h) =>
        h.map((e) => (e.addr === targetAddress ? { ...e, status: "Approved", txSignature } : e))
      );
      toast("Request approved — tokens minted!");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  /* ── reject ── */
  const rejectRequest = async (targetAddress = requestAddress) => {
    if (!targetAddress) { toast("No request to reject", "error"); return; }
    if (!onChainConfig?.checkers.includes(wallet.publicKey?.toBase58())) {
      toast("This wallet is not an on-chain checker", "error");
      return;
    }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const txSignature = await program.methods.rejectRequest()
        .accounts({
          request: new PublicKey(targetAddress),
          config: configPubkey,
          checker: wallet.publicKey,
        })
        .rpc();

      const historyItem = history.find((item) => item.addr === targetAddress);
      if (historyItem?.backendId) {
        try {
          await api.rejectMintRequest(historyItem.backendId, txSignature);
          setBackendStatus("connected");
        } catch (err) {
          setBackendStatus("offline");
          toast(`On-chain rejection succeeded, but backend update failed: ${err.message}`, "error");
        }
      }

      setRequestAddress(targetAddress);
      setRequestStatus("Rejected");
      setHistory((h) =>
        h.map((e) => (e.addr === targetAddress ? { ...e, status: "Rejected", txSignature } : e))
      );
      toast("Request rejected");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  /**
   * FIX: transferTokens uses the fixed getOrCreateATA for both from/to ATAs.
   */
  const transferTokens = async () => {
    if (!mintAddress) { toast("No mint configured", "error"); return; }
    if (!transferTo || !transferAmt) { toast("Fill in recipient and amount", "error"); return; }
    let recipientKey;
    try { recipientKey = new PublicKey(transferTo.trim()); }
    catch { toast("Invalid recipient public key", "error"); return; }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const mint = new PublicKey(mintAddress);

      // Both ATAs confirmed before proceeding
      const fromATA = await getOrCreateATA(connection, wallet, mint, wallet.publicKey);
      const toATA = await getOrCreateATA(connection, wallet, mint, recipientKey);

      await program.methods.transferTokens(new anchor.BN(Number(transferAmt) * 1e6))
        .accounts({
          fromTokenAccount: fromATA,
          toTokenAccount: toATA,
          mint,
          sender: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      setHistory((h) => [
        { addr: recipientKey.toBase58(), amount: Number(transferAmt), status: "Sent", ts: Date.now(), type: "Transfer" },
        ...h,
      ]);
      setTransferTo(""); setTransferAmt("");
      toast(`Transferred ${transferAmt} DKT → ${shorten(recipientKey.toBase58())}`);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  /* ── burn ── */
  const burnTokens = async () => {
    if (!mintAddress) { toast("No mint configured", "error"); return; }
    if (!burnAmt || isNaN(Number(burnAmt)) || Number(burnAmt) <= 0) { toast("Enter a valid amount", "error"); return; }
    setLoading(true);
    try {
      const program = getProgram(wallet, connection);
      const mint = new PublicKey(mintAddress);
      const ata = await getOrCreateATA(connection, wallet, mint, wallet.publicKey);

      await program.methods.burnTokens(new anchor.BN(Number(burnAmt) * 1e6))
        .accounts({
          mint,
          userTokenAccount: ata,
          user: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      setHistory((h) => [
        { addr: wallet.publicKey.toBase58(), amount: Number(burnAmt), status: "Burned", ts: Date.now(), type: "Burn" },
        ...h,
      ]);
      setBurnAmt("");
      toast(`Burned ${burnAmt} DKT`);
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };

  /* ── balance ── */
  const checkBalance = async () => {
    if (!mintAddress || !wallet.publicKey) { toast("Connect wallet + create mint first", "error"); return; }
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const info = await connection.getAccountInfo(ata);
      if (!info) { setBalance("0"); return; }
      const bal = await connection.getTokenAccountBalance(ata);
      setBalance(bal.value.uiAmountString);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  /* ── derived ── */
  const step1Done = !!configAddress;
  const step2Done = !!mintAddress;
  const pendingCount = history.filter((h) => h.status === "Pending").length;
  const walletAddress = wallet.publicKey?.toBase58();
  const canCreateMintRequest = !!walletAddress;
  const canReviewMintRequest = !!walletAddress && !!onChainConfig?.checkers.includes(walletAddress);
  const isOnChainAdmin = !!walletAddress && onChainConfig?.adminAddr === walletAddress;
  const authorityRole = isOnChainAdmin ? "Admin" : canReviewMintRequest ? "Checker" : walletAddress ? "Maker" : "Disconnected";
  const connectedDktBalance = currentBank
    ? bankDktBalance
    : currentUser
      ? userDktBalance
      : balance;
  const currentBankDktAmount = parseAmount(bankDktBalance);
  const currentBankBtnAmount = parseAmount(currentBank?.fiatReserve);
  const currentBankSendCapacity = currentBank
    ? Math.min(currentBankDktAmount, currentBankBtnAmount)
    : 0;
  const userFiatSettlements = userSettlements.filter((settlement) => settlement.settlementType === "FIAT");
  const userTokenSettlements = userSettlements.filter((settlement) => settlement.settlementType === "TOKEN");
  const userFiatReceived = userFiatSettlements.reduce((total, settlement) => total + parseAmount(settlement.amount), 0);
  const userTokenReceived = userTokenSettlements.reduce((total, settlement) => total + parseAmount(settlement.amount), 0);
  const latestUserFiatSettlement = userFiatSettlements[0] || null;
  const pendingReviewItems = history.filter((h) => h.type === "Mint" && h.status === "Pending");
  const bankHistory = currentBank
    ? history.filter((h) => h.type === "Mint" && h.bank?.id === currentBank.id)
    : [];
  const reserveAfterMint =
    currentBank && bankMintAmount && !isNaN(Number(bankMintAmount))
      ? currentBank.fiatReserve - Number(bankMintAmount)
      : null;
  const flowSteps = [
    {
      title: "Initialize",
      desc: "Admin creates Config and checker list",
      state: step1Done ? "done" : "active",
      stateText: step1Done ? "Ready" : "Start here",
    },
    {
      title: "Create Mint",
      desc: "Only Config admin creates DKT mint",
      state: step2Done ? "done" : step1Done ? "active" : "locked",
      stateText: step2Done ? "Ready" : step1Done ? "Admin action" : "Locked",
    },
    {
      title: "Mint Request",
      desc: "Maker submits amount for approval",
      state: pendingCount > 0 ? "active" : step2Done ? "ready" : "locked",
      stateText: pendingCount > 0 ? `${pendingCount} pending` : step2Done ? "Open" : "Locked",
    },
    {
      title: "Review",
      desc: "On-chain checker approves or rejects",
      state: pendingReviewItems.length > 0 ? "active" : "ready",
      stateText: pendingReviewItems.length > 0 ? "Needs checker" : "Clear",
    },
  ];
  const systemHealthItems = [
    {
      label: "Backend",
      value: backendStatus === "connected" ? "API connected" : backendStatus,
      state: backendStatus === "connected" ? "ok" : backendStatus === "checking" ? "warn" : "bad",
      stateText: backendStatus === "connected" ? "Ready" : backendStatus === "checking" ? "Checking" : "Offline",
      action: loadTokenConfig,
    },
    {
      label: "Wallet",
      value: walletAddress ? shorten(walletAddress) : "Connect Phantom",
      state: walletAddress ? "ok" : "warn",
      stateText: walletAddress ? "Connected" : "Needed",
      action: null,
    },
    {
      label: "Mint",
      value: mintAddress ? shorten(mintAddress) : "Not configured",
      state: mintAddress ? "ok" : "warn",
      stateText: mintAddress ? "Ready" : "Setup",
      action: () => setTab("setup"),
    },
    {
      label: "Bank",
      value: currentBank ? `${currentBank.name} · ${formatAmount(currentBankSendCapacity)} sendable` : "Register bank",
      state: currentBank ? "ok" : "warn",
      stateText: currentBank ? "Ready" : "Needed",
      action: () => setTab("bank"),
    },
    {
      label: "User",
      value: currentUser ? currentUser.role : "Optional receiver",
      state: currentUser ? "ok" : "warn",
      stateText: currentUser ? "Registered" : "Open",
      action: () => setTab("user"),
    },
    {
      label: "CBS",
      value: cbsTestAccounts.length ? `${cbsTestAccounts.length} test accounts` : "No test accounts",
      state: cbsTestAccounts.length ? "ok" : "warn",
      stateText: cbsTestAccounts.length ? "Loaded" : "Check env",
      action: () => { setTab("bank"); setBankTask("send"); },
    },
  ];
  const demoChecklistItems = [
    {
      label: "Backend API",
      detail: backendStatus === "connected" ? "Routes and token config are reachable." : "Start dk-backend and refresh.",
      done: backendStatus === "connected",
    },
    {
      label: "Wallet and mint",
      detail: walletAddress && mintAddress ? "Phantom is connected and DKT mint is configured." : "Connect Phantom and finish Setup.",
      done: !!walletAddress && !!mintAddress,
    },
    {
      label: "Bank capacity",
      detail: currentBank ? `${formatAmount(currentBankDktAmount)} DKT and ${formatAmount(currentBankBtnAmount)} ${currentBank.currency} reserve.` : "Register a bank wallet.",
      done: !!currentBank && currentBankSendCapacity > 0,
    },
    {
      label: "CBS payout path",
      detail: cbsTestAccounts.length ? "CBS test accounts are loaded for unregistered FIAT payout." : "Check /cbs/test-accounts or backend env.",
      done: cbsTestAccounts.length > 0,
    },
    {
      label: "Audit trail",
      detail: bankSettlements.length || userSettlements.length ? "Settlement history has records to review." : "Run a registered or unregistered send to create history.",
      done: bankSettlements.length > 0 || userSettlements.length > 0,
    },
  ];

  const pipelineItems = history.slice(0, 4).map((h) => ({
    id: `#${h.type.slice(0, 2).toUpperCase()}-${h.addr.slice(-4).toUpperCase()}`,
    type: h.type,
    amount: h.amount,
    status: h.status,
    checkers:
      h.status === "Approved" || h.status === "Sent"
        ? [{ label: "Checker 1", done: true }, { label: "Checker 2", done: true }]
        : h.status === "Rejected"
          ? [{ label: "Checker 1", done: false, active: false }, { label: "Checker 2", done: false }]
          : [{ label: "Checker 1", done: false, active: true }, { label: "Checker 2", done: false }],
    progress: h.status === "Approved" || h.status === "Sent" ? 100 : h.status === "Rejected" ? 0 : 40,
    statusText:
      h.status === "Approved" ? `Completed · sig: ${h.addr.slice(-6)}…`
        : h.status === "Rejected" ? "Rejected by checker"
          : "Awaiting checker approval",
    addr: h.addr,
  }));

  /* ══════════════════
     RENDER — unchanged
  ══════════════════ */
  return (
    <div className="portal">
      <Toast toasts={toasts} />
      {fiatPayoutConfirm && (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="fiat-confirm-title">
            <div className="card-title">FIAT Payout Review</div>
            <div className="section-heading" id="fiat-confirm-title">Confirm burn and bank payout</div>
            <p className="card-desc">
              This receiver wallet is not registered, so the bank will burn DKT and send equivalent BTN through CBS/DKPG.
            </p>
            <div className="confirm-grid">
              <div className="bank-metric">
                <span>Burn Amount</span>
                <strong>{formatAmount(fiatPayoutConfirm.transferAmount)} DKT</strong>
              </div>
              <div className="bank-metric">
                <span>FIAT Payout</span>
                <strong>{formatAmount(fiatPayoutConfirm.transferAmount)} {fiatPayoutConfirm.currency}</strong>
              </div>
              <div className="bank-metric">
                <span>Receiver Wallet</span>
                <strong>{shorten(fiatPayoutConfirm.recipientWallet)}</strong>
              </div>
              <div className="bank-metric">
                <span>CBS Account</span>
                <strong>{fiatPayoutConfirm.receiverAccount}</strong>
              </div>
              <div className="bank-metric">
                <span>Product Type</span>
                <strong>{fiatPayoutConfirm.productType}</strong>
              </div>
              <div className="bank-metric">
                <span>Account Name</span>
                <strong>{fiatPayoutConfirm.accountName}</strong>
              </div>
              <div className="bank-metric">
                <span>Available Balance</span>
                <strong>
                  {fiatPayoutConfirm.availableBalance
                    ? `${formatAmount(fiatPayoutConfirm.availableBalance)} ${fiatPayoutConfirm.currency}`
                    : "—"}
                </strong>
              </div>
            </div>
            {fiatPayoutConfirm.inquiryId && (
              <div className="confirm-note">
                CBS inquiry verified: {fiatPayoutConfirm.inquiryId}
              </div>
            )}
            <div className="confirm-actions">
              <button className="btn" onClick={() => setFiatPayoutConfirm(null)} disabled={loading}>
                Cancel
              </button>
              <button className="btn btn-accent" onClick={confirmFiatPayout} disabled={loading}>
                {loading ? "Processing…" : "Confirm Burn And Payout"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="header">
        <div>
          <div className="logo-row">
            <div className="logo-mark">DK</div>
            <div>
              <div className="portal-title">Token Admin Portal</div>
              <div className="portal-sub">
                solana · token-2022 · devnet · backend {backendStatus}
                {currentUser ? ` · ${currentUser.role}` : ""}
              </div>
            </div>
          </div>
        </div>
        <WalletMultiButton />
      </div>

      <div className="stats-bar">
        <StatCard label="Wallet DKT" value={connectedDktBalance !== null ? `${Number(connectedDktBalance).toLocaleString()}` : "—"} sub1="Phantom token balance" sub2={walletAddress ? shorten(walletAddress) : "connect wallet"} accent="val-accent" />
        <StatCard label="Bank BTN" value={currentBank ? `${formatAmount(currentBank.fiatReserve)}` : "—"} sub1="backend fiat reserve" sub2={currentBank ? currentBank.currency : "register bank"} accent="val-green" />
        <StatCard label="Pending Approvals" value={pendingCount} sub1="awaiting checker" sub2={`${history.filter(h => h.type === "Mint" && h.status === "Pending").length} mint · ${history.filter(h => h.type === "Burn" && h.status === "Pending").length} burn`} accent="val-amber" />
        <StatCard label="Transactions" value={history.length} sub1="all operations" sub2="this session" accent="val-white" />
      </div>

      <RoleWorkspace
        authorityRole={authorityRole}
        backendRole={currentUser?.role}
        backendStatus={backendStatus}
        onChainConfig={onChainConfig}
        onSetup={() => setTab("setup")}
      />

      <SystemHealthPanel items={systemHealthItems} />

      <div className="tab-nav">
        {[
          { id: "dashboard", label: "Flow" },
          { id: "bank", label: "Bank" },
          { id: "user", label: "User" },
          { id: "mint", label: "Maker" },
          { id: "transfer", label: "Transfer" },
          { id: "burn", label: "Burn" },
          { id: "setup", label: "Setup" },
          { id: "history", label: history.length ? `History (${history.length})` : "History" },
        ].map(({ id, label }) => (
          <button key={id} className={`tab-btn ${tab === id ? "tab-active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <FlowGuide steps={flowSteps} />

          <div className="workbench-grid">
            <FlowActionCard
              title="System Setup"
              label="Admin"
              status={step1Done ? "Configured" : "Open Setup"}
              action={() => setTab("setup")}
              disabled={false}
            >
              Creates the on-chain Config account, records the admin wallet, and stores the checker list.
            </FlowActionCard>

            <FlowActionCard
              title="Bank Portal"
              label="Reserve Holder"
              status={step2Done ? "Open Bank" : "Mint Required"}
              action={() => setTab("bank")}
              disabled={!step2Done}
            >
              A registered bank holds fiat reserve, requests DKT minting, and receives tokens after checker approval.
            </FlowActionCard>

            <FlowActionCard
              title="Maker Mint Request"
              label="Maker"
              status={step2Done ? "Create Request" : "Mint Required"}
              action={() => setTab("mint")}
              disabled={!step2Done}
            >
              Any connected maker wallet can request DKT. The request stays pending until a checker reviews it.
            </FlowActionCard>
          </div>

          <CheckerQueue
            items={pendingReviewItems}
            canReviewMintRequest={canReviewMintRequest}
            loading={loading}
            onApprove={approveRequest}
            onReject={rejectRequest}
            onOpenSetup={() => setTab("setup")}
          />

          <DemoChecklist items={demoChecklistItems} />

          <div className="dashboard-grid">
            <div className="card">
              <div className="card-title">Recent Transactions</div>
              {history.length === 0 ? (
                <div className="empty-state">No transactions yet</div>
              ) : (
                <div className="tx-list">
                  {history.slice(0, 6).map((h, i) => (
                    <div className="tx-row" key={i}>
                      <span className={`tx-type-pill type-${h.type.toLowerCase()}`}>{h.type}</span>
                      <span className="tx-addr">{shorten(h.addr)}</span>
                      <span className={`tx-amount ${h.type === "Mint" ? "amt-pos" : h.type === "Burn" ? "amt-neg" : "amt-neu"}`}>
                        {h.type === "Mint" ? "+" : h.type === "Burn" ? "−" : "→"}{h.amount.toLocaleString()}
                      </span>
                      <StatusBadge status={h.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Maker-Checker Pipeline</div>
              {pipelineItems.length === 0 ? (
                <div className="empty-state">No requests in pipeline</div>
              ) : (
                <div className="pipeline-list">
                  {pipelineItems.map((p, i) => (
                    <PipelineItem key={i} {...p}
                      onApprove={p.addr === requestAddress && canReviewMintRequest ? approveRequest : null}
                      onReject={p.addr === requestAddress && canReviewMintRequest ? rejectRequest : null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "bank" && (
        <>
          <div className="card bank-hero-card">
            <div className="card-title">Bank Portal</div>
            <div className="section-heading">Reserve-backed minting desk</div>
            <p className="card-desc">
              A bank wallet registers its fiat reserve, submits a mint request, and waits for the on-chain checker to approve before DKT reaches the bank wallet.
            </p>

            {!wallet.publicKey && (
              <div className="permission-note">
                Connect the bank wallet first. The connected wallet becomes the bank's token wallet.
              </div>
            )}

            {wallet.publicKey && !currentBank && (
              <div className="bank-form-grid">
                <div>
                  <div className="addr-label">Bank Name</div>
                  <input className="input" placeholder="Example Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div>
                  <div className="addr-label">Currency</div>
                  <input className="input" placeholder="BTN" value={bankCurrency} onChange={(e) => setBankCurrency(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <div className="addr-label">Fiat Reserve</div>
                  <input className="input" type="number" placeholder="0" value={bankReserve} onChange={(e) => setBankReserve(e.target.value)} />
                </div>
                <div>
                  <div className="addr-label">Bank Wallet</div>
                  <div className="addr-card">
                    <span className="addr-mono">{shorten(wallet.publicKey.toBase58())}</span>
                    <button className="btn btn-sm" onClick={() => copy(wallet.publicKey.toBase58(), "Bank wallet")}>Copy</button>
                  </div>
                </div>
                <button className="btn btn-accent bank-register-btn" onClick={registerBank} disabled={loading || !bankName || !bankReserve}>
                  {loading ? "Registering…" : "Register Bank"}
                </button>
              </div>
            )}

            {currentBank && (
              <>
                <div className="bank-metric-grid">
                  <div className="bank-metric">
                    <span>Bank</span>
                    <strong>{currentBank.name}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Fiat Reserve</span>
                    <strong>{formatAmount(currentBank.fiatReserve)} {currentBank.currency}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>DKT Balance</span>
                    <strong>{bankDktBalance !== null ? `${bankDktBalance} DKT` : "—"}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Status</span>
                    <strong>{currentBank.status}</strong>
                  </div>
                </div>
                <div className="bank-wallet-row">
                  <div>
                    <div className="addr-label">Bank Wallet</div>
                    <div className="addr-mono">{shorten(currentBank.wallet)}</div>
                  </div>
                  <div className="bank-transfer-actions">
                    <button className="btn" onClick={refreshCurrentBank}>Refresh Bank Record</button>
                    <button className="btn" onClick={refreshBankBalance}>Refresh Token Balance</button>
                  </div>
                </div>
                <div className="task-nav">
                  {[
                    { id: "profile", label: "Profile" },
                    { id: "mint", label: "Mint Request" },
                    { id: "payout", label: "Send Payout" },
                    { id: "history", label: "History" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      className={`task-btn ${bankTask === item.id ? "task-active" : ""}`}
                      onClick={() => setBankTask(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {currentBank && bankTask === "profile" && (
            <>
              <div className="card">
                <div className="card-title">Bank Details</div>
                <div className="bank-detail-grid">
                  <div className="bank-detail-main">
                    <div className="section-heading">{currentBank.name}</div>
                    <div className="addr-label">Bank Wallet</div>
                    <div className="addr-card">
                      <span className="addr-mono">{currentBank.wallet}</span>
                      <button className="btn btn-sm" onClick={() => copy(currentBank.wallet, "Bank wallet")}>Copy</button>
                    </div>
                  </div>
                  <div className="bank-equivalent-panel">
                    <span>Send Capacity</span>
                    <strong>{formatAmount(currentBankSendCapacity)} DKT</strong>
                    <small>Backed by {formatAmount(currentBankSendCapacity)} {currentBank.currency}</small>
                  </div>
                </div>
                <div className="bank-metric-grid bank-profile-metrics">
                  <div className="bank-metric">
                    <span>Token Balance</span>
                    <strong>{bankDktBalance !== null ? `${bankDktBalance} DKT` : "—"}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Fiat Reserve</span>
                    <strong>{formatAmount(currentBank.fiatReserve)} {currentBank.currency}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Equivalent</span>
                    <strong>{formatAmount(currentBankDktAmount)} {currentBank.currency}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Reserve Gap</span>
                    <strong>{formatAmount(currentBankBtnAmount - currentBankDktAmount)} {currentBank.currency}</strong>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Registered Banks</div>
                {bankDirectory.length === 0 ? (
                  <div className="empty-state">No registered banks yet</div>
                ) : (
                  <div className="bank-directory-list">
                    {bankDirectory.map((bank) => {
                      const dktBalance = bankTokenBalances[bank.id];
                      const dktAmount = parseAmount(dktBalance);
                      const btnAmount = parseAmount(bank.fiatReserve);
                      const sendCapacity = Math.min(dktAmount, btnAmount);

                      return (
                        <div className="bank-directory-row" key={bank.id}>
                          <div className="bank-directory-main">
                            <strong>{bank.name}</strong>
                            <span>{shorten(bank.wallet)}</span>
                          </div>
                          <div className="bank-directory-metrics">
                            <span>{dktBalance !== undefined && dktBalance !== null ? `${dktBalance} DKT` : "— DKT"}</span>
                            <span>{formatAmount(bank.fiatReserve)} {bank.currency}</span>
                            <span>Can send {formatAmount(sendCapacity)} DKT</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {currentBank && bankTask === "mint" && (
            <div className="card">
              <div className="card-title">Request Mint</div>
              <div className="bank-request-grid">
                <div>
                  <div className="addr-label">Mint Amount</div>
                  <div className="amount-row">
                    <input className="input" type="number" placeholder="0" value={bankMintAmount} onChange={(e) => setBankMintAmount(e.target.value)} />
                    <span className="amount-unit">DKT</span>
                  </div>
                </div>
                <div className="bank-preview">
                  <span>Reserve after request</span>
                  <strong>
                    {reserveAfterMint === null ? "—" : `${formatAmount(reserveAfterMint)} ${currentBank.currency}`}
                  </strong>
                </div>
                <button className="btn btn-accent" onClick={createBankMintRequest} disabled={loading || !step2Done || !bankMintAmount}>
                  {loading ? "Submitting…" : "Submit to Checker"}
                </button>
              </div>
              {reserveAfterMint !== null && reserveAfterMint < 0 && (
                <div className="permission-note">
                  This request is larger than the recorded fiat reserve. Backend will reject it.
                </div>
              )}
            </div>
          )}

          {currentBank && bankTask === "payout" && (
            <div className="card">
              <div className="card-title">Send to User</div>
              <p className="card-desc">
                Registered recipient wallets receive DKT. If the wallet is not registered, the bank burns DKT, checks the CBS account, and queues a bank payout.
              </p>
              <div className="bank-transfer-grid">
                <div>
                  <div className="addr-label">Recipient Wallet</div>
                  <input
                    className="input"
                    placeholder="Recipient public key"
                    value={bankRecipient}
                    onChange={(e) => {
                      setBankRecipient(e.target.value);
                      setBankRecipientStatus(null);
                      setFiatReceiverAccount("");
                      setFiatProductType("LCY_ACC");
                      setCbsAccountStatus(null);
                    }}
                  />
                </div>
                <div>
                  <div className="addr-label">Amount</div>
                  <div className="amount-row">
                    <input
                      className="input"
                      type="number"
                      placeholder="0"
                      value={bankTransferAmount}
                      onChange={(e) => setBankTransferAmount(e.target.value)}
                    />
                    <span className="amount-unit">DKT</span>
                  </div>
                </div>
                <div className="bank-transfer-actions">
                  <button className="btn" onClick={checkBankRecipient} disabled={loading || !bankRecipient}>
                    Check Receiver
                  </button>
                  <button className="btn btn-accent" onClick={sendFromBank} disabled={loading || !step2Done || !bankRecipient || !bankTransferAmount}>
                    {loading ? "Processing…" : "Send Value"}
                  </button>
                </div>
              </div>
              {bankRecipientStatus && (
                <div className={bankRecipientStatus.type === "registered" ? "success-note" : "permission-note"}>
                  {bankRecipientStatus.message}
                </div>
              )}
              {bankRecipientStatus?.type === "unregistered" && (
                <div className="fiat-account-grid">
                  <div>
                    <div className="addr-label">Receiver Bank Account</div>
                    <input
                      className="input"
                      placeholder="12 digit CBS account"
                      value={fiatReceiverAccount}
                      onChange={(e) => {
                        setFiatReceiverAccount(e.target.value.replace(/\D/g, "").slice(0, 12));
                        setCbsAccountStatus(null);
                      }}
                    />
                    {cbsTestAccounts.length > 0 && (
                      <div className="quick-account-row">
                        {cbsTestAccounts.map((account, index) => (
                          <button
                            key={account}
                            className="btn btn-sm"
                            onClick={() => {
                              setFiatReceiverAccount(account);
                              setCbsAccountStatus(null);
                            }}
                          >
                            Test Account {index + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="addr-label">CBS Product Type</div>
                    <input
                      className="input"
                      placeholder="LCY_ACC"
                      value={fiatProductType}
                      onChange={(e) => {
                        setFiatProductType(e.target.value.toUpperCase());
                        setCbsAccountStatus(null);
                      }}
                    />
                  </div>
                  <div className="bank-transfer-actions">
                    <button
                      className="btn"
                      onClick={() => checkCbsReceiverAccount()}
                      disabled={loading || !fiatReceiverAccount}
                    >
                      Check CBS
                    </button>
                  </div>
                </div>
              )}
              {cbsAccountStatus && (
                <>
                  <div className={cbsAccountStatus.type === "valid" ? "success-note" : "permission-note"}>
                    {cbsAccountStatus.message}
                  </div>
                  {cbsAccountStatus.type === "valid" && (
                    <div className="cbs-detail-grid">
                      <div className="bank-metric">
                        <span>Account No</span>
                        <strong>{cbsAccountStatus.accountInfo?.account_no || cbsAccountStatus.metaInfo?.account_no || cbsAccountStatus.accountNo}</strong>
                      </div>
                      <div className="bank-metric">
                        <span>Account Name</span>
                        <strong>{cbsAccountStatus.accountInfo?.account_name || "—"}</strong>
                      </div>
                      <div className="bank-metric">
                        <span>Status</span>
                        <strong>{cbsAccountStatus.accountStatus?.acc_status_details || "Account OK"}</strong>
                      </div>
                      <div className="bank-metric">
                        <span>Available Balance</span>
                        <strong>
                          {cbsAccountStatus.balanceInfo?.btn_available_balance
                            ? `${formatAmount(cbsAccountStatus.balanceInfo.btn_available_balance)} BTN`
                            : "—"}
                        </strong>
                      </div>
                      <div className="bank-metric">
                        <span>Single Transfer Limit</span>
                        <strong>
                          {cbsAccountStatus.transferLimit?.max_single_amt
                            ? `${formatAmount(cbsAccountStatus.transferLimit.max_single_amt)} ${cbsAccountStatus.transferLimit.currency || "BTN"}`
                            : "—"}
                        </strong>
                      </div>
                      <div className="bank-metric">
                        <span>Inquiry ID</span>
                        <strong>{cbsAccountStatus.metaInfo?.inquiry_id || "—"}</strong>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {currentBank && bankTask === "history" && (
            <div className="card">
              <div className="card-title">Bank Settlement History</div>
              {bankSettlements.length === 0 ? (
                <div className="empty-state">No user settlements yet</div>
              ) : (
                <div className="history-list">
                  {bankSettlements.map((s) => (
                    <SettlementHistoryRow
                      key={s.id}
                      settlement={s}
                      perspective="bank"
                      loading={loading}
                      onRefreshStatus={refreshFiatSettlementStatus}
                    />
                  ))}
                </div>
              )}
              <div className="divider" />
              <div className="card-title">Bank Mint History</div>
              {bankHistory.length === 0 ? (
                <div className="empty-state">No bank mint requests yet</div>
              ) : (
                <div className="history-list">
                  {bankHistory.map((h) => (
                    <div className="history-row" key={h.addr}>
                      <div className="history-left">
                        <span className="history-type type-mint">Mint</span>
                        <span className="history-addr">{shorten(h.addr)}</span>
                      </div>
                      <div className="history-right">
                        <span className="history-amount">{formatAmount(h.amount)} DKT</span>
                        <StatusBadge status={h.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "user" && (
        <>
          <div className="card user-portal-card">
            <div className="card-title">User Portal</div>
            <div className="section-heading">Receiver wallet view</div>
            <p className="card-desc">
              A registered user receives DKT from a bank. An unregistered wallet appears in the fiat payout history when a bank uses the fallback path.
            </p>

            {!wallet.publicKey && (
              <div className="permission-note">
                Connect the receiver wallet to view registration, token balance, and settlement history.
              </div>
            )}

            {wallet.publicKey && (
              <>
                <div className="user-metric-grid">
                  <div className="bank-metric">
                    <span>Wallet</span>
                    <strong>{shorten(wallet.publicKey.toBase58())}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>Registration</span>
                    <strong>{currentUser ? currentUser.role : "Not Registered"}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>DKT Balance</span>
                    <strong>{userDktBalance !== null ? `${userDktBalance} DKT` : "—"}</strong>
                  </div>
                  <div className="bank-metric">
                    <span>DKT Received</span>
                    <strong>{formatAmount(userTokenReceived)} DKT</strong>
                  </div>
                  <div className="bank-metric">
                    <span>FIAT Received</span>
                    <strong>{formatAmount(userFiatReceived)} BTN</strong>
                  </div>
                </div>

                {!currentUser && (
                  <>
                    <div className="permission-note">
                      This wallet is not registered. Banks will use the fiat payout fallback instead of sending DKT.
                    </div>
                    {latestUserFiatSettlement && (
                      <div className="success-note">
                        FIAT received through CBS account {latestUserFiatSettlement.receiverAccount}: {formatAmount(userFiatReceived)} {latestUserFiatSettlement.currency || "BTN"} total.
                      </div>
                    )}
                    {latestUserFiatSettlement && (
                      <>
                        <div className="fiat-receiver-panel">
                          <div className="bank-metric">
                            <span>FIAT Increase</span>
                            <strong>+{formatAmount(userFiatReceived)} {latestUserFiatSettlement.currency || "BTN"}</strong>
                          </div>
                        <div className="bank-metric">
                          <span>CBS Account</span>
                          <strong>{latestUserFiatSettlement.receiverAccount}</strong>
                        </div>
                        <div className="bank-metric">
                          <span>Product Type</span>
                          <strong>{latestUserFiatSettlement.cbsProductType || userFiatAccountStatus?.productType || "LCY_ACC"}</strong>
                        </div>
                        <div className="bank-metric">
                          <span>Current CBS Balance</span>
                            <strong>
                              {userFiatAccountStatus?.balanceInfo?.btn_available_balance
                                ? `${formatAmount(userFiatAccountStatus.balanceInfo.btn_available_balance)} BTN`
                                : "Refresh to view"}
                            </strong>
                          </div>
                          <button
                            className="btn"
                            onClick={refreshUserFiatAccount}
                            disabled={loading}
                          >
                            Refresh CBS Balance
                          </button>
                        </div>
                        {userFiatAccountStatus && (
                          <div className="cbs-detail-grid">
                            <div className="bank-metric">
                              <span>Account Name</span>
                              <strong>{userFiatAccountStatus.accountInfo?.account_name || "—"}</strong>
                            </div>
                            <div className="bank-metric">
                              <span>Status</span>
                              <strong>{userFiatAccountStatus.accountStatus?.acc_status_details || "Account OK"}</strong>
                            </div>
                            <div className="bank-metric">
                              <span>Inquiry ID</span>
                              <strong>{userFiatAccountStatus.metaInfo?.inquiry_id || "—"}</strong>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="role-selector">
                      {USER_ROLES.filter((role) => role !== "Admin" && role !== "Checker").map((role) => (
                        <button
                          key={role}
                          className={`role-option ${selectedRole === role ? "role-selected" : ""}`}
                          onClick={() => setSelectedRole(role)}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-accent" onClick={registerConnectedWallet} disabled={loading}>
                      {loading ? "Registering…" : "Register Receiver Wallet"}
                    </button>
                  </>
                )}

                {currentUser && (
                  <div className="user-action-row">
                    <button className="btn" onClick={refreshWalletTokenBalance}>Refresh Balance</button>
                    <button className="btn" onClick={loadUserSettlements}>Refresh History</button>
                  </div>
                )}
                {!currentUser && (
                  <div className="user-action-row">
                    <button className="btn" onClick={loadUserSettlements}>Refresh FIAT History</button>
                  </div>
                )}
                <div className="task-nav compact-task-nav">
                  {[
                    { id: "profile", label: "Profile" },
                    { id: "history", label: "History" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      className={`task-btn ${userTask === item.id ? "task-active" : ""}`}
                      onClick={() => setUserTask(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {wallet.publicKey && userTask === "history" && (
            <div className="card">
              <div className="card-title">Received Value History</div>
              {userSettlements.length === 0 ? (
                <div className="empty-state">No received settlements yet</div>
              ) : (
                <div className="history-list">
                  {userSettlements.map((s) => (
                    <SettlementHistoryRow
                      key={s.id}
                      settlement={s}
                      perspective="user"
                      loading={loading}
                      onRefreshStatus={refreshFiatSettlementStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "mint" && (
        <div className="card">
          <div className="card-title">Maker Mint Request</div>
          <div className="section-heading">Request DKT from the checker flow</div>
          <p className="card-desc">The connected wallet becomes the maker on-chain. A checker from the Config account must approve before tokens are minted.</p>
          {!currentUser && (
            <div className="permission-note">
              Backend registration is optional. Smart-contract permission comes from the connected wallet signature.
            </div>
          )}
          {currentUser && !wallet.publicKey && (
            <div className="permission-note">
              Connect a wallet before submitting a mint request.
            </div>
          )}
          <div className="amount-row">
            <input className="input" type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 160, textAlign: "right" }} />
            <span className="amount-unit">DKT</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-accent" onClick={createMintRequest} disabled={loading || !step2Done || !canCreateMintRequest}>
              {loading ? "Submitting…" : "Submit Request"}
            </button>
          </div>
          {requestAddress && (
            <>
              <div className="divider" />
              <div className="request-meta">
                <div className="addr-label">Request Address</div>
                <div className="request-addr-row">
                  <span className="request-addr">{shorten(requestAddress)}</span>
                  <button className="btn btn-sm" onClick={() => copy(requestAddress, "Request address")}>Copy</button>
                </div>
                {requestStatus && <StatusBadge status={requestStatus} />}
              </div>
              {requestStatus === "Pending" && (
                <div className="checker-actions">
                  <div className="checker-actions-label">Checker Actions</div>
                  {!canReviewMintRequest && (
                    <div className="permission-note">
                      Only wallets in the on-chain checker list can approve or reject requests.
                    </div>
                  )}
                  <div className="checker-btns">
                    <button className="btn-approve" onClick={approveRequest} disabled={loading || !canReviewMintRequest}>{loading ? "Processing…" : "Approve →"}</button>
                    <button className="btn-reject" onClick={rejectRequest} disabled={loading || !canReviewMintRequest}>Reject ✕</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "transfer" && (
        <div className="card">
          <div className="card-title">P2P Transfer</div>
          <p className="card-desc">Send tokens directly to any wallet. No approval required.</p>
          <input className="input" placeholder="Recipient public key (base58)" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="amount-row">
            <input className="input" type="number" placeholder="0" value={transferAmt} onChange={(e) => setTransferAmt(e.target.value)} style={{ maxWidth: 160, textAlign: "right" }} />
            <span className="amount-unit">DKT</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-accent" onClick={transferTokens} disabled={loading || !step2Done}>{loading ? "Sending…" : "Send →"}</button>
          </div>
          <div className="divider" />
          <div className="balance-row">
            <div>
              <div className="addr-label">Your Balance</div>
              <div className="balance-val">{balance !== null ? `${balance} DKT` : "—"}</div>
            </div>
            <button className="btn" onClick={checkBalance}>Refresh</button>
          </div>
        </div>
      )}

      {tab === "burn" && (
        <div className="card">
          <div className="card-title">Burn Tokens</div>
          <p className="card-desc">Permanently destroy tokens from your wallet. This reduces total supply and cannot be undone.</p>
          <div className="amount-row">
            <input className="input" type="number" placeholder="0" value={burnAmt} onChange={(e) => setBurnAmt(e.target.value)} style={{ maxWidth: 160, textAlign: "right" }} />
            <span className="amount-unit">DKT</span>
            <div style={{ flex: 1 }} />
            <button className="btn-burn" onClick={burnTokens} disabled={loading || !step2Done}>{loading ? "Burning…" : "Burn ✕"}</button>
          </div>
          <div className="burn-warning">
            <span className="warn-icon">⚠</span>
            Burned tokens cannot be recovered. Confirm the amount before proceeding.
          </div>
        </div>
      )}

      {tab === "setup" && (
        <>
          <div className="card">
            <div className="card-title">Setup Authority</div>
            <div className="section-heading">Admin creates Config and checker list</div>
            <p className="card-desc">This matches `initialize(checkers)` in the smart contract. The checker list cannot be changed by backend role registration.</p>
            <div className="role-panel">
              <div>
                <div className="addr-label">Connected Wallet</div>
                <div className="role-wallet">
                  {wallet.publicKey ? shorten(wallet.publicKey.toBase58()) : "not connected"}
                </div>
              </div>
              <div>
                <div className="addr-label">On-chain Role</div>
                <div className="role-current">
                  {authorityRole}
                </div>
              </div>
            </div>
            {onChainConfig && (
              <div className="authority-grid">
                <div>
                  <div className="addr-label">Admin</div>
                  <div className="addr-card">
                    <span className="addr-mono">{shorten(onChainConfig.adminAddr)}</span>
                    <button className="btn btn-sm" onClick={() => copy(onChainConfig.adminAddr, "Admin address")}>Copy</button>
                  </div>
                </div>
                <div>
                  <div className="addr-label">On-chain Checkers</div>
                  <div className="addr-card">
                    <span className="addr-mono">{onChainConfig.checkers.length}</span>
                    <button className="btn btn-sm" onClick={() => refreshOnChainConfig()}>Refresh</button>
                  </div>
                </div>
              </div>
            )}
            {!currentUser && (
              <>
                <div className="divider" />
                <div className="card-desc">Optional backend label for dashboard filtering. Smart-contract authority still comes from the on-chain config.</div>
                <div className="role-selector">
                  {USER_ROLES.map((role) => (
                    <button
                      key={role}
                      className={`role-option ${selectedRole === role ? "role-selected" : ""}`}
                      onClick={() => setSelectedRole(role)}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-accent"
                  onClick={registerConnectedWallet}
                  disabled={loading || !wallet.publicKey}
                >
                  {loading ? "Registering…" : "Register Wallet"}
                </button>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">Setup Checkers</div>
            <div className="field-row">
              <input className="input" placeholder="Checker public key (base58)" value={checkerInput} onChange={(e) => setCheckerInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChecker()} />
              <button className="btn" onClick={addChecker}>Add</button>
            </div>
            {checkers.length > 0 && (
              <div className="checker-list">
                {checkers.map((c, i) => {
                  const isYou = wallet.publicKey && c.toBase58() === wallet.publicKey.toBase58();
                  return (
                    <div className="checker-chip" key={i}>
                      <div>
                        <span className="checker-addr">{c.toBase58()}</span>
                        {isYou && <span className="checker-you">(you)</span>}
                      </div>
                      <button className="chip-remove" onClick={() => setCheckers(checkers.filter((_, j) => j !== i))}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">System Initialization</div>
            <div className="step-row">
              <button className={`step-btn ${step1Done ? "done" : "active"}`} onClick={!step1Done ? initialize : undefined} disabled={loading && !step1Done}>
                {step1Done ? "1. System Initialized ✓" : loading ? "1. Initializing…" : "1. Initialize System"}
              </button>
              <button className={`step-btn ${step2Done ? "done" : step1Done ? "active" : ""}`} onClick={step1Done && !step2Done && !isCreatingMint ? createMint : undefined} disabled={!step1Done || isCreatingMint || (onChainConfig && !isOnChainAdmin)}>
                {step2Done ? "2. Mint Created ✓" : isCreatingMint ? "2. Creating…" : "2. Create Mint"}
              </button>
            </div>
            {onChainConfig && !isOnChainAdmin && !step2Done && (
              <div className="permission-note">
                Only the on-chain admin can create the mint for this config.
              </div>
            )}
            <div className="addr-grid">
              {[
                { label: "Config Address", val: configAddress },
                { label: "Mint Address", val: mintAddress },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="addr-label">{label}</div>
                  {val ? (
                    <div className="addr-card">
                      <span className="addr-mono">{shorten(val)}</span>
                      <button className="btn btn-sm" onClick={() => copy(val, label)}>Copy</button>
                    </div>
                  ) : (
                    <div className="addr-card empty">
                      <span className="addr-empty">not initialized</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="card">
          <div className="card-title">Request &amp; Operation History</div>
          {history.length === 0 ? (
            <div className="history-empty">No operations recorded yet</div>
          ) : (
            <div className="history-list">
              {history.map((h, i) => (
                <div className="history-row" key={i}>
                  <div className="history-left">
                    <span className={`history-type type-${h.type.toLowerCase()}`}>{h.type}</span>
                    <span className="history-addr">{shorten(h.addr)}</span>
                  </div>
                  <div className="history-right">
                    <span className="history-amount">{h.amount} DKT</span>
                    <StatusBadge status={h.status} />
                    <span className="history-time">
                      {new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
