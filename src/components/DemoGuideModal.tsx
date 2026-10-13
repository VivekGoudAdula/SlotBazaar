/**
 * src/components/DemoGuideModal.tsx
 *
 * Phase 4: Two-Wallet Simulation Guide (Ravi & Meena story).
 *
 * Clear instructions on testing the complete cycle with two accounts:
 *  - Account 1 (Ravi - Seller): Posts a CNC or Transport slot.
 *  - Account 2 (Meena - Buyer): Books the slot, resolving the winner.
 *  - Ravi confirms job completion (seller role).
 *  - Meena confirms job completion (buyer role).
 *  - Ravi's verified reputation score increments to 1 on Arkiv.
 * Displays currently connected address clearly so the demo is unambiguous.
 */

import React from "react";
import type { Address } from "viem";

const FAUCET_URL = "https://hub.arkiv.network/faucet";

export interface DemoGuideModalProps {
  open: boolean;
  onClose: () => void;
  currentAddress: Address | null;
}

export function DemoGuideModal({
  open,
  onClose,
  currentAddress,
}: DemoGuideModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div className="post-modal-backdrop" onClick={onClose}>
      <div
        className="post-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Two-wallet demo walkthrough"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="post-modal__header">
          <div>
            <h3>Two-Wallet Demo Guide</h3>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              Ravi (Seller) & Meena (Buyer) End-to-End Simulation
            </span>
          </div>
          <button className="post-modal__close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Current Active Account Indicator */}
        <div
          style={{
            background: "var(--c-paper-dark)",
            border: "var(--border)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.85rem",
          }}
        >
          <div>
            <span style={{ opacity: 0.75 }}>Active Connected Address:</span>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginTop: 2 }}>
              {currentAddress ? `${currentAddress.slice(0, 10)}…${currentAddress.slice(-8)}` : "Not connected"}
            </div>
          </div>
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: "4px 10px", fontSize: "0.75rem", textDecoration: "none" }}
          >
            Get Faucet GLM ↗
          </a>
        </div>

        {/* Story steps */}
        <div className="post-modal__body" style={{ gap: 14 }}>
          <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5 }}>
            To experience Arkiv's decentralized booking and mutual reputation without multiple devices, use <strong>two accounts inside MetaMask</strong>:
          </p>

          {/* Step 1 */}
          <div style={{ borderLeft: "3px solid var(--c-marigold)", paddingLeft: 12 }}>
            <strong style={{ fontSize: "0.88rem" }}>Step 1: Account 1 (Ravi - Seller) Posts a Slot</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", lineHeight: 1.4, opacity: 0.9 }}>
              Click <strong>+ Post a slot</strong> in the navbar. Fill in a title (e.g. <em>"CNC Lathe 4hr batch"</em>), pick an industrial cluster like Surat or Pune, and submit. The pin appears live on the map.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ borderLeft: "3px solid var(--c-teal)", paddingLeft: 12 }}>
            <strong style={{ fontSize: "0.88rem" }}>Step 2: Switch to Account 2 (Meena - Buyer)</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", lineHeight: 1.4, opacity: 0.9 }}>
              In MetaMask, click your account avatar and switch to Account 2 (request free GLM from the faucet if empty). The SlotBazaar header updates instantly without a page reload.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ borderLeft: "3px solid var(--c-teal)", paddingLeft: 12 }}>
            <strong style={{ fontSize: "0.88rem" }}>Step 3: Meena Books the Slot</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", lineHeight: 1.4, opacity: 0.9 }}>
              Click Ravi's slot pin on the map. Click <strong>Book Slot</strong>. Approve the transaction in MetaMask. Since Meena is the first bidder, her booking wins the slot!
            </p>
          </div>

          {/* Step 4 */}
          <div style={{ borderLeft: "3px solid var(--c-marigold)", paddingLeft: 12 }}>
            <strong style={{ fontSize: "0.88rem" }}>Step 4: Ravi Confirms Job Done (Seller Role)</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", lineHeight: 1.4, opacity: 0.9 }}>
              Switch back to Account 1 (Ravi) in MetaMask. Open the booked slot drawer and click <strong>Confirm job done</strong> (Seller).
            </p>
          </div>

          {/* Step 5 */}
          <div style={{ borderLeft: "3px solid #22c55e", paddingLeft: 12 }}>
            <strong style={{ fontSize: "0.88rem" }}>Step 5: Meena Confirms Job Done (Buyer Role)</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", lineHeight: 1.4, opacity: 0.9 }}>
              Switch to Account 2 (Meena). Open the slot or <strong>My Jobs</strong> menu and click <strong>Confirm job done</strong> (Buyer).
            </p>
          </div>

          {/* Result */}
          <div
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid #22c55e",
              padding: "10px",
              fontSize: "0.82rem",
              lineHeight: 1.4,
            }}
          >
            🏆 <strong>Result:</strong> Ravi's profile and slot card now display <strong>1 Verified Job</strong> backed by the on-chain booking and two independent cryptographic signatures!
          </div>
        </div>

        <div className="post-modal__footer">
          <button type="button" className="post-modal__btn" onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
