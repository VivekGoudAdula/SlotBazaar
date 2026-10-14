/**
 * src/components/Header.tsx
 *
 * Top navigation bar — Phase 2C:
 *  - Light paper background with ink border (sticky)
 *  - Wordmark "SlotBazaar" + small tagline
 *  - Block pill (#517,006 plain grouping)
 *  - "Post a slot" button (enabled only when connected)
 *  - WalletButton
 */

import React from "react";
import logoIcon from "../assets/logo.png";
import { useChainHead } from "../hooks/useChainHead.js";
import { useWallet } from "../lib/wallet.js";
import { WalletButton } from "./WalletButton.js";

/** Format block number with plain comma grouping, e.g. #517,006 */
function formatBlock(n: bigint): string {
  return `#${n.toLocaleString("en-US")}`;
}

export interface HeaderProps {
  onPostSlot?: () => void;
  onSeedDemo?: () => void;
  onOpenJudgesGuide?: () => void;
  verifiedJobsCount?: number;
  onOpenMyJobs?: () => void;
  onOpenDemoGuide?: () => void;
  isSocketHealthy?: boolean;
  lastFetched?: Date | null;
}

export function Header({
  onPostSlot,
  onSeedDemo,
  onOpenJudgesGuide,
  verifiedJobsCount,
  onOpenMyJobs,
  onOpenDemoGuide,
  isSocketHealthy = false,
  lastFetched,
}: HeaderProps): React.ReactElement {
  const { blockNumber, loading: chainLoading, error: chainError } = useChainHead();
  const { status, address, isWrongNetwork, hasProvider } = useWallet();

  const isConnectedOnTiramisu = status === "connected" && Boolean(address) && !isWrongNetwork;

  const postSlotTitle = !hasProvider
    ? "Install MetaMask to post a slot"
    : status !== "connected" || !address
    ? "Connect wallet to post a slot"
    : isWrongNetwork
    ? "Switch to Arkiv Tiramisu to post a slot"
    : "Post a new slot to Arkiv";

  const blockLabel = chainError
    ? "RPC err"
    : chainLoading || blockNumber == null
    ? "…"
    : formatBlock(blockNumber);

  const lastUpdatedStr = lastFetched
    ? lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const blockTitle = chainError
    ? `RPC error: ${chainError}`
    : chainLoading || blockNumber == null
    ? "Connecting to Tiramisu…"
    : `Block ${formatBlock(blockNumber)} · ${isSocketHealthy ? "WebSocket LIVE" : "POLLING"} · Tiramisu testnet${lastUpdatedStr ? ` (Updated ${lastUpdatedStr})` : ""}`;

  const handleSeedClick = () => {
    if (!isConnectedOnTiramisu) {
      window.dispatchEvent(new CustomEvent("slotbazaar:open-wallet-help"));
    } else if (onSeedDemo) {
      onSeedDemo();
    }
  };

  return (
    <header className="header" role="banner" id="app-header">
      {/* Left: Brand */}
      <div className="header__brand">
        <a className="header__logo" href="/" aria-label="SlotBazaar home" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <img
            src={logoIcon}
            alt="SlotBazaar Logo"
            width={32}
            height={32}
            style={{ height: "32px", width: "auto", objectFit: "contain", display: "inline-block" }}
          />
          <span>Slot<span>Bazaar</span></span>
        </a>
      </div>

      {/* Right: Controls */}
      <div className="header__right">
        {/* Block head & WebSocket status pill */}
        <div
          className="header__chain-badge"
          title={blockTitle}
          aria-label={`Chain status: ${blockLabel}. ${lastUpdatedStr ? `Data updated at ${lastUpdatedStr}` : ""}`}
          id="header-block-pill"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <span
            className={`chain-pulse${chainError ? " chain-pulse--error" : ""}`}
            style={isSocketHealthy ? { backgroundColor: "#10b981", boxShadow: "0 0 6px #10b981" } : undefined}
            aria-hidden="true"
          />
          <span style={{ fontWeight: 600, color: "#1e293b" }}>{blockLabel}</span>
          <span
            className={`socket-status-pill socket-status-pill--${isSocketHealthy ? "live" : "polling"}`}
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "4px",
              letterSpacing: "0.04em",
              backgroundColor: isSocketHealthy ? "#dcfce7" : "#fef3c7",
              color: isSocketHealthy ? "#15803d" : "#b45309",
              border: `1px solid ${isSocketHealthy ? "#86efac" : "#fde68a"}`,
            }}
          >
            {isSocketHealthy ? "LIVE" : "POLLING"}
          </span>
          {lastUpdatedStr && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#64748b",
                marginLeft: "2px",
                fontFamily: "var(--font-mono, monospace)",
              }}
              title={`Last RPC response received at ${lastUpdatedStr}`}
            >
              {lastUpdatedStr}
            </span>
          )}
        </div>

        {/* Judges: 60-Second Quick Tour */}
        {onOpenJudgesGuide && (
          <button
            id="header-judges-guide-btn"
            type="button"
            className="header__judges-btn"
            onClick={onOpenJudgesGuide}
            title="Judges: Try this in 60 seconds (evaluation path)"
            aria-label="Judges 60-second walkthrough"
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              fontWeight: 600,
              fontSize: "0.8rem",
              borderRadius: "6px",
              padding: "5px 10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ⏱️ 60s Tour
          </button>
        )}

        {/* Secondary: Seed demo data button */}
        <button
          id="header-seed-demo-btn"
          className="header__seed-btn"
          onClick={handleSeedClick}
          title={
            !isConnectedOnTiramisu
              ? "Connect wallet on Arkiv Tiramisu to seed demo data"
              : "Mint synthetic demo slots across Indian clusters"
          }
          aria-label="Seed demo data"
        >
          🌱 Seed demo data
        </button>

        {/* Post a slot button */}
        <button
          id="header-post-slot-btn"
          className="header__post-btn"
          disabled={!isConnectedOnTiramisu}
          onClick={onPostSlot}
          title={postSlotTitle}
          aria-label="Post a slot"
        >
          + Post a slot
        </button>

        {/* Wallet Connect & Help */}
        <WalletButton
          verifiedJobsCount={verifiedJobsCount}
          onOpenMyJobs={onOpenMyJobs}
          onOpenDemoGuide={onOpenDemoGuide}
        />
      </div>
    </header>
  );
}
