/**
 * src/components/SlotDrawer.tsx
 *
 * Right-side detail drawer opened when a map marker is clicked.
 *
 * Sections:
 *  - Live countdown (vermilion <15 min)
 *  - Description
 *  - Metadata grid (category, cluster, price band, seller, start/end)
 *  - Proof panel: entity key (copyable), $creator, Entity Expiration block,
 *                 created-at block, explorer link
 *  - Action buttons (Book / Confirm Seller) — disabled with tooltip when
 *    wallet is not connected
 *
 * Phase 2 read-only: write stubs present but commented.
 */

import React, { useState, useCallback } from "react";
import type { SlotEntity } from "../lib/arkiv.js";
import { formatTimeLeft, getUrgency, formatDateTime } from "../lib/time.js";
import { useNow } from "../hooks/useNow.js";
import { useWallet } from "../lib/wallet.js";

const CATEGORY_LABELS: Record<string, string> = {
  machine:   "⚙️ Machine Hours",
  transport: "🚚 Transport",
  freelance: "💻 Freelance",
};

const PRICE_BAND_LABELS: Record<string, string> = {
  low:  "₹ Low",
  mid:  "₹₹ Mid",
  high: "₹₹₹ High",
};

const EXPLORER_BASE = "https://explorer.tiramisu.arkiv.network";

// ─────────────────────────────────────────────────────────────────────────────
// COPY BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [value]);

  return (
    <button
      className="copy-btn"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : `Copy ${label}`}
      title={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "✓ Copied" : "⎘ Copy"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotDrawerProps {
  slot: SlotEntity | null;
  onClose: () => void;
}

export function SlotDrawer({ slot, onClose }: SlotDrawerProps): React.ReactElement | null {
  const now    = useNow();
  const wallet = useWallet();

  if (!slot) return null;

  const urgency  = getUrgency(slot.endsAt, now);
  const timeLeft = formatTimeLeft(slot.endsAt, now);
  const remaining = slot.endsAt - now;
  const expired  = remaining <= 0;
  const isCritical = remaining > 0 && remaining <= 15 * 60;

  const walletConnected = wallet.status === "connected";
  const noWalletTip = "Connect MetaMask to use this action";

  const isMySlot = Boolean(
    wallet.address &&
    (slot.creator.toLowerCase() === wallet.address.toLowerCase() ||
     slot.owner.toLowerCase() === wallet.address.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-overlay"
        id="drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="drawer"
        role="complementary"
        aria-label={`Slot details: ${slot.title}`}
        id="slot-drawer"
      >
        {/* Header */}
        <div className={`drawer__header${isCritical ? " drawer__header--critical" : ""}`}>
          <button
            className="drawer__close"
            onClick={onClose}
            aria-label="Close slot details"
            id="drawer-close-btn"
          >
            ✕
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="drawer__title">{slot.title}</h2>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
              {slot.synthetic && (
                <span className="synthetic-badge">⚗ Synthetic demo data</span>
              )}
              {isMySlot && (
                <span
                  className="my-slot-badge"
                  style={{
                    background: "var(--c-marigold)",
                    color: "var(--c-ink)",
                    border: "var(--border)",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  ★ Your Slot
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="drawer__body">
          {/* ── Countdown ── */}
          <div
            className={`slot-card__countdown slot-card__countdown--${urgency}`}
            style={{ fontSize: "1rem", fontWeight: 700 }}
            aria-label={`Time remaining: ${timeLeft}`}
            aria-live="polite"
          >
            <span aria-hidden="true">
              {urgency === "critical" ? "🔴" : urgency === "urgent" ? "🟡" : "🟢"}
            </span>
            {timeLeft}
            {expired && " — Expired on Arkiv"}
          </div>

          {/* ── Description ── */}
          <section aria-labelledby="desc-label">
            <p className="drawer__section-label" id="desc-label">Description</p>
            <p className="drawer__description">
              {slot.description || "No description provided."}
            </p>
          </section>

          {/* ── Metadata grid ── */}
          <section aria-labelledby="meta-label">
            <p className="drawer__section-label" id="meta-label">Details</p>
            <div className="drawer__meta-grid">
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Category</div>
                <div className="drawer__meta-value">{CATEGORY_LABELS[slot.category] ?? slot.category}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Cluster</div>
                <div className="drawer__meta-value" style={{ textTransform: "capitalize" }}>{slot.cluster}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Price Band</div>
                <div className="drawer__meta-value">{PRICE_BAND_LABELS[slot.priceBand] ?? slot.priceBand}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Seller</div>
                <div className="drawer__meta-value">{slot.sellerLabel}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Starts At</div>
                <div className="drawer__meta-value">{formatDateTime(slot.startsAt)}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Ends At</div>
                <div className="drawer__meta-value">{formatDateTime(slot.endsAt)}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Lat / Lon</div>
                <div className="drawer__meta-value" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                  {slot.lat.toFixed(4)}, {slot.lon.toFixed(4)}
                </div>
              </div>
              {slot.synthetic && (
                <div className="drawer__meta-item">
                  <div className="drawer__meta-key">Data</div>
                  <div className="drawer__meta-value" style={{ color: "var(--c-sage)" }}>⚗ Synthetic</div>
                </div>
              )}
            </div>
          </section>

          {/* ── PROOF PANEL ── */}
          <section aria-labelledby="proof-label" className="proof-panel">
            <p className="drawer__section-label" id="proof-label">🔐 On-Chain Proof</p>

            {/* Entity Key */}
            <div className="proof-row">
              <div className="proof-key">Entity Key</div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" aria-label={`Entity key: ${slot.key}`}>
                  {slot.key}
                </div>
                <div className="proof-actions">
                  <CopyButton value={slot.key} label="entity key" />
                  <a
                    href={`${EXPLORER_BASE}/entity/${slot.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                    id="drawer-explorer-link"
                    aria-label="View on Arkiv Explorer (opens new tab)"
                  >
                    Explorer ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Creator */}
            <div className="proof-row">
              <div className="proof-key">$creator (seller)</div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" style={{ fontSize: "0.65rem" }} aria-label={`Creator: ${slot.creator}`}>
                  {slot.creator}
                  {isMySlot && (
                    <span style={{ marginLeft: 6, color: "var(--c-teal)", fontWeight: 700 }}>
                      (You)
                    </span>
                  )}
                </div>
                <CopyButton value={slot.creator} label="creator address" />
              </div>
            </div>

            {/* Entity Expiration Block */}
            {slot.expiresAtBlock !== undefined && (
              <div className="proof-row">
                <div className="proof-key">Entity Expiration Block</div>
                <div className="proof-val">#{slot.expiresAtBlock.toLocaleString()}</div>
              </div>
            )}

            {/* Created-at Block */}
            {slot.createdAtBlock !== undefined && (
              <div className="proof-row">
                <div className="proof-key">Created-at Block</div>
                <div className="proof-val">#{slot.createdAtBlock.toLocaleString()}</div>
              </div>
            )}
          </section>

          {/* ── ACTIONS ── */}
          <div className="drawer__actions">
            {expired ? (
              <p className="expired-notice">
                🔴 This slot has expired and been removed from Arkiv.
              </p>
            ) : (
              <>
                {/* Book button */}
                <div
                  title={walletConnected ? "Book this slot on-chain" : noWalletTip}
                  style={{ width: "100%" }}
                >
                  <button
                    id="drawer-book-btn"
                    className="btn-primary"
                    disabled={!walletConnected}
                    onClick={() => {
                      /* Phase 3: createBooking() */
                    }}
                    aria-label={walletConnected ? "Book this slot (on-chain)" : noWalletTip}
                    aria-disabled={!walletConnected}
                    style={{ width: "100%" }}
                  >
                    🤝 Book This Slot
                    {!walletConnected && (
                      <span className="btn-tooltip">Connect wallet first</span>
                    )}
                  </button>
                </div>

                {/* Confirm seller button */}
                <div
                  title={walletConnected ? "Mark slot as fulfilled (seller)" : noWalletTip}
                  style={{ width: "100%" }}
                >
                  <button
                    id="drawer-complete-seller-btn"
                    className="btn-secondary"
                    disabled={!walletConnected}
                    onClick={() => {
                      /* Phase 3: createCompletion("seller") */
                    }}
                    aria-label={walletConnected ? "Confirm as seller" : noWalletTip}
                    aria-disabled={!walletConnected}
                    style={{ width: "100%" }}
                  >
                    ✅ Confirm as Seller
                    {!walletConnected && (
                      <span className="btn-tooltip">Connect wallet first</span>
                    )}
                  </button>
                </div>

                {/* Wallet connect prompt */}
                {!walletConnected && (
                  <button
                    id="drawer-connect-wallet-btn"
                    className="btn-primary"
                    onClick={() => void wallet.connect()}
                    style={{ width: "100%", background: "var(--c-teal)" }}
                    aria-label="Connect MetaMask"
                  >
                    🦊 Connect Wallet
                  </button>
                )}

                <p className="drawer__footnote">
                  All actions are Arkiv transactions on Tiramisu testnet (chain 7738577).
                </p>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
