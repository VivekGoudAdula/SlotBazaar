/**
 * src/lib/wallet.ts
 *
 * MetaMask connection helpers and wallet state management.
 * Provides a React context so components can read wallet state without
 * prop-drilling.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Address } from "viem";
import { getMetaMaskWalletClient, parseArkivError, type ArkivError } from "./arkiv.js";
import type { WalletArkivClient } from "@arkiv-network/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WalletState {
  status: WalletStatus;
  address: Address | null;
  client: WalletArkivClient | null;
  error: ArkivError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletState | null>(null);

/**
 * Provides MetaMask wallet state to the component tree.
 */
export function WalletProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [status, setStatus]   = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<Address | null>(null);
  const [client, setClient]   = useState<WalletArkivClient | null>(null);
  const [error, setError]     = useState<ArkivError | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const wc = await getMetaMaskWalletClient();
      // Extract address from the client's account property
      const acc = (wc as unknown as { account: { address: Address } }).account;
      setClient(wc);
      setAddress(acc?.address ?? null);
      setStatus("connected");
    } catch (err) {
      const parsed = parseArkivError(err, "WALLET_REJECTED");
      setError(parsed);
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    setStatus("disconnected");
    setAddress(null);
    setClient(null);
    setError(null);
  }, []);

  const value: WalletState = {
    status,
    address,
    client,
    error,
    connect,
    disconnect,
  };

  return React.createElement(WalletContext.Provider, { value }, children);
}

/**
 * Hook to consume wallet state from any child component.
 * Throws if used outside <WalletProvider>.
 */
export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return ctx;
}
