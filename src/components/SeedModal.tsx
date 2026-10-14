/**
 * src/components/SeedModal.tsx
 *
 * Phase 5: In-App Seed Demo Data Modal
 *
 * Allows users to mint a batch of 6 synthetic demo time slots directly from
 * their connected MetaMask wallet on Arkiv Tiramisu using single-signature
 * wallet.executeBatch.
 *
 * Guards:
 *  - Pending double-click prevention
 *  - 40-slot live synthetic network cap
 *  - 60-second cooldown timer
 *  - Balance check (< 0.001 GLM) with faucet link
 *  - Distinct error taxonomy (rejected, insufficient funds, wrong network, RPC error, unknown)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { formatEther, type Hex, type Address } from "viem";
import {
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { str, u64, i32, bool } from "@arkiv-network/sdk/attr";
import {
  getArkivPublicClient,
  getMetaMaskWalletClient,
  PROJECT_NAMESPACE,
  SCHEMA_VERSION,
  type SlotEntity,
} from "../lib/arkiv.js";
import { useWallet } from "../lib/wallet.js";
import { generateSeedSlots, type GeneratedSlot } from "../lib/seedGenerator.js";

const COOLDOWN_KEY = "slotbazaar_last_seed_time";
const FAUCET_URL = "https://hub.arkiv.network/faucet";
const BATCH_SIZE = 6;
const ESTIMATED_BATCH_COST_GLM = "0.00086";
const MIN_REQUIRED_BALANCE_WEI = 1000000000000000n; // 0.001 GLM

export interface SeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveSlots: SlotEntity[];
  onSeedSuccess?: (createdSlots: SlotEntity[], txHash: string, elapsedMs: number) => void;
  onRefresh?: () => void;
}

export function SeedModal({
  isOpen,
  onClose,
  liveSlots,
  onSeedSuccess,
  onRefresh,
}: SeedModalProps): React.ReactElement | null {
  const { address, isWrongNetwork, switchNetwork } = useWallet();

  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceStr, setBalanceStr] = useState<string>("0.000 GLM");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTxHash, setErrorTxHash] = useState<string | null>(null);

  // Success state
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [createdKeys, setCreatedKeys] = useState<Hex[]>([]);
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number | null>(null);

  // Preview generated slots for this modal session
  const [previewSlots, setPreviewSlots] = useState<GeneratedSlot[]>([]);

  // Regenerate preview slots whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewSlots(generateSeedSlots({ count: BATCH_SIZE, includeLong: true }));
      setErrorCode(null);
      setErrorMessage(null);
      setErrorTxHash(null);
      setSuccessTxHash(null);
      setCreatedKeys([]);
      setElapsedTimeMs(null);
    }
  }, [isOpen]);

  // Count currently active synthetic slots on-chain
  const liveSyntheticCount = useMemo(() => {
    return liveSlots.filter((s) => s.synthetic).length;
  }, [liveSlots]);

  const isLimitReached = liveSyntheticCount >= 40;

  // ─── Balance Fetcher ────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!address) return;
    try {
      const publicClient = getArkivPublicClient();
      const bal = await (publicClient as any).getBalance({ address: address as Hex });
      setBalance(bal);
      setBalanceStr(`${parseFloat(formatEther(bal)).toFixed(4)} GLM`);
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    if (isOpen && address) {
      void fetchBalance();
    }
  }, [isOpen, address, fetchBalance]);

  // ─── Cooldown Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    function updateCooldown() {
      const raw = sessionStorage.getItem(COOLDOWN_KEY);
      if (!raw) {
        setCooldownSec(0);
        return;
      }
      const last = parseInt(raw, 10);
      const elapsed = Math.floor(Date.now() / 1000) - last;
      const rem = Math.max(0, 60 - elapsed);
      setCooldownSec(rem);
    }

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const hasInsufficientBalance = balance !== null && balance < MIN_REQUIRED_BALANCE_WEI;

  // ─── Execute Batch Seed Broadcast ──────────────────────────────────────────
  async function handleSeedBatch() {
    if (isSubmitting || isLimitReached || cooldownSec > 0 || hasInsufficientBalance) {
      return;
    }

    if (!address) return;

    if (isWrongNetwork) {
      await switchNetwork();
      return;
    }

    setIsSubmitting(true);
    setErrorCode(null);
    setErrorMessage(null);
    setErrorTxHash(null);

    const startTime = Date.now();
    const batchId = `ui-seed-${Math.floor(Date.now() / 1000)}`;

    try {
      const walletClient = await getMetaMaskWalletClient();

      // Convert generated slot plans to Arkiv create parameters
      const batchCreates = previewSlots.map((s) => ({
        payload: jsonToPayload({
          title: s.title,
          description: s.description,
          seller_label: s.sellerLabel,
          schema_version: 1,
        }),
        contentType: "application/json",
        attributes: {
          project: str(PROJECT_NAMESPACE),
          entity_type: str("slot"),
          schema_v: str(SCHEMA_VERSION),
          category: str(s.category),
          cluster: str(s.cluster),
          starts_at: u64(BigInt(s.startsAt)),
          ends_at: u64(BigInt(s.endsAt)),
          price_band: str(s.priceBand),
          lat_e4: i32(Math.round(s.lat * 10000)),
          lon_e4: i32(Math.round(s.lon * 10000)),
          synthetic: bool(true),
          seed_batch: str(batchId),
        },
        expires: ExpirationTime.atDate(new Date(s.endsAt * 1000)),
      }));

      // Single EVM transaction with all creates
      const batchResult = await walletClient.executeBatch({ creates: batchCreates });
      const elapsed = Date.now() - startTime;

      setSuccessTxHash(batchResult.txHash);
      setCreatedKeys(batchResult.createdEntities);
      setElapsedTimeMs(elapsed);

      // Record cooldown in sessionStorage
      sessionStorage.setItem(COOLDOWN_KEY, String(Math.floor(Date.now() / 1000)));
      setCooldownSec(60);

      // Construct SlotEntity objects for immediate client-side map fitting
      const newSlots: SlotEntity[] = previewSlots.map((s, idx) => ({
        key: batchResult.createdEntities[idx] || (`0x${idx}` as Hex),
        creator: address as Address,
        owner: address as Address,
        category: s.category,
        cluster: s.cluster,
        title: s.title,
        description: s.description,
        sellerLabel: s.sellerLabel,
        priceBand: s.priceBand,
        lat: s.lat,
        lon: s.lon,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        synthetic: true,
        seedBatch: batchId,
      }));

      if (onSeedSuccess) {
        onSeedSuccess(newSlots, batchResult.txHash, elapsed);
      }

      if (onRefresh) {
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      // Check for partial tx hash in error message
      const hashMatch = msg.match(/0x[a-fA-F0-9]{64}/);
      if (hashMatch) {
        setErrorTxHash(hashMatch[0]);
      }

      if (lower.includes("user rejected") || lower.includes("denied") || lower.includes("4001")) {
        setErrorCode("WALLET_REJECTED");
        setErrorMessage("Transaction was rejected in MetaMask. You can try again when ready.");
      } else if (lower.includes("insufficient") || lower.includes("funds") || lower.includes("gas")) {
        setErrorCode("INSUFFICIENT_GLM");
        setErrorMessage("Insufficient GLM balance to pay network fees. Get free testnet GLM from the faucet.");
      } else if (lower.includes("chain") || lower.includes("network")) {
        setErrorCode("WRONG_NETWORK");
        setErrorMessage("Please switch MetaMask to Arkiv Tiramisu (Chain ID: 7738577).");
      } else if (lower.includes("rpc") || lower.includes("429") || lower.includes("denied")) {
        setErrorCode("RPC_ERROR");
        setErrorMessage("RPC connection error. The Arkiv node refused or rate-limited the request.");
      } else {
        setErrorCode("UNKNOWN");
        setErrorMessage(`Unknown transaction outcome: ${msg}. Do not retry blindly.`);
      }
    } finally {
      setIsSubmitting(false);
      void fetchBalance();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="post-modal-backdrop" onClick={!isSubmitting ? onClose : undefined}>
      <div
        className="post-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Seed Demo Data"
        id="seed-demo-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 580, maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="post-modal__header">
          <div>
            <h2 className="post-modal__title">🌱 Seed Demo Data</h2>
            <p className="post-modal__subtitle">
              Mint verifiable synthetic time slots to test real-time map and booking flows
            </p>
          </div>
          <button
            className="post-modal__close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {successTxHash ? (
            /* Success State */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: "1rem",
                  color: "#166534",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: "0.25rem" }}>
                  🎉 Successfully Seeded {createdKeys.length} Demo Slots!
                </div>
                <div style={{ fontSize: "0.875rem", color: "#15803d" }}>
                  Batch confirmed in {elapsedTimeMs ? (elapsedTimeMs / 1000).toFixed(1) : "3.5"}s. Map
                  bounds have adjusted to showcase the new slots.
                </div>
              </div>

              <div style={{ fontSize: "0.85rem", color: "#374151" }}>
                <strong>Transaction Hash:</strong>
                <div style={{ marginTop: "0.25rem", wordBreak: "break-all", fontFamily: "monospace" }}>
                  <a
                    href={`https://data.arkiv.network/?q=${successTxHash}&chain=tiramisu`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    {successTxHash} ↗
                  </a>
                </div>
              </div>

              <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                <strong>Created Slot Entities ({createdKeys.length}):</strong>
                <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0 }}>
                  {createdKeys.map((k, i) => (
                    <li key={k} style={{ fontFamily: "monospace", fontSize: "0.78rem", marginBottom: 2 }}>
                      <a
                        href={`https://data.arkiv.network/?q=${k}&chain=tiramisu`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2563eb" }}
                      >
                        Slot #{i + 1}: {k.slice(0, 18)}… ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  className="post-modal__submit-btn"
                  onClick={onClose}
                  style={{ minWidth: 120 }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Explanation & Form */
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Architecture Explainer Box */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "0.9rem 1rem",
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.4rem" }}>
                  ℹ️ How Demo Seeding Works
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li>
                    Creates <strong>{BATCH_SIZE} synthetic slots</strong> across Indian industrial hubs,
                    signed by <strong>YOUR connected wallet</strong> in a single MetaMask batch transaction.
                  </li>
                  <li>
                    Labelled with <code>synthetic=true</code> and <code>seed_batch="ui-seed-..."</code>.
                  </li>
                  <li>
                    Slots have lifespans between <strong>30 minutes and 7 days</strong> (slots expire
                    autonomously on Arkiv by design).
                  </li>
                  <li>
                    Estimated transaction fee: <strong>~{ESTIMATED_BATCH_COST_GLM} GLM</strong> (~0.000143
                    GLM per entity).
                  </li>
                </ul>
              </div>

              {/* Wallet & Balance Status */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  background: "#f1f5f9",
                  borderRadius: 6,
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Your Wallet: </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                    {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Balance: </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: hasInsufficientBalance ? "#dc2626" : "#0f172a",
                    }}
                  >
                    {balanceStr}
                  </span>
                </div>
              </div>

              {/* Guard Warnings */}
              {isLimitReached && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "0.75rem",
                    color: "#991b1b",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ <strong>Network Limit Reached:</strong> There are already {liveSyntheticCount} live
                  synthetic slots on Arkiv Tiramisu (max 40). Please wait for active slots to expire before
                  seeding more.
                </div>
              )}

              {cooldownSec > 0 && (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    padding: "0.75rem",
                    color: "#92400e",
                    fontSize: "0.85rem",
                  }}
                >
                  ⏳ <strong>Cooldown Active:</strong> Please wait {cooldownSec}s before seeding another batch
                  to prevent mempool congestion.
                </div>
              )}

              {hasInsufficientBalance && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "0.75rem",
                    color: "#991b1b",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ <strong>Insufficient GLM:</strong> You need at least ~0.001 GLM to broadcast this batch.{" "}
                  <a
                    href={FAUCET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                  >
                    Get Free Testnet GLM ↗
                  </a>
                </div>
              )}

              {/* Error Box */}
              {errorMessage && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "0.75rem",
                    color: "#b91c1c",
                    fontSize: "0.85rem",
                  }}
                >
                  <div>❌ {errorMessage}</div>
                  {errorCode === "INSUFFICIENT_GLM" && (
                    <div style={{ marginTop: "0.4rem" }}>
                      <a
                        href={FAUCET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                      >
                        Claim free testnet GLM on the official faucet ↗
                      </a>
                    </div>
                  )}
                  {errorTxHash && (
                    <div style={{ marginTop: "0.4rem", fontFamily: "monospace" }}>
                      Tx Hash:{" "}
                      <a
                        href={`https://data.arkiv.network/?q=${errorTxHash}&chain=tiramisu`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2563eb", textDecoration: "underline" }}
                      >
                        {errorTxHash.slice(0, 16)}… ↗
                      </a>{" "}
                      (check explorer before retrying)
                    </div>
                  )}
                </div>
              )}

              {/* Preview of Slots to be Created */}
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>
                  Preview: Slots in this batch ({previewSlots.length})
                </div>
                <div
                  style={{
                    maxHeight: 160,
                    overflowY: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    background: "#ffffff",
                  }}
                >
                  {previewSlots.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.45rem 0.75rem",
                        borderBottom: idx < previewSlots.length - 1 ? "1px solid #f3f4f6" : "none",
                        fontSize: "0.8rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          [{s.clusterLabel.toUpperCase()}]
                        </span>{" "}
                        <span style={{ color: "#374151" }}>{s.title.split("] ")[1] || s.title}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span
                          style={{
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: "0.72rem",
                          }}
                        >
                          {s.durationLabel}
                        </span>
                        <span
                          style={{
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#f1f5f9",
                            color: "#475569",
                            fontSize: "0.72rem",
                          }}
                        >
                          {s.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="post-modal__cancel-btn"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="confirm-seed-demo-btn"
                  type="button"
                  className="post-modal__submit-btn"
                  onClick={handleSeedBatch}
                  disabled={
                    isSubmitting ||
                    isLimitReached ||
                    cooldownSec > 0 ||
                    hasInsufficientBalance ||
                    !address
                  }
                  style={{
                    opacity:
                      isSubmitting || isLimitReached || cooldownSec > 0 || hasInsufficientBalance || !address
                        ? 0.6
                        : 1,
                    cursor:
                      isSubmitting || isLimitReached || cooldownSec > 0 || hasInsufficientBalance || !address
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isSubmitting ? "Broadcasting Batch…" : "Broadcast 6 Demo Slots (1 Signature)"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
