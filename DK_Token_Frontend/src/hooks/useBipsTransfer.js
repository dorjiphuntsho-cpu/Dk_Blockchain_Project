import { useState, useCallback } from "react";

// Generates a unique request_id on the frontend as required by BIPS spec
const generateRequestId = () => {
    return `${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
};

const API_BASE = "http://localhost:5000/api/bips"; // proxied through your Express server

/**
 * useBipsTransfer
 * Manages the full two-step BIPS flow:
 *   1. Account Inquiry  → validates beneficiary, returns reference_number
 *   2. Fund Transfer    → debits using reference_number
 */
export const useBipsTransfer = () => {
    const [step, setStep] = useState("idle"); // idle | inquiring | inquiry_done | transferring | done | error
    const [inquiryResult, setInquiryResult] = useState(null);
    const [transferResult, setTransferResult] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const reset = () => {
        setStep("idle");
        setInquiryResult(null);
        setTransferResult(null);
        setError(null);
        setLoading(false);
    };

    // ─── Step 1: Account Inquiry ───────────────────────────────────────────────
    const doAccountInquiry = useCallback(async (formData) => {
        setLoading(true);
        setError(null);
        setStep("inquiring");

        try {
            const request_id = generateRequestId();
            const res = await fetch(`${API_BASE}/account-inquiry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, request_id }),
            });

            const json = await res.json();

            if (!json.success) {
                setError(json.message || "Account inquiry failed");
                setStep("error");
                return null;
            }

            // Store inquiry result — includes reference_number needed for transfer
            setInquiryResult({ ...json.data, request_id, originalForm: formData });
            setStep("inquiry_done");
            return json.data;
        } catch (err) {
            setError(err.message || "Network error during account inquiry");
            setStep("error");
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Step 2: Fund Transfer ─────────────────────────────────────────────────
    const doTransfer = useCallback(async () => {
        if (!inquiryResult) {
            setError("Run account inquiry first");
            return null;
        }

        setLoading(true);
        setError(null);
        setStep("transferring");

        const { reference_number, beneficiary_account_name, originalForm } = inquiryResult;

        try {
            const request_id = generateRequestId(); // new request_id for this step
            const res = await fetch(`${API_BASE}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...originalForm,
                    BeneficiaryAccountName: beneficiary_account_name,
                    reference_number,
                    request_id,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                setError(json.message || "Transfer failed");
                setStep("error");
                return null;
            }

            setTransferResult(json);
            setStep("done");
            return json;
        } catch (err) {
            setError(err.message || "Network error during transfer");
            setStep("error");
            return null;
        } finally {
            setLoading(false);
        }
    }, [inquiryResult]);

    return {
        step,
        loading,
        error,
        inquiryResult,
        transferResult,
        doAccountInquiry,
        doTransfer,
        reset,
    };
};

/**
 * useBankCodes
 * Fetches and caches the bank code list on mount.
 */
export const useBankCodes = () => {
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchBanks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/bank-codes`);
            const json = await res.json();
            console.log(json);
            if (json.success) setBanks(json.data);
        } catch (err) {
            console.error("Failed to load bank codes:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    return { banks, loading, fetchBanks };
};