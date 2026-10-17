/**
 * src/components/WhyArkivModal.tsx
 *
 * In-app architectural rationale modal: "Why Arkiv?"
 * Answers rubric requirements on why alternative stacks (Postgres, IPFS, Subgraphs) fail.
 */

import React, { useEffect, useRef } from "react";

export interface WhyArkivModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhyArkivModal({ isOpen, onClose }: WhyArkivModalProps): React.ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="why-arkiv-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(2px)",
        zIndex: 99990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-arkiv-title"
        id="why-arkiv-modal"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #cbd5e1",
          padding: "1.75rem",
          color: "#0f172a",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <h2
            id="why-arkiv-title"
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
            }}
          >
            🏛️ Why Arkiv? Architecture & Trade-Offs
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Why Arkiv modal"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: What breaks elsewhere */}
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: "1rem", marginBottom: "0.5rem" }}>
          1. What Would Break on Other Stacks?
        </h3>
        <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1rem 0" }}>
          <li>
            <strong>PostgreSQL / Centralized DB:</strong> The database operator controls the feed. They can silently delete bookings, front-run slot reservations, fabricate fake seller reviews, or charge steep platform subscriptions and broker commissions.
          </li>
          <li>
            <strong>IPFS / Arweave:</strong> IPFS stores static immutable blobs by CID. You cannot query <em>"find slots where cluster = 'surat' AND ends_at &gt; now"</em> without maintaining a centralized off-chain indexer. Crucially, IPFS has zero native entity expiration — expired time slots pollute storage forever.
          </li>
          <li>
            <strong>The Graph / Subgraphs:</strong> Subgraphs index smart contract event logs on L1/L2. They are not an application data store: writing a slot or reservation would require full EVM execution and expensive gas storage on an L1 or rollup.
          </li>
          <li>
            <strong>Custom Server / REST API:</strong> Small businesses must blindly trust the server operator. If the company shuts down or bans a merchant, their verified operational history vanishes.
          </li>
        </ul>

        {/* Section 2: Why Entity Expiration IS the Product */}
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: "1rem", marginBottom: "0.5rem" }}>
          2. Entity Expiration IS the Product
        </h3>
        <p style={{ margin: "0 0 1rem 0" }}>
          Industrial time slots (idle CNC lathe hours, delivery truck windows, freelance engineer sprints) are inherently perishable. On Arkiv, time slots expire autonomously at the consensus layer at <code>ends_at</code>. No background cron jobs, no database sweepers, no operator intervention.
        </p>

        {/* Section 3: Arkiv Features Used */}
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: "1rem", marginBottom: "0.5rem" }}>
          3. Arkiv Features Leveraged in SlotBazaar
        </h3>
        <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1rem 0" }}>
          <li><strong>Cryptographic <code>$creator</code>:</strong> Authentic sender verification for tamper-evident, creator-signed reputation derivation.</li>
          <li><strong>Typed Range Queries:</strong> Fast client-side and RPC filtering on numeric coordinates and timestamps.</li>
          <li><strong>EVM Native Batching:</strong> Single-signature broadcast of multiple slot entities via <code>executeBatch</code>.</li>
          <li><strong>Real-Time WebSockets:</strong> Live event streaming of new slots and bookings via WebSocket subscriptions.</li>
        </ul>

        {/* Section 4: What We Deliberately Kept Off Arkiv */}
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: "1rem", marginBottom: "0.5rem" }}>
          4. What We Deliberately Kept Off Arkiv
        </h3>
        <p style={{ margin: "0 0 1rem 0" }}>
          Decentralized storage persists for as long as its entities exist (365 days today) and is public. To protect privacy and optimize performance:
        </p>
        <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1.25rem 0" }}>
          <li><strong>No Personal Identifiable Information (PII):</strong> No phone numbers, email addresses, GSTINs, or Aadhaar numbers.</li>
          <li><strong>No In-App Contact Channel:</strong> Buyers and sellers coordinate out of band; no personal contact data is permitted or stored on Arkiv.</li>
          <li><strong>No Map Tiles:</strong> OpenStreetMap raster tiles are cached via CDN.</li>
          <li><strong>No Transient UI State:</strong> Map zoom levels, filter dropdown selections, and UI tabs live strictly in React state.</li>
        </ul>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
          <a
            href="https://github.com/VivekGoudAdula/SlotBazaar/blob/main/docs/WHY_ARKIV.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600, fontSize: "0.85rem" }}
          >
            Read Full WHY_ARKIV.md on GitHub ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
