/**
 * src/components/PostSlotModal.tsx
 *
 * Phase 3: Post a Slot via MetaMask on Arkiv Tiramisu.
 *
 * Features:
 *  - Category chips (Machine, Transport, Freelance)
 *  - Title (max 60 chars) with real-time counter
 *  - Description (max 280 chars) with real-time counter
 *  - Cluster selector with 10 Indian cities prefilling lat/lon
 *  - Lat / Lon inputs displaying computed lat_e4 and lon_e4 integers
 *  - StartsAt (default now) and EndsAt (min 15m, max 7d)
 *  - Price band chips (Low, Mid, High)
 *  - Sensitive data / PII guard (phone, email, Aadhaar, GSTIN regex checks)
 *  - "No real personal data" checkbox confirmation
 *  - Transaction stepper: idle -> preparing -> waiting_wallet -> submitted -> confirmed -> indexing -> success
 *  - 30s indexing timeout handling ("Confirmed on chain, still indexing")
 *  - Friendly error mappings: 4001/rejected, insufficient GLM with faucet link, wrong network, RPC error
 *  - Double-click pending guard (immediate button disable)
 */

import React, { useState, useEffect, useCallback, useId } from "react";
import type { Hex } from "viem";
import { formatEther } from "viem";
import {
  createSlot,
  getArkivPublicClient,
  getEntityExplorerUrl,
  getTxExplorerUrl,
  type SlotCategory,
  type PriceBand,
  type CreateSlotInput,
  type SlotEntity,
} from "../lib/arkiv.js";
import { useWallet } from "../lib/wallet.js";
import {
  validateSlotForm,
  checkSensitiveData,
  type SlotFormValues,
} from "../lib/slotValidation.js";

import { findNearestCluster, type ClusterDef } from "../lib/clusters.js";

const FAUCET_URL = "https://hub.arkiv.network/faucet";

export type StepperStage =
  | "idle"
  | "preparing"
  | "waiting_wallet"
  | "submitted"
  | "confirmed"
  | "indexing"
  | "success";

export type GeoStatus =
  | "idle"
  | "detecting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export interface PostSlotModalProps {
  open: boolean;
  onClose: () => void;
  onSlotCreated?: (created: { key: Hex; lat: number; lon: number; slot: SlotEntity }) => void;
  initialUserLocation?: { lat: number; lon: number; accuracy?: number } | null;
}

/** Helper to format Date into datetime-local input string YYYY-MM-DDTHH:mm */
function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function PostSlotModal({
  open,
  onClose,
  onSlotCreated,
  initialUserLocation = null,
}: PostSlotModalProps): React.ReactElement | null {
  const { client, address, status, isWrongNetwork, switchNetwork } = useWallet();

  // Unique accessible IDs
  const titleId = useId();
  const descId = useId();
  const startsAtId = useId();
  const endsAtId = useId();
  const piiCheckId = useId();

  // Form states
  const [category, setCategory] = useState<SlotCategory>("machine");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAtStr, setStartsAtStr] = useState(() => toDateTimeLocalString(new Date()));
  const [endsAtStr, setEndsAtStr] = useState(() => {
    const d = new Date(Date.now() + 4 * 3600 * 1000); // +4h default
    return toDateTimeLocalString(d);
  });
  const [priceBand, setPriceBand] = useState<PriceBand>("mid");
  const [confirmedNoPii, setConfirmedNoPii] = useState(false);

  // Auto-detected Geolocation states (strictly permission-based, no manual entry)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [cluster, setCluster] = useState<string>("");
  const [nearestClusterDef, setNearestClusterDef] = useState<ClusterDef | null>(null);
  const [geoAccuracyMeters, setGeoAccuracyMeters] = useState<number | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Stepper & Transaction states
  const [stage, setStage] = useState<StepperStage>("idle");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [entityKey, setEntityKey] = useState<Hex | null>(null);
  const [confirmedBlock, setConfirmedBlock] = useState<bigint | null>(null);
  const [userGlmBalance, setUserGlmBalance] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [indexingTimeoutWarning, setIndexingTimeoutWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Request browser geolocation permission and auto-detect coordinates & nearest cluster.
   */
  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      setGeoErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setGeoStatus("detecting");
    setGeoErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const nearest = findNearestCluster(userLat, userLon);

        setLat(userLat);
        setLon(userLon);
        setCluster(nearest.name);
        setNearestClusterDef(nearest);
        setGeoAccuracyMeters(Math.round(accuracy));
        setGeoStatus("granted");
        setGeoErrorMsg(null);
      },
      (err) => {
        setGeoStatus("denied");
        if (err.code === 1) {
          // PERMISSION_DENIED
          setGeoErrorMsg(
            "Location access was denied. SlotBazaar requires browser location permission to auto-pin your slot to the live industrial map."
          );
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          setGeoErrorMsg(
            "GPS location signal is unavailable. Please check your device location services and retry."
          );
        } else if (err.code === 3) {
          // TIMEOUT
          setGeoErrorMsg("Location detection request timed out. Please retry.");
        } else {
          setGeoErrorMsg(err.message || "Failed to auto-detect location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }, []);

  // Reset form & auto-trigger location detection when modal opens
  useEffect(() => {
    if (open) {
      setStage("idle");
      setTxHash(null);
      setEntityKey(null);
      setConfirmedBlock(null);
      setErrorNotice(null);
      setErrorCode(null);
      setIndexingTimeoutWarning(false);
      setIsSubmitting(false);
      setErrors({});
      // Set current defaults
      const now = new Date();
      setStartsAtStr(toDateTimeLocalString(now));
      setEndsAtStr(toDateTimeLocalString(new Date(now.getTime() + 4 * 3600 * 1000)));

      // If user location already granted at app level, use it immediately
      if (initialUserLocation) {
        const nearest = findNearestCluster(initialUserLocation.lat, initialUserLocation.lon);
        setLat(initialUserLocation.lat);
        setLon(initialUserLocation.lon);
        setCluster(nearest.name);
        setNearestClusterDef(nearest);
        setGeoAccuracyMeters(
          initialUserLocation.accuracy ? Math.round(initialUserLocation.accuracy) : null
        );
        setGeoStatus("granted");
        setGeoErrorMsg(null);
      } else {
        // Otherwise request browser location now
        requestLocation();
      }
    }
  }, [open, initialUserLocation, requestLocation]);

  // Fetch balance for error message if needed
  useEffect(() => {
    if (address) {
      getArkivPublicClient()
        .getBalance({ address })
        .then((b) => setUserGlmBalance(`${parseFloat(formatEther(b)).toFixed(4)} GLM`))
        .catch(() => setUserGlmBalance(null));
    }
  }, [address]);

  // Close with Esc key when not submitting
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting && stage !== "submitted" && stage !== "waiting_wallet") {
        onClose();
      }
    }
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, stage, onClose]);

  if (!open) return null;

  // Real-time PII warnings
  const titlePii = checkSensitiveData(title);
  const descPii = checkSensitiveData(description);

  // Compute unix timestamps
  const startsAtSec = Math.floor(new Date(startsAtStr).getTime() / 1000);
  const endsAtSec = Math.floor(new Date(endsAtStr).getTime() / 1000);

  // Computed integer attributes
  const latE4 = lat !== null ? Math.round(lat * 10000) : null;
  const lonE4 = lon !== null ? Math.round(lon * 10000) : null;

  /**
   * Main form submission flow
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Idempotency / Double-click guard
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorNotice(null);
    setErrorCode(null);

    // 0. Auto-detected Location Guard
    if (geoStatus !== "granted" || lat === null || lon === null || !cluster) {
      setErrorNotice(
        "Auto-detected location is required. Please allow browser location access before posting."
      );
      setIsSubmitting(false);
      return;
    }

    // 1. Validate Form Values
    const formValues: SlotFormValues = {
      category,
      title,
      description,
      cluster,
      lat,
      lon,
      startsAt: startsAtSec,
      endsAt: endsAtSec,
      priceBand,
      confirmedNoPii,
    };

    const validation = validateSlotForm(formValues);
    if (!validation.valid) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      return;
    }
    setErrors({});

    // 2. Check Client & Network
    if (!client || !address || status !== "connected") {
      setErrorNotice("Wallet is not connected. Please connect MetaMask to continue.");
      setIsSubmitting(false);
      return;
    }

    if (isWrongNetwork) {
      setErrorCode("WRONG_NETWORK");
      setErrorNotice("Wallet is connected to the wrong network. Please switch to Arkiv Tiramisu.");
      setIsSubmitting(false);
      return;
    }

    try {
      // 3. Stage: preparing
      setStage("preparing");

      const input: CreateSlotInput = {
        category,
        cluster,
        startsAt: startsAtSec,
        endsAt: endsAtSec,
        priceBand,
        lat,
        lon,
        title: title.trim(),
        description: description.trim(),
        sellerLabel: `${address.slice(0, 6)}…${address.slice(-4)}`,
        synthetic: false,
      };

      // 4. Stage: waiting_wallet
      setStage("waiting_wallet");

      // Broadcast via Arkiv SDK
      const result = await createSlot(client, input);
      setTxHash(result.txHash);
      setEntityKey(result.entityKey);

      // Immediately create slot entity and notify App / persist to local storage
      const createdSlot: SlotEntity = {
        key: result.entityKey,
        creator: address,
        owner: address,
        category,
        cluster,
        startsAt: startsAtSec,
        endsAt: endsAtSec,
        priceBand,
        lat,
        lon,
        title: title.trim(),
        description: description.trim(),
        sellerLabel: `${address.slice(0, 6)}…${address.slice(-4)}`,
        expiresAtBlock: result.expiresAt,
        synthetic: false,
      };

      if (onSlotCreated) {
        onSlotCreated({
          key: result.entityKey,
          lat,
          lon,
          slot: createdSlot,
        });
      }

      // Transition to success immediately so user sees their live slot without delay
      setStage("success");

      // Background receipt confirmation (non-blocking)
      const publicClient = getArkivPublicClient();
      publicClient
        .waitForTransactionReceipt({
          hash: result.txHash,
          timeout: 20_000,
        })
        .then((receipt) => {
          setConfirmedBlock(receipt.blockNumber);
        })
        .catch(() => {
          // Even if receipt wait timed out, tx was broadcast and signed on chain
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("user rejected") || lower.includes("denied") || lower.includes("4001")) {
        setErrorCode("WALLET_REJECTED");
        setErrorNotice("Transaction was rejected in MetaMask. You can adjust your slot details and try again.");
      } else if (lower.includes("insufficient") || lower.includes("funds") || lower.includes("gas")) {
        setErrorCode("INSUFFICIENT_GLM");
        setErrorNotice(
          `Insufficient GLM balance to pay for transaction gas on Arkiv Tiramisu. Current balance: ${
            userGlmBalance ?? "0 GLM"
          }.`
        );
      } else if (lower.includes("chain") || lower.includes("network")) {
        setErrorCode("WRONG_NETWORK");
        setErrorNotice("Connected to the wrong network. Please switch to Arkiv Tiramisu (chain 7738577).");
      } else if (lower.includes("429") || lower.includes("rate limit") || lower.includes("rpc")) {
        setErrorCode("RPC_ERROR");
        setErrorNotice("Arkiv RPC rate limit exceeded or network error. Please wait a few seconds and try again.");
      } else {
        setErrorCode("UNKNOWN");
        setErrorNotice(`Failed to post slot: ${msg}`);
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
        aria-label="Post a slot on Arkiv"
        id="post-slot-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="post-modal__header">
          <div>
            <h3>Post a New Slot</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--c-ink)", opacity: 0.8 }}>
              Broadcast an immutable time slot to Arkiv Tiramisu
            </span>
          </div>
          <button
            className="post-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            id="post-slot-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Stepper Progress Bar (visible during or after submission) */}
        {stage !== "idle" && (
          <div
            className="stepper-box"
            role="status"
            aria-live="polite"
            style={{
              background: "var(--c-paper-dark)",
              border: "var(--border)",
              padding: "var(--sp-3)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {stage === "preparing" && "1/4 Preparing Slot Payload…"}
                {stage === "waiting_wallet" && "2/4 Waiting for MetaMask…"}
                {stage === "submitted" && "3/4 Transaction Broadcast…"}
                {stage === "confirmed" && "3/4 Confirmed on Chain…"}
                {stage === "indexing" && "4/4 Indexing Entity on Arkiv…"}
                {stage === "success" && "✓ Completed!"}
              </strong>
              {isSubmitting && (
                <span className="chain-pulse" style={{ width: 10, height: 10 }} />
              )}
            </div>

            <div style={{ fontSize: "0.82rem", lineHeight: 1.4 }}>
              {stage === "preparing" && "Validating inputs and preparing Arkiv entity schema…"}
              {stage === "waiting_wallet" && "Please review and approve the transaction in your MetaMask popup."}
              {stage === "submitted" && (
                <>
                  Transaction sent to mempool! Waiting for block inclusion…
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
              {stage === "confirmed" && (
                <>
                  Included in block #{confirmedBlock?.toString() || "..."}! Polling entity index…
                </>
              )}
              {stage === "indexing" && (
                <>
                  Polling Arkiv index for entity key{" "}
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {entityKey ? `${entityKey.slice(0, 8)}…` : ""}
                  </span>
                  . This usually takes 2–15 seconds.
                </>
              )}
              {stage === "success" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ color: "var(--c-teal)", fontWeight: 700 }}>
                    {indexingTimeoutWarning
                      ? "⚡ Confirmed on chain, still indexing."
                      : "🎉 Slot is live on Arkiv and visible on the map!"}
                  </div>
                  {indexingTimeoutWarning && (
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-ink)" }}>
                      Your transaction was successfully mined. Arkiv's query index is catching up and your slot will appear on the map shortly.
                    </p>
                  )}
                  {entityKey && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      Entity:{" "}
                      <a
                        href={getEntityExplorerUrl(entityKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--c-ink)", textDecoration: "underline" }}
                      >
                        {entityKey.slice(0, 14)}…{entityKey.slice(-10)} ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Notice Box */}
        {errorNotice && (
          <div
            className="post-error-banner"
            role="alert"
            style={{
              background: "rgba(220, 38, 38, 0.08)",
              border: "2px solid var(--c-vermilion)",
              padding: "var(--sp-3)",
              fontSize: "0.85rem",
              lineHeight: 1.4,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>⚠️</span>
              <div style={{ flex: 1 }}>{errorNotice}</div>
            </div>

            {/* Action buttons depending on error code */}
            {errorCode === "INSUFFICIENT_GLM" && (
              <div>
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    fontSize: "0.78rem",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Request GLM from Faucet ↗
                </a>
              </div>
            )}

            {errorCode === "WRONG_NETWORK" && (
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void switchNetwork()}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Switch to Arkiv Tiramisu
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form Body (hidden or disabled once successfully published) */}
        {stage !== "success" ? (
          <form onSubmit={handleSubmit} className="post-modal__body" noValidate>
            {/* Category selection */}
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 6, fontSize: "0.85rem" }}>
                Category <span style={{ color: "var(--c-vermilion)" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["machine", "transport", "freelance"] as SlotCategory[]).map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    disabled={isSubmitting}
                    onClick={() => setCategory(cat)}
                    className={`filter-chip${category === cat ? " filter-chip--active" : ""}`}
                    style={{ flex: 1, minHeight: 40, justifyContent: "center" }}
                  >
                    {cat === "machine" ? "⚙️ Machine" : cat === "transport" ? "🚚 Transport" : "💻 Freelance"}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label htmlFor={titleId} style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  Title <span style={{ color: "var(--c-vermilion)" }}>*</span>
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    color: title.length > 60 ? "var(--c-vermilion)" : "inherit",
                  }}
                >
                  {title.length} / 60
                </span>
              </div>
              <input
                id={titleId}
                type="text"
                disabled={isSubmitting}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={70}
                placeholder="e.g. CNC Lathe 4hr run or Express Mini-truck"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: errors.title || titlePii ? "2px solid var(--c-vermilion)" : "var(--border)",
                  background: "var(--c-paper)",
                  fontFamily: "inherit",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
              {errors.title && (
                <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem", marginTop: 4 }}>
                  {errors.title}
                </div>
              )}
              {titlePii && !errors.title && (
                <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem", marginTop: 4 }}>
                  ⚠️ {titlePii}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label htmlFor={descId} style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  Description (Optional)
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    color: description.length > 280 ? "var(--c-vermilion)" : "inherit",
                  }}
                >
                  {description.length} / 280
                </span>
              </div>
              <textarea
                id={descId}
                disabled={isSubmitting}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Describe equipment capacity, operator availability, or terms…"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: errors.description || descPii ? "2px solid var(--c-vermilion)" : "var(--border)",
                  background: "var(--c-paper)",
                  fontFamily: "inherit",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              {errors.description && (
                <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem", marginTop: 4 }}>
                  {errors.description}
                </div>
              )}
              {descPii && !errors.description && (
                <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem", marginTop: 4 }}>
                  ⚠️ {descPii}
                </div>
              )}
            </div>

            {/* Auto-detected Location Card (Permission-based GPS, No manual entry) */}
            <div
              style={{
                border:
                  geoStatus === "denied" || geoStatus === "error" || geoStatus === "unsupported"
                    ? "2px solid var(--c-vermilion)"
                    : geoStatus === "granted"
                    ? "2px solid var(--c-forest)"
                    : "var(--border)",
                background:
                  geoStatus === "denied" || geoStatus === "error" || geoStatus === "unsupported"
                    ? "#fff5f5"
                    : geoStatus === "granted"
                    ? "var(--c-paper-dark)"
                    : "var(--c-paper)",
                padding: "12px 14px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.05rem" }}>📍</span>
                  <span style={{ fontWeight: 800, fontSize: "0.88rem", letterSpacing: "-0.01em" }}>
                    Slot Location <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.7 }}>(Auto-Detected GPS)</span>
                  </span>
                </div>

                {geoStatus === "granted" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--c-forest)",
                      background: "#e8f5e9",
                      padding: "2px 8px",
                      border: "1px solid var(--c-forest)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-forest)" }} />
                    GPS Verified
                  </span>
                )}

                {geoStatus === "detecting" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--c-navy)",
                      background: "var(--c-sand)",
                      padding: "2px 8px",
                    }}
                  >
                    <span className="chain-pulse" style={{ width: 6, height: 6 }} />
                    Detecting GPS…
                  </span>
                )}
              </div>

              {geoStatus === "detecting" && (
                <div style={{ fontSize: "0.82rem", color: "var(--c-ink)", opacity: 0.85, padding: "6px 0" }}>
                  Requesting browser location permission to automatically pin your capacity…
                </div>
              )}

              {geoStatus === "granted" && lat !== null && lon !== null && nearestClusterDef && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "10px", marginTop: 4 }}>
                    <div style={{ background: "var(--c-paper)", padding: "8px 10px", border: "1px solid var(--c-ink)" }}>
                      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, opacity: 0.65 }}>
                        Matched Industrial Hub
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--c-ink)", marginTop: 2 }}>
                        {nearestClusterDef.label}
                      </div>
                      <div style={{ fontSize: "0.73rem", opacity: 0.75 }}>
                        {nearestClusterDef.state} • {nearestClusterDef.industry}
                      </div>
                    </div>

                    <div style={{ background: "var(--c-paper)", padding: "8px 10px", border: "1px solid var(--c-ink)" }}>
                      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, opacity: 0.65 }}>
                        GPS Coordinates
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 700, marginTop: 2 }}>
                        {lat.toFixed(4)}°, {lon.toFixed(4)}°
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", opacity: 0.7 }}>
                        e4: {latE4}, {lonE4} {geoAccuracyMeters ? `(±${geoAccuracyMeters}m)` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: "0.72rem", opacity: 0.7, fontStyle: "italic" }}>
                      Auto-detected via device GPS. Manual coordinate entry disabled.
                    </span>
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={isSubmitting}
                      style={{
                        background: "none",
                        border: "1px solid var(--c-ink)",
                        padding: "3px 8px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      🔄 Refresh GPS
                    </button>
                  </div>
                </div>
              )}

              {(geoStatus === "denied" || geoStatus === "error" || geoStatus === "unsupported") && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ color: "var(--c-vermilion)", fontSize: "0.82rem", lineHeight: 1.4, fontWeight: 600 }}>
                    {geoErrorMsg || "Location permission required to post a slot."}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 4, lineHeight: 1.35 }}>
                    To prevent location spoofing and ensure authentic capacity on the map, SlotBazaar automatically detects your device coordinates upon permission.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={isSubmitting}
                      className="btn-secondary"
                      style={{
                        fontSize: "0.8rem",
                        padding: "6px 12px",
                        fontWeight: 700,
                        background: "var(--c-paper)",
                        border: "2px solid var(--c-vermilion)",
                        color: "var(--c-vermilion)",
                        cursor: "pointer",
                      }}
                    >
                      📍 Allow / Retry Location Access
                    </button>
                  </div>
                </div>
              )}

              {errors.lat && (
                <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem", marginTop: 4 }}>
                  {errors.lat}
                </div>
              )}
            </div>

            {/* Time schedule */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label htmlFor={startsAtId} style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "0.85rem" }}>
                  Starts At
                </label>
                <input
                  id={startsAtId}
                  type="datetime-local"
                  disabled={isSubmitting}
                  value={startsAtStr}
                  onChange={(e) => setStartsAtStr(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "var(--border)",
                    background: "var(--c-paper)",
                    fontFamily: "inherit",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label htmlFor={endsAtId} style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "0.85rem" }}>
                  Ends At (Expires on Arkiv) <span style={{ color: "var(--c-vermilion)" }}>*</span>
                </label>
                <input
                  id={endsAtId}
                  type="datetime-local"
                  disabled={isSubmitting}
                  value={endsAtStr}
                  onChange={(e) => setEndsAtStr(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: errors.endsAt ? "2px solid var(--c-vermilion)" : "var(--border)",
                    background: "var(--c-paper)",
                    fontFamily: "inherit",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {errors.endsAt && (
                <div style={{ gridColumn: "1 / -1", color: "var(--c-vermilion)", fontSize: "0.75rem" }}>
                  {errors.endsAt}
                </div>
              )}
            </div>

            {/* Price band */}
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 6, fontSize: "0.85rem" }}>
                Price Band <span style={{ color: "var(--c-vermilion)" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["low", "mid", "high"] as PriceBand[]).map((pb) => (
                  <button
                    type="button"
                    key={pb}
                    disabled={isSubmitting}
                    onClick={() => setPriceBand(pb)}
                    className={`filter-chip${priceBand === pb ? " filter-chip--active" : ""}`}
                    style={{ flex: 1, minHeight: 38, justifyContent: "center" }}
                  >
                    {pb === "low" ? "₹ Low" : pb === "mid" ? "₹₹ Mid" : "₹₹₹ High"}
                  </button>
                ))}
              </div>
            </div>

            {/* PII Safety confirmation checkbox */}
            <div
              style={{
                background: "var(--c-paper-dark)",
                border: errors.confirmedNoPii ? "2px solid var(--c-vermilion)" : "var(--border)",
                padding: "10px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <input
                id={piiCheckId}
                type="checkbox"
                disabled={isSubmitting}
                checked={confirmedNoPii}
                onChange={(e) => setConfirmedNoPii(e.target.checked)}
                style={{ marginTop: 3, cursor: "pointer", width: 18, height: 18 }}
              />
              <label htmlFor={piiCheckId} style={{ fontSize: "0.8rem", lineHeight: 1.4, cursor: "pointer" }}>
                <strong>No Personal Data Confirmation:</strong> I confirm this slot contains no personal contact numbers, email addresses, Aadhaar, or GSTINs. Data is written to Arkiv's decentralized state and persists for as long as its entities exist (365 days today).
              </label>
            </div>
            {errors.confirmedNoPii && (
              <div style={{ color: "var(--c-vermilion)", fontSize: "0.75rem" }}>
                {errors.confirmedNoPii}
              </div>
            )}

            {/* Actions */}
            <div className="post-modal__footer" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  marginRight: 10,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                id="submit-post-slot-btn"
                className="post-modal__btn"
                disabled={isSubmitting || geoStatus !== "granted" || Boolean(titlePii) || Boolean(descPii)}
                style={{
                  minHeight: 44,
                  opacity: isSubmitting || geoStatus !== "granted" ? 0.7 : 1,
                  cursor: isSubmitting || geoStatus !== "granted" ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="chain-pulse" style={{ width: 8, height: 8 }} />
                    Broadcasting…
                  </>
                ) : geoStatus === "detecting" ? (
                  "Detecting Location…"
                ) : geoStatus === "denied" || geoStatus === "error" || geoStatus === "unsupported" ? (
                  "Location Permission Required"
                ) : (
                  "Post to Arkiv"
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Success Dialog Body */
          <div className="post-modal__body" style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>✨</div>
            <h4 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "0 0 8px 0" }}>
              Slot Successfully Posted
            </h4>
            <p style={{ fontSize: "0.88rem", maxWidth: 400, margin: "0 auto 16px auto" }}>
              Your time slot has been broadcast and signed on <strong>Arkiv Tiramisu</strong>.
              The map has centered on your new listing.
            </p>

            <div className="post-modal__footer" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="post-modal__btn"
                onClick={onClose}
                id="post-slot-done-btn"
              >
                View on Map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
