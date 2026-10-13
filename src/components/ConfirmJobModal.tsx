/**
 * src/components/ConfirmJobModal.tsx
 *
 * Phase 4: Confirm Job Done via MetaMask on Arkiv Tiramisu.
 *
 * Submits a completion entity on booking_key with role "seller" or "buyer".
 * Creatable even after the slot itself has expired.
 */

import React, { useState, useEffect } from "react";
import type { Hex } from "viem";
import { formatEther } from "viem";
import {
  createCompletion,
  getArkivPublicClient,
  type BookingEntity,
  type SlotEntity,
} from "../lib/arkiv.js";
import { useWallet } from "../lib/wallet.js";

const EXPLORER_BASE = "https://explorer.tiramisu.arkiv.network";
const FAUCET_URL = "https://hub.arkiv.network/faucet";

export interface ConfirmJobModalProps {
  open: boolean;
  slot: SlotEntity | null;
  booking: BookingEntity | null;
  role: "seller" | "buyer";
  onClose: () => void;
  onCompletionDone?: (completionKey: Hex) => void;
}

export function ConfirmJobModal({
  open,
  slot,
  booking,
  role,
  onClose,
  onCompletionDone,
}: ConfirmJobModalProps): React.ReactElement | null {
  const { client, address, status, isWrongNetwork, switchNetwork } = useWallet();

  const [note, setNote] = useState("");
  const [stage, setStage] = useState<"idle" | "preparing" | "waiting_wallet" | "submitted" | "confirmed" | "success">("idle");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [completionKey, setCompletionKey] = useState<Hex | null>(null);
  const [confirmedBlock, setConfirmedBlock] = useState<bigint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [userGlmBalance, setUserGlmBalance] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setStage("idle");
      setTxHash(null);
      setCompletionKey(null);
      setConfirmedBlock(null);
      setIsSubmitting(false);
      setErrorNotice(null);
      setErrorCode(null);
    }
  }, [open]);

  useEffect(() => {
    if (address) {
      getArkivPublicClient()
        .getBalance({ address })
        .then((b) => setUserGlmBalance(`${parseFloat(formatEther(b)).toFixed(4)} GLM`))
        .catch(() => setUserGlmBalance(null));
    }
  }, [address]);

  // Esc key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting && stage !== "waiting_wallet") {
        onClose();
      }
    }
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, stage, onClose]);

  if (!open || !slot || !booking) return null;

  async function handleConfirmJob() {
    if (isSubmitting || !booking) return;
    setIsSubmitting(true);
    setErrorNotice(null);
    setErrorCode(null);

    if (!client || !address || status !== "connected") {
      setErrorNotice("Wallet is not connected.");
      setIsSubmitting(false);
      return;
    }

    if (isWrongNetwork) {
      setErrorCode("WRONG_NETWORK");
      setErrorNotice("Wrong network. Please switch to Arkiv Tiramisu.");
      setIsSubmitting(false);
      return;
    }

    try {
      setStage("preparing");
      setStage("waiting_wallet");

      const res = await createCompletion(client, {
        bookingKey: booking.key,
        role,
        note: note.trim() || undefined,
        synthetic: false,
      });

      setTxHash(res.txHash);
      setCompletionKey(res.entityKey);
      setStage("submitted");

      // Wait for block receipt
      const pubClient = getArkivPublicClient();
      try {
        const receipt = await pubClient.waitForTransactionReceipt({
          hash: res.txHash,
          timeout: 25_000,
        });
        setConfirmedBlock(receipt.blockNumber);
      } catch {
        // continue
      }

      setStage("success");
      if (onCompletionDone) {
        onCompletionDone(res.entityKey);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("user rejected") || lower.includes("denied") || lower.includes("4001")) {
        setErrorCode("WALLET_REJECTED");
        setErrorNotice("Confirmation request was rejected in MetaMask.");
      } else if (lower.includes("insufficient") || lower.includes("gas") || lower.includes("funds")) {
        setErrorCode("INSUFFICIENT_GLM");
        setErrorNotice(
          `Insufficient GLM balance for gas. Current balance: ${userGlmBalance ?? "0 GLM"}.`
        );
      } else if (lower.includes("chain") || lower.includes("network")) {
        setErrorCode("WRONG_NETWORK");
        setErrorNotice("Wrong network. Please switch to Arkiv Tiramisu.");
      } else {
        setErrorCode("UNKNOWN");
        setErrorNotice(`Failed to confirm job: ${msg}`);
      }
      setStage("idle");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="post-modal-backdrop" onClick={!isSubmitting ? onClose : undefined}>
      <div
        className="post-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm job completion"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="post-modal__header">
          <div>
            <h3>Confirm Job Done</h3>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {role === "seller" ? "Seller (Merchant) Confirmation" : "Buyer (Client) Confirmation"}
            </span>
          </div>
          <button
            className="post-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Stepper Progress */}
        {stage !== "idle" && (
          <div
            className="stepper-box"
            role="status"
            aria-live="polite"
            style={{
              background: "var(--c-paper-dark)",
              border: "var(--border)",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.85rem", textTransform: "uppercase" }}>
                {stage === "preparing" && "Preparing Completion…"}
                {stage === "waiting_wallet" && "Approve in MetaMask…"}
                {stage === "submitted" && "Transaction Broadcast…"}
                {stage === "success" && "✓ Confirmed on Arkiv!"}
              </strong>
              {isSubmitting && <span className="chain-pulse" style={{ width: 10, height: 10 }} />}
            </div>

            <div style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
              {stage === "waiting_wallet" && "Review and sign the confirmation receipt in MetaMask."}
              {stage === "submitted" && (
                <>
                  Transaction broadcast! Confirmed in block #{confirmedBlock?.toString() || "..."}.
                  {txHash && (
                    <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      Tx:{" "}
                      <a
                        href={`${EXPLORER_BASE}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--c-ink)", textDecoration: "underline" }}
                      >
                        {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
                      </a>
                    </div>
                  )}
                </>
              )}
              {stage === "success" && (
                <div>
                  Your {role} confirmation has been recorded on Arkiv! When both sides confirm, this job automatically counts toward verified reputation.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div
            className="post-error-banner"
            role="alert"
            style={{
              background: "rgba(220, 38, 38, 0.08)",
              border: "2px solid var(--c-vermilion)",
              padding: "10px",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>{errorNotice}</div>
            {errorCode === "INSUFFICIENT_GLM" && (
              <div>
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: "inline-block", padding: "4px 8px", fontSize: "0.75rem" }}
                >
                  Request GLM Faucet ↗
                </a>
              </div>
            )}
            {errorCode === "WRONG_NETWORK" && (
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void switchNetwork()}
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                >
                  Switch to Tiramisu
                </button>
              </div>
            )}
          </div>
        )}

        {stage !== "success" ? (
          <div className="post-modal__body">
            <div
              style={{
                background: "var(--c-paper-dark)",
                border: "var(--border)",
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: "0.85rem",
              }}
            >
              <div><strong>Slot:</strong> {slot.title}</div>
              <div><strong>Role:</strong> {role === "seller" ? "Seller (Service Provider)" : "Buyer (Client)"}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                <strong>Booking:</strong> {booking.key.slice(0, 12)}…{booking.key.slice(-8)}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "0.85rem" }}>
                Fulfillment Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="e.g. 50 pcs turned to tolerance; delivered on schedule."
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "var(--border)",
                  background: "var(--c-paper)",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="post-modal__footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ marginRight: 10 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="post-modal__btn"
                onClick={handleConfirmJob}
                disabled={isSubmitting}
                id="submit-confirm-job-btn"
              >
                {isSubmitting ? "Confirming…" : `Sign as ${role === "seller" ? "Seller" : "Buyer"}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="post-modal__body" style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "2.5rem" }}>✨</div>
            <h4 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "8px 0" }}>
              Confirmation Recorded
            </h4>
            <p style={{ fontSize: "0.85rem", maxWidth: 400, margin: "0 auto 14px auto" }}>
              Your completion signature is written on Arkiv Tiramisu.
            </p>
            {completionKey && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginBottom: 14 }}>
                Receipt:{" "}
                <a
                  href={`${EXPLORER_BASE}/entity/${completionKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--c-ink)", textDecoration: "underline" }}
                >
                  {completionKey.slice(0, 12)}…{completionKey.slice(-8)} ↗
                </a>
              </div>
            )}
            <div className="post-modal__footer" style={{ justifyContent: "center" }}>
              <button type="button" className="post-modal__btn" onClick={onClose} id="confirm-job-done-btn">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
