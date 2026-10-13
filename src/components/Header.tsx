/**
 * src/components/Header.tsx
 *
 * Top navigation bar — Phase 2C:
 *  - Light paper background with ink border (not black)
 *  - Hard neo-brutalist bottom shadow
 *  - Block number formatted with plain grouping (en-US, not en-IN)
 */

import React from "react";
import { useChainHead } from "../hooks/useChainHead.js";
import { WalletButton } from "./WalletButton.js";

/** Format block number with plain comma grouping, e.g. #512,496 */
function formatBlock(n: bigint): string {
  return `#${n.toLocaleString("en-US")}`;
}

export function Header(): React.ReactElement {
  const { blockNumber, loading: chainLoading, error: chainError } = useChainHead();

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
    <header className="header" role="banner">
      {/* Logo */}
      <a className="header__logo" href="/" aria-label="SlotBazaar home">
        Slot<span>Bazaar</span>
      </a>

      {/* Tagline */}
      <p className="header__tagline">
        Live India map for expiring time slots · Powered by Arkiv
      </p>

      {/* Right side */}
      <div className="header__right">
        {/* Chain liveness badge */}
        <div
          className="header__chain-badge"
          title={blockTitle}
          aria-label="Chain status"
        >
          <span
            className={`chain-pulse${chainError ? " chain-pulse--error" : ""}`}
            aria-hidden="true"
          />
          {blockLabel}
        </div>

        {/* Wallet connect */}
        <WalletButton />
      </div>
    </header>
  );
}
