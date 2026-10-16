/**
 * src/lib/arkiv.ts
 *
 * Phase 1: Locked Typed Read & Write Layer for SlotBazaar on Arkiv Tiramisu testnet.
 * Adheres to Arkiv SDK 0.8.x type declarations and schema v1 specification.
 */

import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  type Entity,
  type FullEntity,
  type WalletArkivClient,
  type PublicArkivClient,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool, key } from "@arkiv-network/sdk/attr";
import { eq, gt, and } from "@arkiv-network/sdk/query";
import { http, custom, webSocket, isAddress, checksumAddress, parseAbiItem, type Address, type Hex } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & NAMESPACES
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_NAMESPACE = "slotbazaar";
export const SCHEMA_VERSION = "1";

export const CATEGORIES = ["machine", "transport", "freelance"] as const;
export type SlotCategory = (typeof CATEGORIES)[number];

export const PRICE_BANDS = ["low", "mid", "high"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// 1b. AUTHORITATIVE OWNERSHIP CACHE & PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSFERRED_OWNERS_STORAGE_KEY = "slotbazaar_transferred_owners";

const inMemoryTransferredOwners = new Map<string, Address>();

function initTransferredOwners(): Map<string, Address> {
  const map = new Map<string, Address>();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(TRANSFERRED_OWNERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) {
          if (isAddress(v)) {
            map.set(k.toLowerCase(), checksumAddress(v as Address));
          }
        }
      }
    } catch {
      // Ignore JSON or localStorage exceptions
    }
  }
  return map;
}

// Populate map on module initialization
for (const [k, v] of initTransferredOwners().entries()) {
  inMemoryTransferredOwners.set(k, v);
}

/**
 * Records an authoritative transferred owner for an entity key across memory and localStorage.
 */
export function recordTransferredOwner(entityKey: Hex, newOwner: Address): void {
  const normKey = entityKey.toLowerCase();
  const cOwner = checksumAddress(newOwner);
  inMemoryTransferredOwners.set(normKey, cOwner);
  if (typeof window !== "undefined") {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of inMemoryTransferredOwners.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(TRANSFERRED_OWNERS_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Retrieves the recorded transferred owner for an entity key, if known.
 */
export function getKnownTransferredOwner(entityKey: Hex): Address | undefined {
  return inMemoryTransferredOwners.get(entityKey.toLowerCase());
}

/**
 * Returns a read-only snapshot map of all recorded transferred owners.
 */
export function getAllTransferredOwners(): Map<string, Address> {
  return new Map(inMemoryTransferredOwners);
}

/**
 * Clears the transferred owners cache (useful for isolated unit testing).
 */
export function clearTransferredOwnersCacheForTesting(): void {
  inMemoryTransferredOwners.clear();
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(TRANSFERRED_OWNERS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ERROR TAXONOMY
// ─────────────────────────────────────────────────────────────────────────────

export type ArkivErrorCode =
  | "WALLET_REJECTED"
  | "INSUFFICIENT_GLM"
  | "WRONG_NETWORK"
  | "RPC_RATE_LIMITED"
  | "RPC_DENIED"
  | "CONCURRENT_SUBMISSION"
  | "INVALID_PAYLOAD"
  | "QUERY_ERROR"
  | "UNKNOWN_WRITE_ERROR";

export class ArkivError extends Error {
  readonly code: ArkivErrorCode;
  readonly cause?: unknown;

  constructor(code: ArkivErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ArkivError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Maps raw RPC, viem, or SDK exceptions into categorized ArkivError instances.
 */
export function parseArkivError(err: unknown, defaultCode: ArkivErrorCode = "UNKNOWN_WRITE_ERROR"): ArkivError {
  if (err instanceof ArkivError) return err;

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("denied transaction") || lower.includes("code: 4001")) {
    return new ArkivError("WALLET_REJECTED", "User rejected the transaction request in wallet.", err);
  }
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance") || lower.includes("insufficient gas")) {
    return new ArkivError("INSUFFICIENT_GLM", "Insufficient GLM testnet funds to execute transaction.", err);
  }
  if (lower.includes("chain id") || lower.includes("wrong chain") || lower.includes("network mismatch")) {
    return new ArkivError("WRONG_NETWORK", "Wallet is connected to the wrong network. Expected Tiramisu (chain 7738577).", err);
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return new ArkivError("RPC_RATE_LIMITED", "Arkiv RPC rate limit exceeded. Please back off and retry.", err);
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("access denied")) {
    return new ArkivError("RPC_DENIED", "RPC access denied or unauthorized.", err);
  }

  return new ArkivError(defaultCode, msg, err);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. IDEMPOTENCY GUARD
// ─────────────────────────────────────────────────────────────────────────────

let globalWritePendingSince = 0;
let currentWriteAction: string | null = null;
const WRITE_LOCK_TIMEOUT_MS = 60_000;

function acquireWriteLock(actionName: string): void {
  const now = Date.now();
  if (globalWritePendingSince > 0 && (now - globalWritePendingSince) < WRITE_LOCK_TIMEOUT_MS) {
    throw new ArkivError(
      "CONCURRENT_SUBMISSION",
      `Cannot execute ${actionName}: an on-chain transaction (${currentWriteAction || "write"}) is currently awaiting wallet approval or confirmation on-chain.`
    );
  }
  globalWritePendingSince = now;
  currentWriteAction = actionName;
}

function releaseWriteLock(): void {
  globalWritePendingSince = 0;
  currentWriteAction = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOMAIN ENTITY INTERFACES & PAYLOAD VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotPayload {
  title: string;
  description: string;
  seller_label: string;
  schema_version: number;
}

export interface EntityCreationFlags {
  readonly: boolean;
  permissionlessExtension: boolean;
}

export interface SlotEntity {
  key: Hex;
  creator: Address;
  owner: Address;
  category: SlotCategory;
  cluster: string;
  startsAt: number; // unix seconds
  endsAt: number;   // unix seconds
  priceBand: PriceBand;
  lat: number;      // degrees
  lon: number;      // degrees
  title: string;
  description: string;
  sellerLabel: string;
  createdAtBlock?: bigint;
  expiresAtBlock?: bigint;
  creationFlags?: EntityCreationFlags;
  synthetic: boolean;
  seedBatch?: string;
}

export interface BookingPayload {
  note?: string;
  schema_version: number;
}

export interface BookingEntity {
  key: Hex;
  creator: Address;
  owner: Address;
  slotKey: Hex;
  slotCreator?: Address;
  slotStartsAt?: number;
  slotEndsAt?: number;
  bookedAt: number;
  note: string;
  createdAtBlock?: bigint;
  expiresAtBlock?: bigint;
  creationFlags?: EntityCreationFlags;
  synthetic: boolean;
  schemaVersion: number;
}

export interface CompletionPayload {
  note?: string;
  schema_version: number;
}

export interface CompletionEntity {
  key: Hex;
  creator: Address;
  owner: Address;
  bookingKey: Hex;
  slotKey?: Hex; // backwards compat for v1
  role: "seller" | "buyer";
  completedAt: number;
  note: string;
  createdAtBlock?: bigint;
  expiresAtBlock?: bigint;
  creationFlags?: EntityCreationFlags;
  synthetic: boolean;
  schemaVersion: number;
}

/**
 * Validates untrusted payload json for slot entities.
 */
export function validateSlotPayload(raw: unknown): SlotPayload {
  if (!raw || typeof raw !== "object") {
    return { title: "Untitled Slot", description: "", seller_label: "Anonymous", schema_version: 1 };
  }
  const obj = raw as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.slice(0, 80) : "Untitled Slot";
  const description = typeof obj.description === "string" ? obj.description.slice(0, 1000) : "";
  const seller_label = typeof obj.seller_label === "string" ? obj.seller_label.slice(0, 80) : "Merchant";
  const schema_version = typeof obj.schema_version === "number" ? obj.schema_version : 1;
  return { title, description, seller_label, schema_version };
}

/**
 * Validates untrusted payload json for booking entities.
 */
export function validateBookingPayload(raw: unknown): BookingPayload {
  if (!raw || typeof raw !== "object") {
    return { schema_version: 1 };
  }
  const obj = raw as Record<string, unknown>;
  const note = typeof obj.note === "string" ? obj.note.slice(0, 500) : undefined;
  const schema_version = typeof obj.schema_version === "number" ? obj.schema_version : 1;
  return { note, schema_version };
}

/**
 * Validates untrusted payload json for completion entities.
 */
export function validateCompletionPayload(raw: unknown): CompletionPayload {
  if (!raw || typeof raw !== "object") {
    return { schema_version: 1 };
  }
  const obj = raw as Record<string, unknown>;
  const note = typeof obj.note === "string" ? obj.note.slice(0, 500) : undefined;
  const schema_version = typeof obj.schema_version === "number" ? obj.schema_version : 1;
  return { note, schema_version };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CLIENT FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

function getEnvVar(key: string): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]);
    }
  } catch {}
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    if (g.process?.env?.[key]) {
      return String(g.process.env[key]);
    }
  } catch {}
  return "";
}

export function getArkivRpcUrl(): string {
  const envKey = getEnvVar("VITE_ARKIV_API_KEY") || getEnvVar("ARKIV_API_KEY");
  const envRpc = getEnvVar("VITE_RPC_URL");

  if (envRpc) {
    if (envKey && !envRpc.includes(envKey)) {
      return envRpc.replace(/\/+$/, "") + "/" + envKey;
    }
    return envRpc;
  }
  if (envKey) {
    return `https://rpc.tiramisu.db-chain.testnet.arkiv.network/${envKey}`;
  }
  return "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
}

export const DEFAULT_ARKIV_WS_RPC = "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";

export function getArkivWsUrl(): string {
  const envKey = getEnvVar("VITE_ARKIV_API_KEY") || getEnvVar("ARKIV_API_KEY");
  const envWs = getEnvVar("VITE_WS_URL");

  if (envWs) {
    if (envKey && !envWs.includes(envKey)) {
      return envWs.replace(/\/+$/, "") + "/" + envKey;
    }
    return envWs;
  }
  if (envKey) {
    return `wss://rpc.tiramisu.db-chain.testnet.arkiv.network/${envKey}`;
  }
  return DEFAULT_ARKIV_WS_RPC;
}

/**
 * Returns a public, read-only Arkiv client connected to Tiramisu testnet.
 */
export function getArkivPublicClient(rpcUrl?: string): PublicArkivClient {
  const targetUrl = rpcUrl || getArkivRpcUrl();
  return createPublicClient({
    chain: tiramisu,
    transport: http(targetUrl),
  });
}

/**
 * Returns a public WebSocket client connected to Tiramisu testnet for real-time log subscriptions.
 * Opens a real socket only with webSocket transport and no fromBlock.
 */
export function getArkivWebSocketClient(wsUrl?: string): PublicArkivClient {
  const targetUrl = wsUrl || getArkivWsUrl();
  return createPublicClient({
    chain: tiramisu,
    transport: webSocket(targetUrl),
  });
}

/**
 * Browser helper to instantiate a MetaMask-backed wallet client.
 * Does NOT invoke MetaMask accounts until explicitly called.
 */
export async function getMetaMaskWalletClient(): Promise<WalletArkivClient> {
  const eth = typeof window !== "undefined" ? (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum : undefined;
  if (!eth) {
    throw new ArkivError("WALLET_REJECTED", "MetaMask (window.ethereum) is not installed.");
  }
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new ArkivError("WALLET_REJECTED", "No Ethereum accounts authorized in wallet.");
    }
    return createWalletClient({
      chain: tiramisu,
      transport: custom(eth),
      account: accounts[0] as Address,
    });
  } catch (err) {
    throw parseArkivError(err, "WALLET_REJECTED");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ENTITY PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getAttrValue<T>(attrs: Record<string, { type: string; value: unknown }> | undefined, name: string): T | undefined {
  if (!attrs || !attrs[name]) return undefined;
  return attrs[name].value as T;
}

/**
 * Safely decodes a FullEntity or Entity query result into a typed SlotEntity.
 */
export function parseSlotEntity(entity: Entity | FullEntity): SlotEntity | null {
  try {
    if (!entity.key) return null;
    const attrs = entity.attributes as Record<string, { type: string; value: unknown }> | undefined;
    if (!attrs) return null;

    const project = getAttrValue<string>(attrs, "project");
    const entityType = getAttrValue<string>(attrs, "entity_type");
    if (project !== PROJECT_NAMESPACE || entityType !== "slot") return null;

    const rawCategory = getAttrValue<string>(attrs, "category") || "machine";
    const category: SlotCategory = (CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as SlotCategory)
      : "machine";

    const cluster = getAttrValue<string>(attrs, "cluster") || "all";
    const rawStartsAt = getAttrValue<bigint>(attrs, "starts_at");
    const startsAt = rawStartsAt ? Number(rawStartsAt) : Math.floor(Date.now() / 1000);

    const rawEndsAt = getAttrValue<bigint>(attrs, "ends_at");
    const endsAt = rawEndsAt ? Number(rawEndsAt) : startsAt + 3600;

    const rawPriceBand = getAttrValue<string>(attrs, "price_band") || "mid";
    const priceBand: PriceBand = (PRICE_BANDS as readonly string[]).includes(rawPriceBand)
      ? (rawPriceBand as PriceBand)
      : "mid";

    const rawLat = getAttrValue<number>(attrs, "lat_e4") ?? 0;
    const rawLon = getAttrValue<number>(attrs, "lon_e4") ?? 0;
    const lat = rawLat / 10000;
    const lon = rawLon / 10000;

    const synthetic = getAttrValue<boolean>(attrs, "synthetic") ?? false;
    const seedBatch = getAttrValue<string>(attrs, "seed_batch");

    let payloadJson: unknown = null;
    try {
      if (typeof entity.toJson === "function") {
        payloadJson = entity.toJson();
      }
    } catch {
      payloadJson = null;
    }
    const validated = validateSlotPayload(payloadJson);
    const keyHex = entity.key as Hex;
    const knownOwner = getKnownTransferredOwner(keyHex);
    const resolvedOwner = knownOwner
      ? knownOwner
      : entity.owner && isAddress(entity.owner)
        ? checksumAddress(entity.owner as Address)
        : ("0x0" as Address);

    const resolvedCreator = entity.creator && isAddress(entity.creator)
      ? checksumAddress(entity.creator as Address)
      : ("0x0" as Address);

    return {
      key: keyHex,
      creator: resolvedCreator,
      owner: resolvedOwner,
      category,
      cluster,
      startsAt,
      endsAt,
      priceBand,
      lat,
      lon,
      title: validated.title,
      description: validated.description,
      sellerLabel: validated.seller_label,
      createdAtBlock: entity.createdAt,
      expiresAtBlock: entity.expiresAt,
      creationFlags: entity.creationFlags
        ? {
            readonly: Boolean(entity.creationFlags.readonly),
            permissionlessExtension: Boolean(entity.creationFlags.permissionlessExtension),
          }
        : undefined,
      synthetic,
      seedBatch,
    };
  } catch {
    return null;
  }
}

export const EXCLUDED_PROBE_BATCHES = new Set([
  "dev-probe",
  "cost-measure",
  "fr005-retest",
]);

/**
 * Filter predicate that excludes automated developer probes and cost measurement entities.
 *
 * Rules (Phase 4):
 *  - Must NEVER hide a slot by title, description, or cluster (e.g. slots titled "test slot" remain visible).
 *  - Hides an entity ONLY when its `seed_batch` equals "dev-probe", "cost-measure", "fr005-retest", or starts with "t06-".
 */
export function isProductionSlot(slot: { title?: string; seedBatch?: string; cluster?: string }): boolean {
  if (!slot.seedBatch) return true;
  const b = slot.seedBatch.trim().toLowerCase();
  if (EXCLUDED_PROBE_BATCHES.has(b) || b.startsWith("t06-")) {
    return false;
  }
  return true;
}

/**
 * Safely decodes a booking entity (Schema v2 with v1 backward compatibility).
 */
export function parseBookingEntity(entity: Entity | FullEntity): BookingEntity | null {
  try {
    if (!entity.key) return null;
    const attrs = entity.attributes as Record<string, { type: string; value: unknown }> | undefined;
    if (!attrs) return null;

    const project = getAttrValue<string>(attrs, "project");
    const entityType = getAttrValue<string>(attrs, "entity_type");
    if (project !== PROJECT_NAMESPACE || entityType !== "booking") return null;

    const slotKey = getAttrValue<Hex>(attrs, "slot_key") || ("0x0" as Hex);
    const rawSlotCreator = getAttrValue<string>(attrs, "slot_creator");
    const slotCreator = rawSlotCreator ? (rawSlotCreator.toLowerCase() as Address) : undefined;
    const rawSlotStartsAt = getAttrValue<bigint>(attrs, "slot_starts_at");
    const slotStartsAt = rawSlotStartsAt !== undefined && rawSlotStartsAt !== null ? Number(rawSlotStartsAt) : undefined;
    const rawSlotEndsAt = getAttrValue<bigint>(attrs, "slot_ends_at");
    const slotEndsAt = rawSlotEndsAt ? Number(rawSlotEndsAt) : undefined;
    const rawBookedAt = getAttrValue<bigint>(attrs, "booked_at");
    const bookedAt = rawBookedAt ? Number(rawBookedAt) : Math.floor(Date.now() / 1000);
    const synthetic = getAttrValue<boolean>(attrs, "synthetic") ?? false;
    const rawSchemaV = getAttrValue<string>(attrs, "schema_v");
    const schemaVersion = rawSchemaV ? parseInt(rawSchemaV, 10) : 1;

    let payloadJson: unknown = null;
    try {
      if (typeof entity.toJson === "function") {
        payloadJson = entity.toJson();
      }
    } catch {
      payloadJson = null;
    }
    const validated = validateBookingPayload(payloadJson);

    return {
      key: entity.key as Hex,
      creator: (entity.creator || "0x0") as Address,
      owner: (entity.owner || "0x0") as Address,
      slotKey,
      slotCreator,
      slotStartsAt,
      slotEndsAt,
      bookedAt,
      note: validated.note || "",
      createdAtBlock: entity.createdAt,
      expiresAtBlock: entity.expiresAt,
      creationFlags: entity.creationFlags
        ? {
            readonly: Boolean(entity.creationFlags.readonly),
            permissionlessExtension: Boolean(entity.creationFlags.permissionlessExtension),
          }
        : undefined,
      synthetic,
      schemaVersion,
    };
  } catch {
    return null;
  }
}

/**
 * Safely decodes a completion entity (Schema v2 with v1 backward compatibility).
 */
export function parseCompletionEntity(entity: Entity | FullEntity): CompletionEntity | null {
  try {
    if (!entity.key) return null;
    const attrs = entity.attributes as Record<string, { type: string; value: unknown }> | undefined;
    if (!attrs) return null;

    const project = getAttrValue<string>(attrs, "project");
    const entityType = getAttrValue<string>(attrs, "entity_type");
    if (project !== PROJECT_NAMESPACE || entityType !== "completion") return null;

    const rawBookingKey = getAttrValue<Hex>(attrs, "booking_key");
    const rawSlotKey = getAttrValue<Hex>(attrs, "slot_key");
    const bookingKey = rawBookingKey || rawSlotKey || ("0x0" as Hex);
    const slotKey = rawSlotKey || undefined;

    const rawRole = getAttrValue<string>(attrs, "role") || "seller";
    const role: "seller" | "buyer" = rawRole === "buyer" ? "buyer" : "seller";

    const rawCompletedAt = getAttrValue<bigint>(attrs, "completed_at");
    const completedAt = rawCompletedAt ? Number(rawCompletedAt) : Math.floor(Date.now() / 1000);
    const synthetic = getAttrValue<boolean>(attrs, "synthetic") ?? false;
    const rawSchemaV = getAttrValue<string>(attrs, "schema_v");
    const schemaVersion = rawSchemaV ? parseInt(rawSchemaV, 10) : 1;

    let payloadJson: unknown = null;
    try {
      if (typeof entity.toJson === "function") {
        payloadJson = entity.toJson();
      }
    } catch {
      payloadJson = null;
    }
    const validated = validateCompletionPayload(payloadJson);

    return {
      key: entity.key as Hex,
      creator: (entity.creator || "0x0") as Address,
      owner: (entity.owner || "0x0") as Address,
      bookingKey,
      slotKey,
      role,
      completedAt,
      note: validated.note || "",
      createdAtBlock: entity.createdAt,
      expiresAtBlock: entity.expiresAt,
      creationFlags: entity.creationFlags
        ? {
            readonly: Boolean(entity.creationFlags.readonly),
            permissionlessExtension: Boolean(entity.creationFlags.permissionlessExtension),
          }
        : undefined,
      synthetic,
      schemaVersion,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. READ LAYER (QUERY FUNCTIONS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active slots from Arkiv across all pagination pages with a pinned block snapshot.
 * Results are sorted client-side by `endsAt` ascending (soonest expiring first).
 */
export async function fetchLiveSlots(client: PublicArkivClient = getArkivPublicClient()): Promise<SlotEntity[]> {
  try {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("slot")),
        gt("ends_at", u64(nowSec))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const seenKeys = new Set<string>();
    const slots: SlotEntity[] = [];
    for (const raw of allRaw) {
      const normKey = (raw.key || "").toLowerCase();
      if (!normKey || seenKeys.has(normKey)) continue;
      seenKeys.add(normKey);

      const parsed = parseSlotEntity(raw);
      if (parsed && isProductionSlot(parsed)) slots.push(parsed);
    }

    // Client-side sort: earliest expiring first, canonical key tie-break
    slots.sort((a, b) => {
      if (a.endsAt !== b.endsAt) return a.endsAt - b.endsAt;
      return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
    });
    return slots;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches active slots filtered by cluster (e.g., 'surat', 'mumbai').
 */
export async function fetchSlotsByCluster(cluster: string, client: PublicArkivClient = getArkivPublicClient()): Promise<SlotEntity[]> {
  try {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("slot")),
        eq("cluster", str(cluster)),
        gt("ends_at", u64(nowSec))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const slots: SlotEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseSlotEntity(raw);
      if (parsed) slots.push(parsed);
    }

    slots.sort((a, b) => a.endsAt - b.endsAt);
    return slots;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches active slots filtered by category ('machine' | 'transport' | 'freelance').
 */
export async function fetchSlotsByCategory(category: SlotCategory, client: PublicArkivClient = getArkivPublicClient()): Promise<SlotEntity[]> {
  try {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("slot")),
        eq("category", str(category)),
        gt("ends_at", u64(nowSec))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const slots: SlotEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseSlotEntity(raw);
      if (parsed) slots.push(parsed);
    }

    slots.sort((a, b) => a.endsAt - b.endsAt);
    return slots;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches all slots created by a specific wallet address.
 */
export async function fetchSlotsByCreator(creator: Address, client: PublicArkivClient = getArkivPublicClient()): Promise<SlotEntity[]> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("slot"))
      ))
      .createdBy(creator)
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const slots: SlotEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseSlotEntity(raw);
      if (parsed) slots.push(parsed);
    }

    slots.sort((a, b) => a.endsAt - b.endsAt);
    return slots;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches a single slot entity by key, trying active live slots first,
 * then falling back to an unconstrained project query (for expired slots).
 */
export async function getSlotEntity(
  slotKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<SlotEntity | null> {
  const normKey = slotKey.toLowerCase();

  // 1. Direct state lookup via getEntity (fast & never hangs on SQL indexer)
  try {
    const raw = await client.getEntity(slotKey);
    if (raw) {
      const parsed = parseSlotEntity(raw);
      if (parsed) return parsed;
    }
  } catch {
    // fallback
  }

  // 2. Fallback to cached query with strict timeout
  try {
    const live = await Promise.race([
      fetchLiveSlots(client),
      new Promise<SlotEntity[]>((_, rej) => setTimeout(() => rej(new Error("Timeout")), 3000)),
    ]);
    const found = live.find((s) => s.key.toLowerCase() === normKey);
    if (found) return found;
  } catch {
    // fallback
  }

  return null;
}

/**
 * Fetches ALL bookings for project=slotbazaar in a single batch query (no N+1).
 */
export async function fetchAllBookings(
  client: PublicArkivClient = getArkivPublicClient()
): Promise<BookingEntity[]> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("booking"))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const seenKeys = new Set<string>();
    const bookings: BookingEntity[] = [];
    for (const raw of allRaw) {
      const normKey = (raw.key || "").toLowerCase();
      if (!normKey || seenKeys.has(normKey)) continue;
      seenKeys.add(normKey);

      const parsed = parseBookingEntity(raw);
      if (parsed) bookings.push(parsed);
    }
    return bookings;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches ALL completions for project=slotbazaar in a single batch query (no N+1).
 */
export async function fetchAllCompletions(
  client: PublicArkivClient = getArkivPublicClient()
): Promise<CompletionEntity[]> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("completion"))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const seenKeys = new Set<string>();
    const completions: CompletionEntity[] = [];
    for (const raw of allRaw) {
      const normKey = (raw.key || "").toLowerCase();
      if (!normKey || seenKeys.has(normKey)) continue;
      seenKeys.add(normKey);

      const parsed = parseCompletionEntity(raw);
      if (parsed) completions.push(parsed);
    }
    return completions;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Pure function: Sorts bookings for a single slot to determine the winning booking.
 * Earliest createdAtBlock wins. Tie-break: lexicographically smaller entity key (lowercase).
 */
export function getWinningBooking(bookings: BookingEntity[]): BookingEntity | null {
  if (!bookings || bookings.length === 0) return null;

  const sorted = [...bookings].sort((a, b) => {
    const blockA = a.createdAtBlock ?? 0n;
    const blockB = b.createdAtBlock ?? 0n;
    if (blockA !== blockB) {
      return blockA < blockB ? -1 : 1;
    }
    return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
  });

  return sorted[0];
}

/**
 * Fetches bookings for a specific slot and determines the winner.
 */
export async function fetchBookingsForSlot(
  slotKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<{ winner: BookingEntity | null; all: BookingEntity[] }> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("booking")),
        eq("slot_key", key(slotKey))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const bookings: BookingEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseBookingEntity(raw);
      if (parsed) bookings.push(parsed);
    }

    const winner = getWinningBooking(bookings);
    return { winner, all: bookings };
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches all completion records for a given slot or booking.
 */
export async function fetchCompletionsForSlot(
  slotKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<CompletionEntity[]> {
  try {
    const all = await fetchAllCompletions(client);
    const norm = slotKey.toLowerCase();
    return all.filter((c) => (c.slotKey && c.slotKey.toLowerCase() === norm) || c.bookingKey.toLowerCase() === norm);
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches completions specifically referencing a booking_key.
 */
export async function fetchCompletionsForBooking(
  bookingKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<CompletionEntity[]> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("completion")),
        eq("booking_key", key(bookingKey))
      ))
      .fetch();

    const allRaw: Entity[] = [...page.entities];
    while (page.hasNextPage()) {
      page = await page.next();
      allRaw.push(...page.entities);
    }

    const completions: CompletionEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseCompletionEntity(raw);
      if (parsed) completions.push(parsed);
    }
    return completions;
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7a. REPUTATION HELPERS (pure functions, testable without chain)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies whether a single slot / booking qualifies as a "completed job" for reputation.
 *
 * All Phase 4 rules MUST hold:
 *   (a) A winning booking exists, and the winning booking's creator is NOT
 *       the same as the slot's creator (blocks self-booking fraud).
 *   (b) A seller completion exists whose creator equals the slot creator.
 *   (c) A buyer completion exists whose creator equals the winning booking's creator.
 *   (d) The booking is the winning booking for the slot.
 *   (e) Completions occurred at or after slot.startsAt (if startsAt is known).
 *
 * Duplicate completions do NOT double-count.
 */
export function verifyJobCompletion(
  slot: { key: Hex; creator: Address; startsAt?: number },
  winner: BookingEntity | null,
  completions: CompletionEntity[]
): { winner: BookingEntity; seller: CompletionEntity; buyer: CompletionEntity } | null {
  if (!winner) return null;

  const slotCreator = (winner.slotCreator || slot.creator).toLowerCase();
  const winnerCreator = winner.creator.toLowerCase();

  // (a) Winning booking creator must NOT be the slot creator
  if (winnerCreator === slotCreator) return null;

  const winnerKey = winner.key.toLowerCase();
  const slotKey = slot.key.toLowerCase();

  // (e) Effective startsAt: fallback to winner.slotStartsAt when slot has expired
  const effectiveStartsAt = winner.slotStartsAt ?? slot.startsAt;

  // Find completions matching this booking or legacy slot key
  const matchingCompletions = completions.filter((c) => {
    const bKey = (c.bookingKey || "").toLowerCase();
    const sKey = (c.slotKey || "").toLowerCase();
    return bKey === winnerKey || sKey === slotKey;
  });

  // (b) Seller completion: role == "seller" && creator == slotCreator
  // (e) Completion before slot start rejected
  const sellerCompletion = matchingCompletions.find((c) => {
    if (c.role !== "seller") return false;
    if (c.creator.toLowerCase() !== slotCreator) return false;
    if (effectiveStartsAt !== undefined && c.completedAt < effectiveStartsAt) return false;
    return true;
  });
  if (!sellerCompletion) return null;

  // (c) Buyer completion: role == "buyer" && creator == winnerCreator
  // (e) Completion before slot start rejected
  const buyerCompletion = matchingCompletions.find((c) => {
    if (c.role !== "buyer") return false;
    if (c.creator.toLowerCase() !== winnerCreator) return false;
    if (effectiveStartsAt !== undefined && c.completedAt < effectiveStartsAt) return false;
    return true;
  });
  if (!buyerCompletion) return null;

  return { winner, seller: sellerCompletion, buyer: buyerCompletion };
}

export interface ReputationProof {
  slotKey: Hex;
  bookingKey: Hex;
  seller: Address;
  buyer: Address;
  sellerCompletionKey: Hex;
  buyerCompletionKey: Hex;
}

export interface ReputationResult {
  verifiedJobsCount: number;
  verifiedSlotKeys: Hex[];
  verifiedBookingKeys: Hex[];
  proofs: ReputationProof[];
}

/**
 * Computes an account's verified reputation score.
 * Pure synchronous version accepts data arrays; async version queries Arkiv.
 */
export function getReputation(
  account: Address,
  slots: Array<{ key: Hex; creator: Address; startsAt?: number }>,
  bookings: BookingEntity[],
  completions: CompletionEntity[]
): ReputationResult;
export function getReputation(
  account: Address,
  client?: PublicArkivClient
): Promise<ReputationResult>;
export function getReputation(
  account: Address,
  arg2?: PublicArkivClient | Array<{ key: Hex; creator: Address; startsAt?: number }>,
  bookings?: BookingEntity[],
  completions?: CompletionEntity[]
): ReputationResult | Promise<ReputationResult> {
  if (Array.isArray(arg2)) {
    const normAccount = account.toLowerCase();
    const slots = arg2;
    const allBookings = bookings ?? [];
    const allCompletions = completions ?? [];

    const bookingsBySlot = new Map<string, BookingEntity[]>();
    for (const b of allBookings) {
      const sKey = b.slotKey.toLowerCase();
      const list = bookingsBySlot.get(sKey) ?? [];
      list.push(b);
      bookingsBySlot.set(sKey, list);
    }

    const verifiedSlotKeys = new Set<Hex>();
    const verifiedBookingKeys = new Set<Hex>();
    const proofs: ReputationProof[] = [];

    for (const [, slotBookings] of bookingsBySlot.entries()) {
      const winner = getWinningBooking(slotBookings);
      if (!winner) continue;

      const slotMatch = slots.find((s) => s.key.toLowerCase() === winner.slotKey.toLowerCase());
      const slotCreator = (winner.slotCreator || slotMatch?.creator || "0x0").toLowerCase();
      const buyer = winner.creator.toLowerCase();

      // Skip self-booking
      if (slotCreator === buyer) continue;

      // Only evaluate if this account participated as seller or buyer
      if (slotCreator !== normAccount && buyer !== normAccount) {
        continue;
      }

      const verified = verifyJobCompletion(
        {
          key: winner.slotKey,
          creator: (slotMatch?.creator || winner.slotCreator || "0x0") as Address,
          startsAt: slotMatch?.startsAt ?? winner.slotStartsAt,
        },
        winner,
        allCompletions
      );

      if (verified) {
        verifiedSlotKeys.add(winner.slotKey);
        verifiedBookingKeys.add(winner.key);
        proofs.push({
          slotKey: winner.slotKey,
          bookingKey: winner.key,
          seller: verified.seller.creator,
          buyer: verified.buyer.creator,
          sellerCompletionKey: verified.seller.key,
          buyerCompletionKey: verified.buyer.key,
        });
      }
    }

    return {
      verifiedJobsCount: proofs.length,
      verifiedSlotKeys: Array.from(verifiedSlotKeys),
      verifiedBookingKeys: Array.from(verifiedBookingKeys),
      proofs,
    };
  }

  const client = (arg2 as PublicArkivClient) ?? getArkivPublicClient();
  return (async () => {
    try {
      const [allSlots, allBookings, allCompletions] = await Promise.all([
        fetchLiveSlots(client),
        fetchAllBookings(client),
        fetchAllCompletions(client),
      ]);
      return getReputation(account, allSlots, allBookings, allCompletions);
    } catch (err) {
      throw parseArkivError(err, "QUERY_ERROR");
    }
  })();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7b. DERIVED BOOKING STATE & LIFECYCLE (pure function, source of truth: Arkiv)
// ─────────────────────────────────────────────────────────────────────────────

export type SlotBookingStatus = "AVAILABLE" | "BOOKED" | "EXPIRED" | "COMPLETED";

/**
 * Derives the authoritative 4-state lifecycle status for a slot.
 * Source of truth: Real Arkiv listing, booking, and completion entities.
 *
 * States:
 * - "COMPLETED": A winning booking exists and both seller and buyer have confirmed completion on Arkiv.
 * - "BOOKED": A winning booking exists on Arkiv (capacity window claimed; single-use capacity locked).
 * - "EXPIRED": No winning booking exists and the slot's availability deadline (endsAt) has elapsed.
 * - "AVAILABLE": No winning booking exists and the slot's availability deadline (endsAt) is in the future.
 */
export function getSlotBookingStatus(
  slot: { key: Hex; creator: Address; endsAt: number; startsAt?: number },
  winningBooking: BookingEntity | null | undefined,
  completions: CompletionEntity[] = [],
  nowSec: number = Math.floor(Date.now() / 1000)
): SlotBookingStatus {
  if (winningBooking) {
    const verified = verifyJobCompletion(slot, winningBooking, completions);
    if (verified) {
      return "COMPLETED";
    }
    return "BOOKED";
  }
  if (slot.endsAt <= nowSec) {
    return "EXPIRED";
  }
  return "AVAILABLE";
}

// ─────────────────────────────────────────────────────────────────────────────
// 7c. DETERMINISTIC RECONCILIATION PIPELINE (PURE FUNCTIONS)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReconcileSlotsOptions {
  /** Fresh, authoritative entities returned by the Arkiv SDK query across all pages.
   * If undefined, indicates an RPC query failure, timeout, or rate-limit. */
  authoritativeSlots?: SlotEntity[];
  /** Locally cached entities from previous state or localStorage. */
  cachedSlots?: SlotEntity[];
  /** Baseline seed listings (e.g. getBaseOnChainSlots()). */
  baseSlots?: SlotEntity[];
  /** Current Unix timestamp in seconds (defaults to Math.floor(Date.now() / 1000)). */
  nowSec?: number;
}

/**
 * Pure, deterministic reconciliation pipeline for public marketplace listings.
 *
 * Guarantees:
 * 1. Canonical Entity Key Deduplication: Entities are keyed strictly by lowercase hex (slot.key.toLowerCase()).
 * 2. Authoritative Precedence: When authoritativeSlots is present, its on-chain attributes (owner, endsAt, etc.)
 *    supersede cached or baseline attributes, while respecting known transferred owners (getKnownTransferredOwner).
 * 3. Failure Resiliency: If authoritativeSlots is undefined (e.g. RPC timeout or 429), existing cached records
 *    are NEVER erased or reduced to a smaller subset; they are preserved.
 * 4. Deterministic Seed Persistence: Baseline demo records are incorporated if not expired and not overridden.
 * 5. Deterministic Ordering: Listings are sorted primarily by endsAt ascending, with canonical key ascending as tie-breaker.
 */
export function reconcileSlots({
  authoritativeSlots,
  cachedSlots = [],
  baseSlots = [],
  nowSec = Math.floor(Date.now() / 1000),
}: ReconcileSlotsOptions): SlotEntity[] {
  const slotMap = new Map<string, SlotEntity>();

  // 1. Authoritative on-chain slots have highest precedence
  if (authoritativeSlots) {
    for (const s of authoritativeSlots) {
      if (s.endsAt > nowSec && isProductionSlot(s)) {
        const normKey = s.key.toLowerCase();
        const knownOwner = getKnownTransferredOwner(s.key as Hex);
        slotMap.set(normKey, {
          ...s,
          owner: knownOwner ? knownOwner : s.owner,
        });
      }
    }
  }

  // 2. Preserved cached slots
  // If authoritativeSlots was supplied, cached slots provide local un-indexed listings without overriding authoritative properties.
  // If authoritativeSlots was undefined (query failed), cached slots preserve the full known dataset.
  for (const s of cachedSlots) {
    if (s.endsAt > nowSec && isProductionSlot(s)) {
      const normKey = s.key.toLowerCase();
      if (!slotMap.has(normKey)) {
        const knownOwner = getKnownTransferredOwner(s.key as Hex);
        slotMap.set(normKey, {
          ...s,
          owner: knownOwner ? knownOwner : s.owner,
        });
      }
    }
  }

  // 3. Baseline deterministic seed slots
  for (const s of baseSlots) {
    if (s.endsAt > nowSec && isProductionSlot(s)) {
      const normKey = s.key.toLowerCase();
      if (!slotMap.has(normKey)) {
        const knownOwner = getKnownTransferredOwner(s.key as Hex);
        slotMap.set(normKey, {
          ...s,
          owner: knownOwner ? knownOwner : s.owner,
        });
      }
    }
  }

  // 4. Deterministic sort: earliest expiry first, canonical key tie-break
  return Array.from(slotMap.values()).sort((a, b) => {
    if (a.endsAt !== b.endsAt) {
      return a.endsAt - b.endsAt;
    }
    return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
  });
}

export interface ReconcileBookingsOptions {
  authoritativeBookings?: BookingEntity[];
  cachedBookings?: BookingEntity[];
}

export function reconcileBookings({
  authoritativeBookings,
  cachedBookings = [],
}: ReconcileBookingsOptions): BookingEntity[] {
  const bookingMap = new Map<string, BookingEntity>();

  if (authoritativeBookings) {
    for (const b of authoritativeBookings) {
      bookingMap.set(b.key.toLowerCase(), b);
    }
  }

  for (const b of cachedBookings) {
    const normKey = b.key.toLowerCase();
    if (!bookingMap.has(normKey)) {
      bookingMap.set(normKey, b);
    }
  }

  return Array.from(bookingMap.values()).sort((a, b) => {
    const blockA = a.createdAtBlock ?? 0n;
    const blockB = b.createdAtBlock ?? 0n;
    if (blockA !== blockB) {
      return blockA < blockB ? -1 : 1;
    }
    return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
  });
}

export interface ReconcileCompletionsOptions {
  authoritativeCompletions?: CompletionEntity[];
  cachedCompletions?: CompletionEntity[];
}

export function reconcileCompletions({
  authoritativeCompletions,
  cachedCompletions = [],
}: ReconcileCompletionsOptions): CompletionEntity[] {
  const completionMap = new Map<string, CompletionEntity>();

  if (authoritativeCompletions) {
    for (const c of authoritativeCompletions) {
      completionMap.set(c.key.toLowerCase(), c);
    }
  }

  for (const c of cachedCompletions) {
    const normKey = c.key.toLowerCase();
    if (!completionMap.has(normKey)) {
      completionMap.set(normKey, c);
    }
  }

  return Array.from(completionMap.values()).sort((a, b) =>
    a.key.toLowerCase().localeCompare(b.key.toLowerCase())
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. WRITE LAYER (MUTATION FUNCTIONS WITH IDEMPOTENCY)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSlotInput {
  category: SlotCategory;
  cluster: string;
  startsAt: number; // unix seconds
  endsAt: number;   // unix seconds
  priceBand: PriceBand;
  lat: number;      // decimal degrees
  lon: number;      // decimal degrees
  title: string;
  description: string;
  sellerLabel: string;
  synthetic?: boolean;
}

export interface CreateSlotOutput {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
}

/**
 * Creates a new slot entity on Arkiv Tiramisu.
 * Calculates Entity Expiration strictly from `endsAt`.
 * Guarded against concurrent execution.
 */
export async function createSlot(
  wallet: WalletArkivClient,
  input: CreateSlotInput
): Promise<CreateSlotOutput> {
  acquireWriteLock("createSlot");
  try {
    const latE4 = Math.round(input.lat * 10000);
    const lonE4 = Math.round(input.lon * 10000);
    const synthetic = input.synthetic ?? false;

    const payloadObj: SlotPayload = {
      title: input.title.slice(0, 80),
      description: input.description.slice(0, 1000),
      seller_label: input.sellerLabel.slice(0, 80),
      schema_version: 1,
    };

    const expires = ExpirationTime.atDate(new Date(input.endsAt * 1000));

    const result = await wallet.createEntity({
      payload: jsonToPayload(payloadObj),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT_NAMESPACE),
        entity_type: str("slot"),
        schema_v: str(SCHEMA_VERSION),
        category: str(input.category),
        cluster: str(input.cluster),
        starts_at: u64(BigInt(input.startsAt)),
        ends_at: u64(BigInt(input.endsAt)),
        price_band: str(input.priceBand),
        lat_e4: i32(latE4),
        lon_e4: i32(lonE4),
        synthetic: bool(synthetic),
      },
      flags: { readonly: true },
      expires,
    });

    return {
      entityKey: result.entityKey as Hex,
      txHash: result.txHash as Hex,
      expiresAt: result.expiresAt,
    };
  } catch (err) {
    throw parseArkivError(err, "UNKNOWN_WRITE_ERROR");
  } finally {
    releaseWriteLock();
  }
}

export interface CreateBookingInput {
  slotKey: Hex;
  slotCreator?: Address;
  slotStartsAt?: number;
  slotEndsAt?: number;
  note?: string;
  synthetic?: boolean;
}

export interface CreateBookingOutput {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
}

/**
 * Creates a booking entity on Arkiv Tiramisu (Schema v2).
 *
 * Booking Integrity & Concurrency Rules:
 * 1. Preflight on-chain verification:
 *    - Rejects expired slots (endsAt <= nowSec)
 *    - Rejects seller or current owner attempting to book their own slot
 *    - Queries Arkiv for existing bookings linked to slotKey; rejects if an active booking exists
 * 2. Protocol-level Concurrency:
 *    - Arkiv SDK does not provide cross-wallet compare-and-set or unique constraints for custom attributes.
 *    - If two wallets query simultaneously before either booking is confirmed on-chain, both may broadcast a tx.
 *    - The protocol deterministically resolves concurrency via block consensus:
 *      Earliest confirmed block wins (createdAtBlock ascending). Ties broken lexicographically by entityKey.
 *    - Only the winning booking is eligible to confirm completion and earn two-sided reputation.
 * 3. Lifecycle & Release Rules:
 *    - Industrial capacity windows in SlotBazaar are strictly single-use. Once booked, a capacity window
 *      cannot be re-booked a second time, even after completion.
 *    - Counterparty booking records are created with flags: { readonly: true } and cannot be silently
 *      released or deleted by client state. Sellers with recurring capacity must issue a new listing entity.
 */
export async function createBooking(
  wallet: WalletArkivClient,
  input: CreateBookingInput,
  publicClient: PublicArkivClient = getArkivPublicClient()
): Promise<CreateBookingOutput> {
  acquireWriteLock("createBooking");
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    let slotCreator = input.slotCreator;
    let slotStartsAt = input.slotStartsAt;
    let slotEndsAt = input.slotEndsAt;
    let slotOwner: Address | undefined;

    // 1. Resolve slot details from on-chain if missing or unverified
    const slot = await getSlotEntity(input.slotKey, publicClient);
    if (slot) {
      slotCreator = slot.creator;
      slotStartsAt = slot.startsAt;
      slotEndsAt = slot.endsAt;
      slotOwner = slot.owner;
    }

    if (!slotCreator || !slotEndsAt || slotStartsAt === undefined) {
      throw new ArkivError(
        "INVALID_PAYLOAD",
        `Cannot book slot: target slot entity ${input.slotKey} details could not be resolved.`
      );
    }

    // 2. Reject expired slot
    if (slotEndsAt <= nowSec) {
      throw new ArkivError(
        "INVALID_PAYLOAD",
        `Cannot book expired slot ${input.slotKey}: availability deadline passed at ${new Date(slotEndsAt * 1000).toISOString()}.`
      );
    }

    // 3. Reject seller or owner booking their own slot
    const walletAddr = wallet.account?.address?.toLowerCase();
    if (walletAddr) {
      if (walletAddr === slotCreator.toLowerCase() || (slotOwner && walletAddr === slotOwner.toLowerCase())) {
        throw new ArkivError(
          "INVALID_PAYLOAD",
          "Sellers and listing owners cannot book their own slot."
        );
      }
    }

    // 4. Preflight on-chain query: Check for existing active booking on Arkiv
    const existing = await fetchBookingsForSlot(input.slotKey, publicClient);
    if (existing.winner || existing.all.length > 0) {
      throw new ArkivError(
        "CONCURRENT_SUBMISSION",
        `Slot ${input.slotKey} already has an active booking on Arkiv (winner: ${existing.winner?.key ?? existing.all[0].key}). Competing bookings are rejected.`
      );
    }

    const bookedAt = Math.floor(Date.now() / 1000);
    const synthetic = input.synthetic ?? false;

    const payloadObj: BookingPayload = {
      note: input.note?.slice(0, 500),
      schema_version: 2,
    };

    // Booking lives for 30 days
    const expiryDate = new Date(Date.now() + 30 * 86400 * 1000);
    const expires = ExpirationTime.atDate(expiryDate);

    const result = await wallet.createEntity({
      payload: jsonToPayload(payloadObj),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT_NAMESPACE),
        entity_type: str("booking"),
        schema_v: str("2"),
        slot_key: key(input.slotKey),
        slot_creator: str(slotCreator.toLowerCase()),
        slot_starts_at: u64(BigInt(slotStartsAt)),
        slot_ends_at: u64(BigInt(slotEndsAt)),
        booked_at: u64(BigInt(bookedAt)),
        synthetic: bool(synthetic),
      },
      flags: { readonly: true },
      expires,
    });

    return {
      entityKey: result.entityKey as Hex,
      txHash: result.txHash as Hex,
      expiresAt: result.expiresAt,
    };
  } catch (err) {
    throw parseArkivError(err, "UNKNOWN_WRITE_ERROR");
  } finally {
    releaseWriteLock();
  }
}

export interface CreateCompletionInput {
  bookingKey: Hex;
  role: "seller" | "buyer";
  note?: string;
  synthetic?: boolean;
}

export interface CreateCompletionOutput {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
}

/**
 * Creates a completion entity on Arkiv Tiramisu (Schema v2).
 * Points to booking_key (not slot_key) with a 30-day expiry matching booking,
 * allowing completion to be submitted AFTER the slot itself has expired.
 */
export async function createCompletion(
  wallet: WalletArkivClient,
  input: CreateCompletionInput
): Promise<CreateCompletionOutput> {
  acquireWriteLock("createCompletion");
  try {
    const completedAt = Math.floor(Date.now() / 1000);
    const synthetic = input.synthetic ?? false;

    const payloadObj: CompletionPayload = {
      note: input.note?.slice(0, 500),
      schema_version: 2,
    };

    // Completions match booking 30-day lifecycle
    const expiryDate = new Date(Date.now() + 30 * 86400 * 1000);
    const expires = ExpirationTime.atDate(expiryDate);

    const result = await wallet.createEntity({
      payload: jsonToPayload(payloadObj),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT_NAMESPACE),
        entity_type: str("completion"),
        schema_v: str("2"),
        booking_key: key(input.bookingKey),
        role: str(input.role),
        completed_at: u64(BigInt(completedAt)),
        synthetic: bool(synthetic),
      },
      flags: { readonly: true, permissionlessExtension: true },
      expires,
    });

    return {
      entityKey: result.entityKey as Hex,
      txHash: result.txHash as Hex,
      expiresAt: result.expiresAt,
    };
  } catch (err) {
    throw parseArkivError(err, "UNKNOWN_WRITE_ERROR");
  } finally {
    releaseWriteLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8a. PERMISSIONLESS EXTENSION (COMPLETION / REPUTATION EVIDENCE)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtendProofOutput {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
}

/**
 * Publicly extends the storage lifetime of an Arkiv entity on Tiramisu.
 * Designed for immutable completion/reputation evidence entities created with
 * flags: { readonly: true, permissionlessExtension: true }.
 *
 * Verifies that the entity exists and has permissionlessExtension enabled before
 * submitting the transaction via the connected wallet.
 *
 * Note: Extending an Arkiv entity preserves on-chain data availability; it does NOT
 * reopen or modify the underlying job or capacity availability window.
 */
export async function extendProofEntity(
  wallet: WalletArkivClient,
  entityKey: Hex,
  daysFromNow: number = 60,
  publicClient: PublicArkivClient = getArkivPublicClient()
): Promise<ExtendProofOutput> {
  // 1. Read and validate entity flags first (without locking write mutex)
  let entity: FullEntity;
  try {
    entity = await publicClient.getEntity(entityKey);
  } catch {
    throw new ArkivError(
      "QUERY_ERROR",
      `Target entity ${entityKey} could not be found or has already expired on Arkiv.`
    );
  }

  if (!entity.creationFlags?.permissionlessExtension) {
    throw new ArkivError(
      "INVALID_PAYLOAD",
      `Entity ${entityKey} was not created with permissionlessExtension: true.`
    );
  }

  // 2. Acquire lock strictly for the wallet transaction
  acquireWriteLock("extendProofEntity");
  try {
    const expires = ExpirationTime.fromDays(daysFromNow);
    const result = await wallet.extendEntity({
      entityKey,
      expires,
    });

    return {
      entityKey: result.entityKey,
      txHash: result.txHash as Hex,
      expiresAt: result.expiresAt,
    };
  } catch (err) {
    throw parseArkivError(err, "UNKNOWN_WRITE_ERROR");
  } finally {
    releaseWriteLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b. OWNERSHIP TRANSFER (ARKIV-NATIVE CHANGE OWNERSHIP)
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferOwnershipOutput {
  entityKey: Hex;
  newOwner: Address;
  txHash: Hex;
}

/**
 * Transfers ownership of an Arkiv entity to a new recipient address.
 * Invokes the real Arkiv SDK changeOwnership action via the connected wallet.
 *
 * The original creator ($creator) remains permanent and immutable, while the new
 * address becomes the current owner ($owner).
 */
export async function transferEntityOwnership(
  wallet: WalletArkivClient,
  entityKey: Hex,
  newOwner: Address
): Promise<TransferOwnershipOutput> {
  if (!isAddress(newOwner)) {
    throw new ArkivError(
      "INVALID_PAYLOAD",
      `Invalid recipient address format: "${newOwner}". Must be a valid 42-character 0x EVM address.`
    );
  }

  acquireWriteLock("transferEntityOwnership");
  try {
    const result = await wallet.changeOwnership({
      entityKey,
      newOwner: newOwner as Hex,
    });

    const cOwner = checksumAddress(newOwner);
    recordTransferredOwner(entityKey, cOwner);

    return {
      entityKey: result.entityKey,
      newOwner: cOwner,
      txHash: result.txHash as Hex,
    };
  } catch (err) {
    throw parseArkivError(err, "UNKNOWN_WRITE_ERROR");
  } finally {
    releaseWriteLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8c. AUTHORITATIVE ON-CHAIN ENTITY VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export const ARKIV_ADDRESS = "0x4400000000000000000000000000000000000044" as const;

export interface AuthoritativeEntityState {
  key: Hex;
  owner: Address;
  creator?: Address;
  creationFlags?: EntityCreationFlags;
  verifiedOnChain: boolean;
  source: "sdk_entity" | "onchain_event" | "cache_fallback";
}

/**
 * Fetches the authoritative, on-chain entity owner and metadata.
 *
 * Strategy:
 *  1. Query Arkiv SDK `client.getEntity(entityKey)` which reads authoritative `$owner` and `$creator`.
 *  2. If Arkiv query RPC is rate-limited (HTTP 429 ANON_COST_LIMITED) or encounters a transient issue,
 *     fall back to querying EVM event logs directly on ARKIV_ADDRESS (OwnershipTransferred and EntityCreated).
 *  3. Fallback to cached known transfer if network is unavailable.
 */
export async function fetchAuthoritativeEntityOwner(
  entityKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<AuthoritativeEntityState> {
  // 1. Primary: Arkiv SDK authoritative entity fetch
  try {
    const ent = await client.getEntity(entityKey);
    if (ent && ent.owner && isAddress(ent.owner)) {
      const owner = checksumAddress(ent.owner as Address);
      const creator = ent.creator && isAddress(ent.creator) ? checksumAddress(ent.creator as Address) : undefined;
      recordTransferredOwner(entityKey, owner);
      return {
        key: entityKey,
        owner,
        creator,
        creationFlags: ent.creationFlags
          ? {
              readonly: Boolean(ent.creationFlags.readonly),
              permissionlessExtension: Boolean(ent.creationFlags.permissionlessExtension),
            }
          : undefined,
        verifiedOnChain: true,
        source: "sdk_entity",
      };
    }
  } catch {
    // If rate-limited or indexing in progress, proceed to on-chain event log verification
  }

  // 2. Secondary: Direct on-chain EVM event logs via standard eth_getLogs on Arkiv contract
  try {
    const [transferLogs, createdLogs] = await Promise.all([
      client.getLogs({
        address: ARKIV_ADDRESS,
        event: parseAbiItem(
          "event OwnershipTransferred(bytes32 indexed entityKey, address indexed previousOwner, address indexed newOwner)"
        ),
        args: { entityKey },
        fromBlock: 0x90000n,
      }).catch(() => []),
      client.getLogs({
        address: ARKIV_ADDRESS,
        event: parseAbiItem(
          "event EntityCreated(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt, uint8 creationFlags)"
        ),
        args: { entityKey },
        fromBlock: 0x90000n,
      }).catch(() => []),
    ]);

    let creator: Address | undefined;
    if (createdLogs && createdLogs.length > 0 && createdLogs[0].args?.owner) {
      creator = checksumAddress(createdLogs[0].args.owner);
    }

    if (transferLogs && transferLogs.length > 0) {
      const latest = transferLogs[transferLogs.length - 1];
      if (latest.args?.newOwner) {
        const owner = checksumAddress(latest.args.newOwner);
        recordTransferredOwner(entityKey, owner);
        return {
          key: entityKey,
          owner,
          creator,
          verifiedOnChain: true,
          source: "onchain_event",
        };
      }
    } else if (creator) {
      // Created on-chain, not transferred
      return {
        key: entityKey,
        owner: creator,
        creator,
        verifiedOnChain: true,
        source: "onchain_event",
      };
    }
  } catch {
    // Direct event log query failed
  }

  // 3. Tertiary: Cached known transfer fallback
  const cachedOwner = getKnownTransferredOwner(entityKey);
  if (cachedOwner) {
    return {
      key: entityKey,
      owner: cachedOwner,
      verifiedOnChain: false,
      source: "cache_fallback",
    };
  }

  throw new ArkivError(
    "QUERY_ERROR",
    `Could not authoritatively verify owner for entity ${entityKey}.`
  );
}

/**
 * Canonical Arkiv Data Explorer URL for entities.
 */
export function getEntityExplorerUrl(entityKey: string): string {
  return `https://data.arkiv.network/?q=${entityKey}&chain=tiramisu`;
}

/**
 * Canonical Arkiv Block Explorer URL for transactions.
 */
export function getTxExplorerUrl(txHash: string): string {
  return `https://tiramisu.explorer.arkiv.network/tx/${txHash}`;
}

/**
 * Base home URL for Arkiv Data Explorer on Tiramisu.
 */
export const ARKIV_EXPLORER_HOME_URL = "https://data.arkiv.network/?chain=tiramisu";

