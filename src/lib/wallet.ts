/**
 * src/lib/wallet.ts
 *
 * Phase 3: Robust Wallet Management with EIP-6963 discovery,
 * window.ethereum fallback, live accountsChanged/chainChanged listeners,
 * and computed chain switching.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Address } from "viem";
import { custom } from "viem";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { createWalletClient, type WalletArkivClient } from "@arkiv-network/sdk";
import { parseArkivError, type ArkivError } from "./arkiv.js";

export const TIRAMISU_CHAIN_ID_DEC = 7738577;
export const TIRAMISU_CHAIN_ID_HEX = `0x${TIRAMISU_CHAIN_ID_DEC.toString(16)}`;

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EIP1193Provider;
}

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error" | "not_installed";

export interface WalletState {
  status: WalletStatus;
  address: Address | null;
  client: WalletArkivClient | null;
  error: ArkivError | null;
  chainId: string | null;
  isWrongNetwork: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<Address | null>(null);
  const [client, setClient] = useState<WalletArkivClient | null>(null);
  const [error, setError] = useState<ArkivError | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState<boolean>(true);

  const discoveredProvider = useRef<EIP1193Provider | null>(null);

  // ─── 1. EIP-6963 Discovery + window.ethereum Fallback ────────────────────────
  useEffect(() => {
    function onAnnounceProvider(event: Event) {
      const customEvent = event as CustomEvent<EIP6963ProviderDetail>;
      if (customEvent.detail?.provider) {
        discoveredProvider.current = customEvent.detail.provider;
        setHasProvider(true);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("eip6963:announceProvider", onAnnounceProvider);
      window.dispatchEvent(new Event("eip6963:requestProvider"));

      // Fallback to window.ethereum if not announced via EIP-6963
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (eth) {
        if (!discoveredProvider.current) {
          discoveredProvider.current = eth;
        }
        setHasProvider(true);
      } else if (!discoveredProvider.current) {
        setHasProvider(false);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("eip6963:announceProvider", onAnnounceProvider);
      }
    };
  }, []);

  const getProvider = useCallback((): EIP1193Provider | null => {
    if (discoveredProvider.current) return discoveredProvider.current;
    if (typeof window !== "undefined") {
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (eth) {
        discoveredProvider.current = eth;
        return eth;
      }
    }
    return null;
  }, []);

  // ─── 2. Switch to Tiramisu with 4902 Add Fallback ────────────────────────────
  const switchNetwork = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TIRAMISU_CHAIN_ID_HEX }],
      });
      setChainId(TIRAMISU_CHAIN_ID_HEX);
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      if (err.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: TIRAMISU_CHAIN_ID_HEX,
                chainName: "Arkiv Tiramisu",
                rpcUrls: ["https://rpc.tiramisu.db-chain.testnet.arkiv.network"],
                nativeCurrency: { name: "GLM", symbol: "GLM", decimals: 18 },
                blockExplorerUrls: ["https://data.arkiv.network/?chain=tiramisu"],
              },
            ],
          });
          setChainId(TIRAMISU_CHAIN_ID_HEX);
        } catch (addErr) {
          setError(parseArkivError(addErr, "WRONG_NETWORK"));
        }
      } else {
        setError(parseArkivError(switchError, "WRONG_NETWORK"));
      }
    }
  }, [getProvider]);

  // ─── 3. Connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setStatus("not_installed");
      setHasProvider(false);
      return;
    }

    setStatus("connecting");
    setError(null);

    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in wallet.");
      }

      const activeAddress = accounts[0] as Address;

      // Check chainId
      const currentChain = (await provider.request({
        method: "eth_chainId",
      })) as string;
      setChainId(currentChain);

      // Create genuine Arkiv wallet client with createEntity extensions
      const wc = createWalletClient({
        chain: tiramisu,
        transport: custom(provider),
        account: activeAddress,
      });

      setClient(wc);
      setAddress(activeAddress);
      setStatus("connected");
    } catch (err) {
      const parsed = parseArkivError(err, "WALLET_REJECTED");
      setError(parsed);
      setStatus("error");
    }
  }, [getProvider]);

  const disconnect = useCallback(() => {
    setStatus("disconnected");
    setAddress(null);
    setClient(null);
    setError(null);
  }, []);

  // ─── 4. accountsChanged and chainChanged Listeners ───────────────────────────
  useEffect(() => {
    const provider = getProvider();
    if (!provider || !provider.on) return;

    function handleAccountsChanged(accounts: unknown) {
      const accList = accounts as string[];
      if (!accList || accList.length === 0) {
        disconnect();
      } else {
        const nextAddr = accList[0] as Address;
        setAddress(nextAddr);
        setStatus("connected");
        // Reinstantiate client for new address
        if (provider) {
          const wc = createWalletClient({
            chain: tiramisu,
            transport: custom(provider),
            account: nextAddr,
          });
          setClient(wc);
        }
      }
    }

    function handleChainChanged(newChain: unknown) {
      setChainId(newChain as string);
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [getProvider, disconnect]);

  const isWrongNetwork = Boolean(
    chainId &&
      parseInt(chainId, 16) !== TIRAMISU_CHAIN_ID_DEC &&
      chainId.toLowerCase() !== TIRAMISU_CHAIN_ID_HEX.toLowerCase()
  );

  const value: WalletState = {
    status,
    address,
    client,
    error,
    chainId,
    isWrongNetwork,
    hasProvider,
    connect,
    disconnect,
    switchNetwork,
  };

  return React.createElement(WalletContext.Provider, { value }, children);
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return ctx;
}
