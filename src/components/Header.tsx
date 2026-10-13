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
import { useChainHead } from "../hooks/useChainHead.js";
import { useWallet } from "../lib/wallet.js";
import { WalletButton } from "./WalletButton.js";

/** Format block number with plain comma grouping, e.g. #517,006 */
function formatBlock(n: bigint): string {
  return `#${n.toLocaleString("en-US")}`;
}

export interface HeaderProps {
  onPostSlot?: () => void;
  verifiedJobsCount?: number;
  onOpenMyJobs?: () => void;
  onOpenDemoGuide?: () => void;
}

export function Header({
  onPostSlot,
  verifiedJobsCount,
  onOpenMyJobs,
  onOpenDemoGuide,
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

  const blockTitle = chainError
    ? `RPC error: ${chainError}`
    : chainLoading || blockNumber == null
    ? "Connecting to Tiramisu…"
    : `Block ${formatBlock(blockNumber)} · Tiramisu testnet`;

  return (
    <header className="header" role="banner" id="app-header">
      {/* Left: Brand */}
      <div className="header__brand">
        <a className="header__logo" href="/" aria-label="SlotBazaar home">
          Slot<span>Bazaar</span>
        </a>
        <span className="header__tagline">
          Live India map for expiring time slots
        </span>
      </div>

      {/* Right: Controls */}
      <div className="header__right">
        {/* Block head pill */}
        <div
          className="header__chain-badge"
          title={blockTitle}
          aria-label="Chain status"
          id="header-block-pill"
        >
          <span
            className={`chain-pulse${chainError ? " chain-pulse--error" : ""}`}
            aria-hidden="true"
          />
          {blockLabel}
        </div>

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
