/**
 * src/components/JudgePopover.tsx
 *
 * "Judges: Try this in 60 seconds" Quick Tour Popover.
 * Guides hackathon evaluators through the core decentralized loop of SlotBazaar:
 * 1. Browse active slots across clusters
 * 2. Open an on-chain Proof panel & inspect on data.arkiv.network
 * 3. Connect MetaMask (Arkiv Tiramisu Testnet)
 * 4. Post an immutable slot & watch it appear live via WebSocket
 * 5. Book from a second account
 * 6. Confirm completion both sides (seller & buyer completion entities on Arkiv)
 * 7. Inspect the two-sided on-chain verified reputation badge
 */

import React, { useRef, useEffect } from "react";
import { TIRAMISU_CHAIN_ID_DEC, TIRAMISU_CHAIN_ID_HEX } from "../lib/wallet.js";

const FAUCET_URL = "https://hub.arkiv.network/faucet";
const EXPLORER_URL = "https://data.arkiv.network/?chain=tiramisu";

export interface JudgePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSeedDemo?: () => void;
}

export function JudgePopover({
  isOpen,
  onClose,
  onOpenSeedDemo,
}: JudgePopoverProps): React.ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus management: save focus on open, restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      // Focus close button inside popover
      const closeBtn = popoverRef.current?.querySelector<HTMLButtonElement>("button");
      closeBtn?.focus();
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  // Escape key listener & outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="judge-popover-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 99990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judge-popover-title"
        id="judge-60s-popover"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          border: "1px solid #e2e8f0",
          padding: "1.5rem",
          color: "#0f172a",
          fontSize: "0.88rem",
          lineHeight: 1.5,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2
              id="judge-popover-title"
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              ⏱️ Judges: Try This in 60 Seconds
            </h2>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Quick evaluation path for the Arkiv Pre-Devcon Hackathon
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close judges guide"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* 60-Second Walkthrough Steps */}
        <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <li>
            <strong>Browse active cluster slots:</strong> Explore verified time slots across Jeedimetla, Surat, Tiruppur, Morbi, and Ludhiana on the interactive Leaflet map.
          </li>
          <li>
            <strong>Open a Proof panel & verify on Arkiv:</strong> Click any slot marker or list card. In the drawer, expand <em>"🔐 On-Chain Proof"</em> and click <strong>Explorer ↗</strong> to view the raw entity on Arkiv Tiramisu.
          </li>
          <li>
            <strong>Connect MetaMask:</strong> Click <strong>Connect Wallet</strong> (top right). Switch to Arkiv Tiramisu testnet when prompted.
          </li>
          <li>
            <strong>Post a slot & see it live:</strong> Click <strong>+ Post a slot</strong>. Submit your time window. Within measured live-update latency on localhost (8 of 10 appeared; median 2.60 s; missed events heal via 30s fallback poll), the slot appears on your screen and all open peer tabs via native Arkiv WebSocket push!
          </li>
          <li>
            <strong>Book from a second account:</strong> Switch MetaMask to Account 2. Click <strong>Book Slot</strong> to create an on-chain reservation entity tied to that slot.
          </li>
          <li>
            <strong>Two-sided completion confirmation:</strong> Both seller and buyer click <strong>Confirm Job Completion</strong>. Each submits an on-chain completion entity signed by their wallet transaction.
          </li>
          <li>
            <strong>Instant on-chain reputation:</strong> The verified job proof links both on-chain receipts symmetrically. The <strong>🏆 1 Verified Job</strong> reputation badge renders dynamically on the seller's drawer and wallet!
          </li>
        </ol>

        {/* Testnet Network & Faucet Details */}
        <div
          style={{
            marginTop: "1.2rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.35rem" }}>
            🛠️ Arkiv Tiramisu Network Parameters
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem 0.75rem", fontFamily: "var(--font-mono, monospace)" }}>
            <div><span style={{ color: "#64748b" }}>Network:</span> Arkiv Tiramisu</div>
            <div><span style={{ color: "#64748b" }}>Chain ID:</span> {TIRAMISU_CHAIN_ID_DEC} ({TIRAMISU_CHAIN_ID_HEX})</div>
            <div><span style={{ color: "#64748b" }}>Currency:</span> GLM</div>
            <div>
              <span style={{ color: "#64748b" }}>Faucet: </span>
              <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                Claim Free GLM ↗
              </a>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Explorer: </span>
              <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                data.arkiv.network ↗
              </a>
            </div>
          </div>
          <div style={{ marginTop: "0.35rem", fontSize: "0.75rem" }}>
            <span style={{ color: "#64748b" }}>RPC: </span>
            <code>https://rpc.tiramisu.db-chain.testnet.arkiv.network</code>
          </div>
        </div>

        {/* Action Bar */}
        <div
          style={{
            marginTop: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {onOpenSeedDemo && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSeedDemo();
              }}
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                color: "#166534",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              🌱 Seed Demo Slots (1 Signature)
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "#2563eb",
              border: "none",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "0.5rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Got it, let's explore!
          </button>
        </div>
      </div>
    </div>
  );
}
