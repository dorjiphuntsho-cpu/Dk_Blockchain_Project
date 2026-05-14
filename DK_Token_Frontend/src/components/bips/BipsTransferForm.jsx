import { useEffect, useState } from "react";
import { useBipsTransfer, useBankCodes } from "../../hooks/useBipsTransfer";

const TRANSFER_PURPOSES = [
    "Family Remittance",
    "Business Payment",
    "Education Fee",
    "Medical Expense",
    "BIPS Outgoing Test",
];

const BANK_NAMES = {
    "1060": "DK Bank",
    "1010": "BOB",
    "1020": "BNB",
    "1030": "DPNB",
    "1040": "T-Bank",
    "1050": "BDBL",
};

const Label = ({ children }) => (
    <label className="block text-xs font-medium text-gray-500 mb-1">{children}</label>
);

const Input = ({ ...props }) => (
    <input
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900
               placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               transition-all duration-150"
        {...props}
    />
);

const Select = ({ children, ...props }) => (
    <select
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               transition-all duration-150 cursor-pointer"
        {...props}
    >
        {children}
    </select>
);

const SectionCard = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
            {title}
        </p>
        {children}
    </div>
);

const StepBar = ({ current }) => {
    const steps = ["Account Inquiry", "Confirm", "Done"];
    return (
        <div className="flex items-center mb-6">
            {steps.map((label, i) => {
                const num = i + 1;
                const done = num < current;
                const active = num === current;
                return (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                ${done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                                {done ? "✓" : num}
                            </div>
                            <span className={`text-xs font-medium whitespace-nowrap
                ${active ? "text-gray-800" : "text-gray-400"}`}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-px mx-2 ${done ? "bg-green-300" : "bg-gray-200"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const ResultRow = ({ label, value, valueClass = "" }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-sm font-medium text-gray-900 text-right ml-4 ${valueClass}`}>{value}</span>
    </div>
);

const ErrorBox = ({ message }) =>
    message ? (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm mb-4">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{message}</span>
        </div>
    ) : null;

const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
);

export default function BipsTransferForm() {
    const { step, loading, error, inquiryResult, transferResult, doAccountInquiry, doTransfer, reset } =
        useBipsTransfer();
    const { banks, fetchBanks } = useBankCodes();

    const [form, setForm] = useState({
        Amount: "",
        BeneficiaryAccountNumber: "",
        BeneficiaryBankCode: "",
        SourceAccountName: "",
        SourceAccountNumber: "",
        SourceBankCode: "",
        TransferPurpose: "",
    });

    useEffect(() => { fetchBanks(); }, []);

    const handleChange = (e) =>
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const bankList = banks.length
        ? banks
        : Object.entries(BANK_NAMES).map(([code, name]) => ({ code, name }));

    const BankOptions = () => (
        <>
            <option value="">— Select bank —</option>
            {bankList.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
            ))}
        </>
    );

    // ─── Step 1: Inquiry Form ──────────────────────────────────────────────────
    if (step === "idle" || step === "inquiring" || step === "error") {
        return (
            <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-10 px-4 pb-10">
                <div className="w-full max-w-lg">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Fund Transfer</h1>
                        <p className="text-sm text-gray-500 mt-1">Bhutan Interbank Payment System (BIPS)</p>
                    </div>

                    <StepBar current={1} />

                    <SectionCard title="Source Account">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <Label>Account Name</Label>
                                <Input name="SourceAccountName" value={form.SourceAccountName}
                                    onChange={handleChange} placeholder="e.g. Rigzin Sonam" />
                            </div>
                            <div>
                                <Label>Account Number</Label>
                                <Input name="SourceAccountNumber" value={form.SourceAccountNumber}
                                    onChange={handleChange} placeholder="e.g. 100100125044" />
                            </div>
                        </div>
                        <div>
                            <Label>Bank</Label>
                            <Select name="SourceBankCode" value={form.SourceBankCode} onChange={handleChange}>
                                <BankOptions />
                            </Select>
                        </div>
                    </SectionCard>

                    <SectionCard title="Beneficiary">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Account Number</Label>
                                <Input name="BeneficiaryAccountNumber" value={form.BeneficiaryAccountNumber}
                                    onChange={handleChange} placeholder="e.g. 5100063196007" />
                            </div>
                            <div>
                                <Label>Bank</Label>
                                <Select name="BeneficiaryBankCode" value={form.BeneficiaryBankCode} onChange={handleChange}>
                                    <BankOptions />
                                </Select>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Transfer Details">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Amount (BTN)</Label>
                                <Input name="Amount" type="number" min="1" value={form.Amount}
                                    onChange={handleChange} placeholder="e.g. 1000" />
                            </div>
                            <div>
                                <Label>Purpose</Label>
                                <Select name="TransferPurpose" value={form.TransferPurpose} onChange={handleChange}>
                                    <option value="">— Select purpose —</option>
                                    {TRANSFER_PURPOSES.map((p) => <option key={p}>{p}</option>)}
                                </Select>
                            </div>
                        </div>
                    </SectionCard>

                    <ErrorBox message={error} />

                    <button
                        onClick={() => doAccountInquiry(form)}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                       disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl
                       transition-all duration-150 active:scale-95 shadow-sm flex items-center justify-center gap-2"
                    >
                        {loading ? <><Spinner /> Verifying account…</> : "Verify Account →"}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Step 2: Confirm Screen ────────────────────────────────────────────────
    if (step === "inquiry_done" || step === "transferring") {
        const d = inquiryResult;
        return (
            <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-10 px-4 pb-10">
                <div className="w-full max-w-lg">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Confirm Transfer</h1>
                        <p className="text-sm text-gray-500 mt-1">Review carefully before confirming</p>
                    </div>

                    <StepBar current={2} />

                    <SectionCard title="Beneficiary Details">
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center
                              text-blue-700 font-bold text-sm shrink-0">
                                {d?.beneficiary_account_name?.slice(0, 2).toUpperCase() || "??"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{d?.beneficiary_account_name}</p>
                                <p className="text-xs text-gray-500">{form.BeneficiaryAccountNumber}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0
                ${d?.status === "ACT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {d?.status === "ACT" ? "Active" : d?.status}
                            </span>
                        </div>
                        <ResultRow label="Bank" value={BANK_NAMES[form.BeneficiaryBankCode] || form.BeneficiaryBankCode} />
                        <ResultRow label="Account Type" value={d?.account_type} />
                        <ResultRow label="Reference #" value={d?.reference_number} valueClass="font-mono text-xs text-gray-500" />
                    </SectionCard>

                    <SectionCard title="Transfer Details">
                        <ResultRow label="From" value={`${form.SourceAccountNumber} · ${BANK_NAMES[form.SourceBankCode]}`} />
                        <ResultRow label="Amount" value={`BTN ${Number(form.Amount).toLocaleString()}`} valueClass="text-blue-600 text-base" />
                        <ResultRow label="Purpose" value={form.TransferPurpose} />
                    </SectionCard>

                    <ErrorBox message={error} />

                    <div className="flex gap-3">
                        <button
                            onClick={reset}
                            disabled={loading}
                            className="px-5 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200
                         rounded-xl hover:bg-gray-50 transition-all duration-150 active:scale-95 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={doTransfer}
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                         disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl
                         transition-all duration-150 active:scale-95 shadow-sm flex items-center justify-center gap-2"
                        >
                            {loading ? <><Spinner /> Processing…</> : "Confirm & Transfer"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Step 3: Success ───────────────────────────────────────────────────────
    if (step === "done" && transferResult) {
        const d = transferResult.data;
        return (
            <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-10 px-4 pb-10">
                <div className="w-full max-w-lg">
                    <StepBar current={4} />

                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center
                            text-green-600 text-3xl mx-auto mb-4">✓</div>
                        <h1 className="text-2xl font-bold text-gray-900">Transfer Successful</h1>
                        <p className="text-sm text-gray-500 mt-1">Funds have been sent to the beneficiary</p>
                    </div>

                    <SectionCard title="Transaction Receipt">
                        <ResultRow label="From" value={`${d?.pay_from} (${d?.pay_from_bank})`} />
                        <ResultRow label="To" value={`${d?.pay_to} (${d?.pay_to_bank})`} />
                        <ResultRow label="Amount" value={`BTN ${Number(d?.transaction_amount).toLocaleString()}`} valueClass="text-green-600 font-bold" />
                        <ResultRow label="Reference #" value={d?.rr_number} valueClass="font-mono text-xs text-gray-500" />
                        <ResultRow label="Time" value={d?.transaction_time} />
                        <ResultRow label="Purpose" value={d?.transfer_purpose} />
                    </SectionCard>

                    {transferResult.status_verification?.error && (
                        <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800
                            rounded-lg px-3 py-2.5 text-sm mb-4">
                            <span className="shrink-0">⚠️</span>
                            <span>{transferResult.status_verification.error}</span>
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                       rounded-xl transition-all duration-150 active:scale-95 shadow-sm"
                    >
                        New Transfer
                    </button>
                </div>
            </div>
        );
    }

    return null;
}