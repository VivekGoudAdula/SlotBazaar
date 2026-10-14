/**
 * src/components/WalletButton.tsx
 *
 * Wallet connection button with popover help and connected account menu.
 * Adheres to Phase 2C UI layout requirements:
 *  - Not connected: opens "Connect to try SlotBazaar" 3-step popover + "?" help button
 *  - Connected: displays short address and GLM balance; popover menu with copy address,
 *    balance, "Switch to Tiramisu", and Disconnect
 *  - Outside click & Escape close handlers, focus trap, 44px touch targets
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatEther } from "viem";
import {
  useWallet,
  TIRAMISU_CHAIN_ID_DEC,
} from "../lib/wallet.js";
import { getArkivPublicClient } from "../lib/arkiv.js";

const NETWORK_DETAILS = {
  name: "Arkiv Tiramisu",
  rpc: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  chainId: String(TIRAMISU_CHAIN_ID_DEC),
  symbol: "GLM",
  explorer: "https://data.arkiv.network/?chain=tiramisu",
  faucet: "https://hub.arkiv.network/faucet",
};

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export interface WalletButtonProps {
  verifiedJobsCount?: number;
  onOpenMyJobs?: () => void;
  onOpenDemoGuide?: () => void;
}

export function WalletButton({
  verifiedJobsCount = 0,
  onOpenMyJobs,
  onOpenDemoGuide,
}: WalletButtonProps = {}): React.ReactElement {
  const {
    status,
    address,
    connect,
    disconnect,
    isWrongNetwork,
    switchNetwork,
    hasProvider,
  } = useWallet();

  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Fetch GLM Balance ─────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!address) return;
    try {
      const publicClient = getArkivPublicClient();
      const bal = await publicClient.getBalance({ address });
      const formatted = parseFloat(formatEther(bal)).toFixed(3);
      setBalance(`${formatted} GLM`);
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    if (status === "connected" && address) {
      void fetchBalance();
      const interval = setInterval(fetchBalance, 10_000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
    }
  }, [status, address, fetchBalance]);

  // ─── Listen for External Open Help Signal ──────────────────────────────────
  useEffect(() => {
    function handleOpenHelp() {
      setHelpOpen(true);
      setMenuOpen(false);
    }
    window.addEventListener("slotbazaar:open-wallet-help", handleOpenHelp);
    return () => window.removeEventListener("slotbazaar:open-wallet-help", handleOpenHelp);
  }, []);

  // ─── Outside Click & Escape Handlers ────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setHelpOpen(false);
        setMenuOpen(false);
      }
    }
    if (helpOpen || menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [helpOpen, menuOpen]);

  // ─── Copy Helper ────────────────────────────────────────────────────────────
  const copyToClipboard = useCallback((text: string, keyName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 1800);
  }, []);

  const copyAllNetworkDetails = useCallback(() => {
    const text = [
      `Network Name: ${NETWORK_DETAILS.name}`,
      `RPC URL: ${NETWORK_DETAILS.rpc}`,
      `Chain ID: ${NETWORK_DETAILS.chainId}`,
      `Currency Symbol: ${NETWORK_DETAILS.symbol}`,
      `Block Explorer: ${NETWORK_DETAILS.explorer}`,
    ].join("\n");
    copyToClipboard(text, "all");
  }, [copyToClipboard]);

  // ─── UNINSTALLED VIEW ───────────────────────────────────────────────────────
  if (!hasProvider || status === "not_installed") {
    return (
      <div className="wallet-container" ref={containerRef}>
        <a
          id="wallet-btn-install"
          className="wallet-btn wallet-btn--connect"
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Install MetaMask extension"
        >
          <span aria-hidden="true">🦊</span>
          <span>Install MetaMask ↗</span>
        </a>
      </div>
    );
  }

  // ─── CONNECTED VIEW ─────────────────────────────────────────────────────────
  if (status === "connected" && address) {
    return (
      <div className="wallet-container" ref={containerRef}>
        <button
          id="wallet-btn-connected"
          className="wallet-btn wallet-btn--connected"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-label={`Connected: ${address}. Click for account details.`}
        >
          <span aria-hidden="true">🦊</span>
          <span className="wallet-addr">{truncateAddress(address)}</span>
          {balance && <span className="wallet-balance-pill">{balance}</span>}
          {isWrongNetwork && <span className="wallet-warning-dot" title="Wrong network! Switch to Tiramisu">⚠️</span>}
        </button>

        {/* Connected Menu Popover */}
        {menuOpen && (
          <div
            className="wallet-popover wallet-popover--menu"
            role="dialog"
            aria-label="Account details"
            id="wallet-menu-popover"
          >
            <div className="wallet-popover__header">
              <span className="wallet-popover__title">Connected Account</span>
              <button
                className="wallet-popover__close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="wallet-popover__row">
              <span className="wallet-popover__label">Address:</span>
              <div className="wallet-popover__val-group">
                <code className="wallet-popover__val">{truncateAddress(address)}</code>
                <button
                  className="wallet-copy-btn"
                  onClick={() => copyToClipboard(address, "address")}
                  aria-label="Copy wallet address"
                >
                  {copiedKey === "address" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="wallet-popover__row">
              <span className="wallet-popover__label">Balance:</span>
              <span className="wallet-popover__balance">{balance ?? "Fetching…"}</span>
            </div>

            <div className="wallet-popover__row">
              <span className="wallet-popover__label">Reputation:</span>
              <span className="wallet-popover__balance" style={{ color: "var(--c-teal)", fontWeight: 700 }}>
                🏆 {verifiedJobsCount ?? 0} Verified Jobs
              </span>
            </div>

            {isWrongNetwork && (
              <div className="wallet-popover__network-alert">
                <span>Wrong network! Please switch to Tiramisu testnet.</span>
                <button
                  className="wallet-action-btn wallet-action-btn--warn"
                  onClick={switchNetwork}
                  id="wallet-switch-network-btn"
                >
                  Switch to Tiramisu
                </button>
              </div>
            )}

            <div className="wallet-popover__actions" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {onOpenMyJobs && (
                <button
                  className="wallet-action-btn wallet-action-btn--secondary"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenMyJobs();
                  }}
                  id="wallet-my-jobs-btn"
                >
                  📋 My Jobs & Proofs
                </button>
              )}

              {onOpenDemoGuide && (
                <button
                  className="wallet-action-btn wallet-action-btn--secondary"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDemoGuide();
                  }}
                  id="wallet-demo-guide-btn"
                >
                  💡 Two-Wallet Demo Guide
                </button>
              )}

              <button
                className="wallet-action-btn wallet-action-btn--secondary"
                onClick={() => {
                  disconnect();
                  setMenuOpen(false);
                }}
                id="wallet-disconnect-btn"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── DISCONNECTED / CONNECTING / ERROR VIEW ─────────────────────────────────
  return (
    <div className="wallet-container" ref={containerRef}>
      <div className="wallet-button-group">
        <button
          id="wallet-btn-connect"
          className={`wallet-btn ${status === "error" ? "wallet-btn--error" : "wallet-btn--connect"}`}
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
          aria-haspopup="dialog"
          aria-label="Connect wallet options"
          disabled={status === "connecting"}
        >
          <span aria-hidden="true">{status === "connecting" ? "⟳" : "🦊"}</span>
          <span>{status === "connecting" ? "Connecting…" : status === "error" ? "Retry Connect" : "Connect Wallet"}</span>
        </button>

        {/* Small ? help trigger button */}
        <button
          id="wallet-help-btn"
          className="wallet-help-btn"
          onClick={() => setHelpOpen((o) => !o)}
          title="Network setup & faucet help"
          aria-label="Open connection help guide"
          aria-expanded={helpOpen}
        >
          ?
        </button>
      </div>

      {/* Disconnected 3-Step Help Popover */}
      {helpOpen && (
        <div
          className="wallet-popover wallet-popover--help"
          role="dialog"
          aria-label="Connect to try SlotBazaar"
          id="wallet-help-popover"
        >
          <div className="wallet-popover__header">
            <span className="wallet-popover__title">Connect to try SlotBazaar</span>
            <button
              className="wallet-popover__close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close help"
            >
              ✕
            </button>
          </div>

          <ol className="wallet-steps">
            {/* Step 1 */}
            <li className="wallet-step">
              <div className="wallet-step__title">
                <span className="wallet-step__num">1</span>
                Get test GLM from the faucet
              </div>
              <p className="wallet-step__desc">
                Free testnet GLM is required to sign transactions and book slots.
              </p>
              <a
                href={NETWORK_DETAILS.faucet}
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-step__link"
                id="popover-faucet-link"
              >
                Arkiv Faucet ↗
              </a>
            </li>

            {/* Step 2 */}
            <li className="wallet-step">
              <div className="wallet-step__title">
                <span className="wallet-step__num">2</span>
                Add Tiramisu network details
              </div>
              <div className="network-params-box">
                <div className="network-param-row">
                  <span className="param-label">Network Name</span>
                  <div className="param-value-wrap">
                    <code>{NETWORK_DETAILS.name}</code>
                    <button
                      className="param-copy-btn"
                      onClick={() => copyToClipboard(NETWORK_DETAILS.name, "name")}
                      aria-label="Copy network name"
                    >
                      {copiedKey === "name" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="network-param-row">
                  <span className="param-label">RPC URL</span>
                  <div className="param-value-wrap">
                    <code>{NETWORK_DETAILS.rpc}</code>
                    <button
                      className="param-copy-btn"
                      onClick={() => copyToClipboard(NETWORK_DETAILS.rpc, "rpc")}
                      aria-label="Copy RPC URL"
                    >
                      {copiedKey === "rpc" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="network-param-row">
                  <span className="param-label">Chain ID</span>
                  <div className="param-value-wrap">
                    <code>{NETWORK_DETAILS.chainId}</code>
                    <button
                      className="param-copy-btn"
                      onClick={() => copyToClipboard(NETWORK_DETAILS.chainId, "chainId")}
                      aria-label="Copy Chain ID"
                    >
                      {copiedKey === "chainId" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="network-param-row">
                  <span className="param-label">Currency</span>
                  <div className="param-value-wrap">
                    <code>{NETWORK_DETAILS.symbol}</code>
                    <button
                      className="param-copy-btn"
                      onClick={() => copyToClipboard(NETWORK_DETAILS.symbol, "symbol")}
                      aria-label="Copy Symbol"
                    >
                      {copiedKey === "symbol" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="network-param-row">
                  <span className="param-label">Explorer</span>
                  <div className="param-value-wrap">
                    <code>{NETWORK_DETAILS.explorer}</code>
                    <button
                      className="param-copy-btn"
                      onClick={() => copyToClipboard(NETWORK_DETAILS.explorer, "explorer")}
                      aria-label="Copy Explorer"
                    >
                      {copiedKey === "explorer" ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>

                <button
                  className="network-copy-all-btn"
                  onClick={copyAllNetworkDetails}
                  id="wallet-copy-all-btn"
                >
                  {copiedKey === "all" ? "✓ All Copied to Clipboard" : "📋 Copy All Details"}
                </button>
              </div>
            </li>

            {/* Step 3 */}
            <li className="wallet-step">
              <div className="wallet-step__title">
                <span className="wallet-step__num">3</span>
                Connect MetaMask
              </div>
              <button
                id="popover-connect-metamask-btn"
                className="wallet-action-btn wallet-action-btn--primary"
                onClick={async () => {
                  setHelpOpen(false);
                  await connect();
                }}
              >
                🦊 Connect MetaMask
              </button>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
