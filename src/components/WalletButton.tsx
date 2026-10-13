/**
 * src/components/WalletButton.tsx
 *
 * MetaMask connection button. Displays current connection status
 * and truncated wallet address when connected.
 */

import React from "react";
import { useWallet } from "../lib/wallet.js";

/** Truncates 0xABCDE...12345 for compact display */
function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton(): React.ReactElement {
  const { status, address, connect, disconnect } = useWallet();

  if (status === "connected" && address) {
    return (
      <button
        id="wallet-btn-connected"
        className="wallet-btn wallet-btn--connected"
        onClick={disconnect}
        title={address}
        aria-label={`Connected as ${address}. Click to disconnect.`}
      >
        <span aria-hidden="true">🦊</span>
        <span className="wallet-addr">{truncateAddress(address)}</span>
      </button>
    );
  }

  if (status === "connecting") {
    return (
      <button
        id="wallet-btn-connecting"
        className="wallet-btn wallet-btn--connecting"
        disabled
        aria-label="Connecting wallet…"
      >
        <span className="spin" aria-hidden="true">⟳</span>
        Connecting…
      </button>
    );
  }

  if (status === "error") {
    return (
      <button
        id="wallet-btn-error"
        className="wallet-btn wallet-btn--error"
        onClick={() => void connect()}
        aria-label="Wallet connection failed. Click to retry."
      >
        ⚠ Retry Connect
      </button>
    );
  }

  return (
    <button
      id="wallet-btn-connect"
      className="wallet-btn wallet-btn--connect"
      onClick={() => void connect()}
      aria-label="Connect MetaMask wallet"
    >
      <span aria-hidden="true">🦊</span>
      Connect Wallet
    </button>
  );
}
