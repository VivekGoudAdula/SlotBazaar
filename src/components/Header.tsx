/**
 * src/components/Header.tsx
 *
 * Top navigation bar. Shows the logo, tagline, chain live indicator,
 * and the MetaMask wallet button.
 */

import React from "react";
import { useChainHead } from "../hooks/useChainHead.js";
import { WalletButton } from "./WalletButton.js";

export function Header(): React.ReactElement {
  const { blockNumber, loading: chainLoading, error: chainError } = useChainHead();

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

      {/* Right side controls */}
      <div className="header__right">
        {/* Chain liveness badge */}
        <div
          className="header__chain-badge"
          title={
            chainError
              ? `RPC error: ${chainError}`
              : chainLoading
              ? "Connecting to Tiramisu…"
              : `Block #${blockNumber?.toLocaleString()}`
          }
          aria-label="Chain status"
        >
          <span
            className={`chain-pulse${chainError ? " chain-pulse--error" : ""}`}
            aria-hidden="true"
          />
          {chainError
            ? "RPC err"
            : chainLoading
            ? "…"
            : `#${blockNumber?.toLocaleString()}`}
        </div>

        {/* Wallet connect */}
        <WalletButton />
      </div>
    </header>
  );
}
