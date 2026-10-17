/**
 * src/components/BookSlotModal.tsx
 *
 * Phase 4: Book a Slot via MetaMask on Arkiv Tiramisu.
 *
 * Flow:
 *  - Confirmation dialog with slot details & zero-payment disclaimer.
 *  - Stepper: preparing -> waiting_wallet -> submitted -> confirmed -> indexing -> outcome.
 *  - Outcome evaluation: Displays whether user won ("You booked this") or missed ("Missed: someone booked first").
 */

import React, { useState, useEffect } from "react";
import type { Hex } from "viem";
import { formatEther } from "viem";
import {
  createBooking,
  fetchBookingsForSlot,
  getArkivPublicClient,
  getEntityExplorerUrl,
  getTxExplorerUrl,
  type SlotEntity,
  type BookingEntity,
} from "../lib/arkiv.js";
import { useWallet } from "../lib/wallet.js";
import { formatDateTime, formatTimeLeft } from "../lib/time.js";
import { useNow } from "../hooks/useNow.js";

const FAUCET_URL = "https://hub.arkiv.network/faucet";

export type BookingStepperStage =
  | "idle"
  | "preparing"
  | "waiting_wallet"
  | "submitted"
  | "confirmed"
  | "indexing"
  | "outcome";

export interface BookSlotModalProps {
  open: boolean;
  slot: SlotEntity | null;
  onClose: () => void;
  onBookingComplete?: (booking: BookingEntity, isWinner: boolean) => void;
}

export function BookSlotModal({
  open,
  slot,
  onClose,
  onBookingComplete,
}: BookSlotModalProps): React.ReactElement | null {
  const { client, address, status, isWrongNetwork, switchNetwork } = useWallet();
  const now = useNow();

  const [stage, setStage] = useState<BookingStepperStage>("idle");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [bookingKey, setBookingKey] = useState<Hex | null>(null);
  const [confirmedBlock, setConfirmedBlock] = useState<bigint | null>(null);
  const [winnerBooking, setWinnerBooking] = useState<BookingEntity | null>(null);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [userGlmBalance, setUserGlmBalance] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStage("idle");
      setTxHash(null);
      setBookingKey(null);
      setConfirmedBlock(null);
      setWinnerBooking(null);
      setIsWinner(false);
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

  // Esc close handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting && stage !== "waiting_wallet") {
        onClose();
      }
    }
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, stage, onClose]);

  if (!open || !slot) return null;

  async function handleConfirmBooking() {
    if (isSubmitting || !slot) return;
    setIsSubmitting(true);
    setErrorNotice(null);
    setErrorCode(null);

    if (!client || !address || status !== "connected") {
      setErrorNotice("Wallet not connected. Please connect MetaMask to continue.");
      setIsSubmitting(false);
      return;
    }

    if (isWrongNetwork) {
      setErrorCode("WRONG_NETWORK");
      setErrorNotice("Wallet is connected to the wrong network. Please switch to Arkiv Tiramisu.");
      setIsSubmitting(false);
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (slot.endsAt <= nowSec) {
      setErrorCode("INVALID_PAYLOAD");
      setErrorNotice("Cannot book this slot: availability window has already expired on Arkiv.");
      setIsSubmitting(false);
      return;
    }

    const userAddr = address.toLowerCase();
    if (slot.creator.toLowerCase() === userAddr || (slot.owner && slot.owner.toLowerCase() === userAddr)) {
      setErrorCode("INVALID_PAYLOAD");
      setErrorNotice("You cannot book your own slot.");
      setIsSubmitting(false);
      return;
    }

    try {
      setStage("preparing");

      // Preflight on-chain check to prevent competing active bookings
      const existing = await fetchBookingsForSlot(slot.key);
      if (existing.winner || existing.all.length > 0) {
        setErrorCode("CONCURRENT_SUBMISSION");
        setErrorNotice("This slot has already been booked by another wallet on Arkiv. Competing bookings are prevented.");
        setIsSubmitting(false);
        setStage("idle");
        return;
      }

      setStage("waiting_wallet");
      // Call createBooking (passes slotCreator, slotStartsAt and slotEndsAt directly so MetaMask opens instantly without blocking network queries)
      const res = await createBooking(client, {
        slotKey: slot.key,
        slotCreator: slot.creator,
        slotStartsAt: slot.startsAt,
        slotEndsAt: slot.endsAt,
        synthetic: false,
      });

      setTxHash(res.txHash);
      setBookingKey(res.entityKey);
      setStage("submitted");

      const myBooking: BookingEntity = {
        key: res.entityKey,
        creator: address,
        owner: address,
        slotKey: slot.key,
        slotCreator: slot.creator,
        slotStartsAt: slot.startsAt,
        slotEndsAt: slot.endsAt,
        bookedAt: Math.floor(Date.now() / 1000),
        note: "",
        expiresAtBlock: res.expiresAt,
        synthetic: false,
        schemaVersion: 2,
      };

      setWinnerBooking(myBooking);
      setIsWinner(true);
      setStage("outcome");

      if (onBookingComplete) {
        onBookingComplete(myBooking, true);
      }

      // Background receipt confirmation (non-blocking)
      const pubClient = getArkivPublicClient();
      pubClient
        .waitForTransactionReceipt({
          hash: res.txHash,
          timeout: 25_000,
        })
        .then((receipt) => {
          setConfirmedBlock(receipt.blockNumber);
        })
        .catch(() => {
          // continue
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("user rejected") || lower.includes("denied") || lower.includes("4001")) {
        setErrorCode("WALLET_REJECTED");
        setErrorNotice("Booking transaction was rejected in MetaMask.");
      } else if (lower.includes("insufficient") || lower.includes("gas") || lower.includes("funds")) {
        setErrorCode("INSUFFICIENT_GLM");
        setErrorNotice(
          `Insufficient GLM balance for gas. Current balance: ${userGlmBalance ?? "0 GLM"}.`
        );
      } else if (lower.includes("chain") || lower.includes("wrong network")) {
        setErrorCode("WRONG_NETWORK");
        setErrorNotice("Wrong network. Please switch to Arkiv Tiramisu.");
      } else if (lower.includes("already has an active booking") || lower.includes("competing booking") || lower.includes("concurrent")) {
        setErrorCode("CONCURRENT_SUBMISSION");
        setErrorNotice("This slot has already been booked on Arkiv. Competing bookings are rejected.");
      } else if (lower.includes("expired") || lower.includes("deadline")) {
        setErrorCode("INVALID_PAYLOAD");
        setErrorNotice("Cannot book this slot: availability window has already expired on Arkiv.");
      } else if (lower.includes("own slot")) {
        setErrorCode("INVALID_PAYLOAD");
        setErrorNotice("You cannot book your own slot.");
      } else {
        setErrorCode("UNKNOWN");
        setErrorNotice(`Failed to book slot: ${msg}`);
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
        aria-label="Book slot confirmation"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        <div className="post-modal__header">
          <div>
            <h3>Book Time Slot</h3>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              Decentralized reservation on Arkiv Tiramisu
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
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.85rem", textTransform: "uppercase" }}>
                {stage === "preparing" && "1/4 Verifying Slot On-Chain…"}
                {stage === "waiting_wallet" && "2/4 Waiting for MetaMask…"}
                {stage === "submitted" && "3/4 Transaction Broadcast…"}
                {stage === "indexing" && "4/4 Resolving Slot Winner…"}
                {stage === "outcome" && (isWinner ? "🎉 Booking Confirmed!" : "⚠️ Race Outcome")}
              </strong>
              {isSubmitting && <span className="chain-pulse" style={{ width: 10, height: 10 }} />}
            </div>

            <div style={{ fontSize: "0.82rem", lineHeight: 1.4 }}>
              {stage === "preparing" && "Reading live slot attributes from Arkiv…"}
              {stage === "waiting_wallet" && "Please review and approve the booking in MetaMask."}
              {stage === "submitted" && (
                <>
                  Transaction broadcast! Mined in block #{confirmedBlock?.toString() || "..."}.
                  {txHash && (
                    <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      Tx:{" "}
                      <a
                        href={getTxExplorerUrl(txHash)}
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
              {stage === "indexing" && "Indexing booking and verifying race outcome against other bids…"}
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

        {/* Form / Dialog Body */}
        {stage !== "outcome" ? (
          <div className="post-modal__body">
            {/* Slot summary card */}
            <div
              style={{
                background: "var(--c-paper-dark)",
                border: "var(--border)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <h4 style={{ margin: 0, fontSize: "1rem", fontFamily: "var(--font-display)" }}>
                {slot.title}
              </h4>
              <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "var(--c-ink)", opacity: 0.9 }}>
                <span>📍 {slot.cluster.toUpperCase()}</span>
                <span>🏷️ ₹ {slot.priceBand.toUpperCase()}</span>
                <span>⏳ {formatTimeLeft(slot.endsAt, now)} remaining</span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--c-ink)", opacity: 0.8 }}>
                Window: {formatDateTime(slot.startsAt)} — {formatDateTime(slot.endsAt)}
              </div>
            </div>

            {/* Zero payment disclaimer */}
            <div
              style={{
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid var(--c-teal)",
                padding: "10px",
                fontSize: "0.8rem",
                lineHeight: 1.4,
              }}
            >
              ℹ️ <strong>Demo Notice:</strong> No fiat or token payment is processed. Booking creates an on-chain <code>booking</code> entity on Arkiv with a 365-day lifetime referencing this slot.
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
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                id="confirm-book-slot-btn"
              >
                {isSubmitting ? "Submitting Booking…" : "Confirm Booking"}
              </button>
            </div>
          </div>
        ) : (
          /* Outcome view */
          <div className="post-modal__body" style={{ textAlign: "center", padding: "12px 0" }}>
            {isWinner ? (
              <>
                <div style={{ fontSize: "2.5rem" }}>🎉</div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "8px 0" }}>
                  You Booked This Slot!
                </h4>
                <p style={{ fontSize: "0.88rem", maxWidth: 420, margin: "0 auto 12px auto" }}>
                  Your booking was confirmed in block #{winnerBooking?.createdAtBlock?.toString() || confirmedBlock?.toString() || "..."}.
                  You are the winning buyer for this reservation.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: "2.5rem" }}>⚠️</div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "8px 0", color: "var(--c-vermilion)" }}>
                  Missed: Someone Booked First
                </h4>
                <p style={{ fontSize: "0.85rem", maxWidth: 420, margin: "0 auto 12px auto", textAlign: "left", lineHeight: 1.4 }}>
                  Another buyer's transaction was confirmed in earlier block #{winnerBooking?.createdAtBlock?.toString() || "prior"}.
                  <br /><br />
                  <strong>Arkiv Winner Rule:</strong> The earliest confirmed block wins. When two bookings occur in the same block, the lexicographically smaller entity key wins.
                </p>
              </>
            )}

            {bookingKey && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginBottom: 16 }}>
                Booking:{" "}
                <a
                  href={getEntityExplorerUrl(bookingKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--c-ink)", textDecoration: "underline" }}
                >
                  {bookingKey.slice(0, 12)}…{bookingKey.slice(-8)} ↗
                </a>
              </div>
            )}

            <div className="post-modal__footer" style={{ justifyContent: "center" }}>
              <button type="button" className="post-modal__btn" onClick={onClose} id="booking-outcome-done-btn">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
