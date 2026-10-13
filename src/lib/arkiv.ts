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
import { http, custom, type Address, type Hex } from "viem";

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

let isGlobalWritePending = false;

function acquireWriteLock(actionName: string): void {
  if (isGlobalWritePending) {
    throw new ArkivError(
      "CONCURRENT_SUBMISSION",
      `Cannot execute ${actionName}: an on-chain transaction is already in progress.`
    );
  }
  isGlobalWritePending = true;
}

function releaseWriteLock(): void {
  isGlobalWritePending = false;
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
  bookedAt: number;
  note: string;
  createdAtBlock?: bigint;
  expiresAtBlock?: bigint;
  synthetic: boolean;
}

export interface CompletionPayload {
  note?: string;
  schema_version: number;
}

export interface CompletionEntity {
  key: Hex;
  creator: Address;
  owner: Address;
  slotKey: Hex;
  role: "seller" | "buyer";
  completedAt: number;
  note: string;
  createdAtBlock?: bigint;
  expiresAtBlock?: bigint;
  synthetic: boolean;
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

/**
 * Returns a public, read-only Arkiv client connected to Tiramisu testnet.
 */
export function getArkivPublicClient(rpcUrl?: string): PublicArkivClient {
  return createPublicClient({
    chain: tiramisu,
    transport: http(rpcUrl),
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

    return {
      key: entity.key as Hex,
      creator: (entity.creator || "0x0") as Address,
      owner: (entity.owner || "0x0") as Address,
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
      synthetic,
      seedBatch,
    };
  } catch {
    return null;
  }
}

/**
 * Filter predicate that excludes test probes and cost measurement entities.
 * Excludes entities where seed_batch starts with "test" or "cost",
 * title starts with "cost-test" or "test", or cluster is "test".
 * Documented in schema.md.
 */
export function isProductionSlot(slot: { title: string; seedBatch?: string; cluster?: string }): boolean {
  const t = slot.title.trim().toLowerCase();
  if (t.startsWith("test") || t.startsWith("cost-test") || t.startsWith("cost_test")) return false;
  if (slot.seedBatch) {
    const b = slot.seedBatch.trim().toLowerCase();
    if (b.startsWith("test") || b.startsWith("cost")) return false;
  }
  if (slot.cluster?.trim().toLowerCase() === "test") return false;
  return true;
}

/**
 * Safely decodes a booking entity.
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
    const rawBookedAt = getAttrValue<bigint>(attrs, "booked_at");
    const bookedAt = rawBookedAt ? Number(rawBookedAt) : Math.floor(Date.now() / 1000);
    const synthetic = getAttrValue<boolean>(attrs, "synthetic") ?? false;

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
      bookedAt,
      note: validated.note || "",
      createdAtBlock: entity.createdAt,
      expiresAtBlock: entity.expiresAt,
      synthetic,
    };
  } catch {
    return null;
  }
}

/**
 * Safely decodes a completion entity.
 */
export function parseCompletionEntity(entity: Entity | FullEntity): CompletionEntity | null {
  try {
    if (!entity.key) return null;
    const attrs = entity.attributes as Record<string, { type: string; value: unknown }> | undefined;
    if (!attrs) return null;

    const project = getAttrValue<string>(attrs, "project");
    const entityType = getAttrValue<string>(attrs, "entity_type");
    if (project !== PROJECT_NAMESPACE || entityType !== "completion") return null;

    const slotKey = getAttrValue<Hex>(attrs, "slot_key") || ("0x0" as Hex);
    const rawRole = getAttrValue<string>(attrs, "role") || "seller";
    const role: "seller" | "buyer" = rawRole === "buyer" ? "buyer" : "seller";

    const rawCompletedAt = getAttrValue<bigint>(attrs, "completed_at");
    const completedAt = rawCompletedAt ? Number(rawCompletedAt) : Math.floor(Date.now() / 1000);
    const synthetic = getAttrValue<boolean>(attrs, "synthetic") ?? false;

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
      slotKey,
      role,
      completedAt,
      note: validated.note || "",
      createdAtBlock: entity.createdAt,
      expiresAtBlock: entity.expiresAt,
      synthetic,
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

    const slots: SlotEntity[] = [];
    for (const raw of allRaw) {
      const parsed = parseSlotEntity(raw);
      if (parsed && isProductionSlot(parsed)) slots.push(parsed);
    }

    // Client-side sort: earliest expiring first
    slots.sort((a, b) => a.endsAt - b.endsAt);
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
 * Fetches bookings for a slot and determines the winning booking.
 * Winner rule: Earliest creation block (`createdAtBlock`) wins.
 * Tie-break within same block: Lexicographically smaller `key` wins.
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

    if (bookings.length === 0) {
      return { winner: null, all: [] };
    }

    // Sort: earliest block first. If block matches, compare entity key string.
    bookings.sort((a, b) => {
      const blockA = a.createdAtBlock ?? 0n;
      const blockB = b.createdAtBlock ?? 0n;
      if (blockA !== blockB) {
        return blockA < blockB ? -1 : 1;
      }
      return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
    });

    return { winner: bookings[0], all: bookings };
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
}

/**
 * Fetches all completion records for a given slot.
 */
export async function fetchCompletionsForSlot(
  slotKey: Hex,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<CompletionEntity[]> {
  try {
    let page = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("completion")),
        eq("slot_key", key(slotKey))
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
 * Verifies whether a single slot qualifies as a "completed job" for reputation.
 *
 * All three conditions MUST hold:
 *   (a) A winning booking exists, and the winning booking's creator is NOT
 *       the same as the slot's creator (prevents self-booking reputation).
 *   (b) A seller completion exists whose creator equals the slot's creator.
 *   (c) A buyer completion exists whose creator equals the winning booking's creator.
 *
 * @returns The verified BookingEntity+CompletionPair, or null if any condition fails.
 */
export function verifyJobCompletion(
  slot: { key: Hex; creator: Address },
  winner: BookingEntity | null,
  completions: CompletionEntity[]
): { winner: BookingEntity; seller: CompletionEntity; buyer: CompletionEntity } | null {
  // (a) There must be a winning booking and the winner must not be the slot creator
  if (!winner) return null;
  if (winner.creator.toLowerCase() === slot.creator.toLowerCase()) return null;

  // (b) Seller completion must exist and its creator must equal the slot creator
  const sellerCompletion = completions.find(
    (c) =>
      c.role === "seller" &&
      c.slotKey.toLowerCase() === slot.key.toLowerCase() &&
      c.creator.toLowerCase() === slot.creator.toLowerCase()
  );
  if (!sellerCompletion) return null;

  // (c) Buyer completion must exist and its creator must equal the winning booking creator
  const buyerCompletion = completions.find(
    (c) =>
      c.role === "buyer" &&
      c.slotKey.toLowerCase() === slot.key.toLowerCase() &&
      c.creator.toLowerCase() === winner.creator.toLowerCase()
  );
  if (!buyerCompletion) return null;

  return { winner, seller: sellerCompletion, buyer: buyerCompletion };
}

/**
 * Computes an account's verified reputation score.
 *
 * Reputation rule — ALL three conditions must hold for a job to count:
 *   (a) A booking exists for the slot and the winning booking's creator is NOT
 *       the slot's creator (blocks self-booking fraud).
 *   (b) A "seller" completion exists whose creator equals the slot's creator.
 *   (c) A "buyer" completion exists whose creator equals the winning booking's creator.
 *
 * Reads are authenticated via `createdBy` filter on the Arkiv index.
 */
export async function getReputation(
  account: Address,
  client: PublicArkivClient = getArkivPublicClient()
): Promise<{ verifiedJobsCount: number; verifiedSlotKeys: Hex[] }> {
  try {
    // Step 1 — Find all slots created by this account (potential seller role)
    // and all slots for which this account has a completion (potential buyer role).
    let completionsPage = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("completion"))
      ))
      .createdBy(account)
      .fetch();

    const myCompletionsRaw: Entity[] = [...completionsPage.entities];
    while (completionsPage.hasNextPage()) {
      completionsPage = await completionsPage.next();
      myCompletionsRaw.push(...completionsPage.entities);
    }

    // Collect the unique slot keys this account has submitted a completion for
    const uniqueSlotKeys = new Set<Hex>();
    for (const raw of myCompletionsRaw) {
      const parsed = parseCompletionEntity(raw);
      if (parsed && parsed.slotKey && parsed.slotKey !== "0x0") {
        uniqueSlotKeys.add(parsed.slotKey);
      }
    }

    // Step 2 — Also include slots created by this account (seller perspective)
    let slotsPage = await client
      .select()
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("slot"))
      ))
      .createdBy(account)
      .fetch();

    const mySlotsRaw: Entity[] = [...slotsPage.entities];
    while (slotsPage.hasNextPage()) {
      slotsPage = await slotsPage.next();
      mySlotsRaw.push(...slotsPage.entities);
    }

    for (const raw of mySlotsRaw) {
      const parsed = parseSlotEntity(raw);
      if (parsed && parsed.key) {
        uniqueSlotKeys.add(parsed.key);
      }
    }

    // Step 3 — Verify each candidate slot against the three-part rule
    const verifiedSlotKeys: Hex[] = [];

    for (const slotKey of uniqueSlotKeys) {
      // Fetch the slot entity (may be expired — use getEntity fallback or parse from index)
      let slotCreator: Address | null = null;

      // Try reading from the "my slots" list first (if this account is the seller)
      const fromMySlots = mySlotsRaw.find(
        (r) => r.key && r.key.toLowerCase() === slotKey.toLowerCase()
      );
      if (fromMySlots) {
        slotCreator = (fromMySlots.creator || null) as Address | null;
      } else {
        // Look up via a filtered query (slot may have been created by another wallet)
        try {
          const slotQuery = await client
            .select()
            .where(and(
              eq("project", str(PROJECT_NAMESPACE)),
              eq("entity_type", str("slot"))
            ))
            .fetch();
          const match = slotQuery.entities.find(
            (e) => e.key && e.key.toLowerCase() === slotKey.toLowerCase()
          );
          if (match) slotCreator = (match.creator || null) as Address | null;
        } catch {
          // slot may be expired; skip
          continue;
        }
      }

      if (!slotCreator) continue;

      const pseudoSlot = { key: slotKey, creator: slotCreator };

      // Fetch bookings and completions for this slot
      const { winner } = await fetchBookingsForSlot(slotKey, client);
      const completions = await fetchCompletionsForSlot(slotKey, client);

      const result = verifyJobCompletion(pseudoSlot, winner, completions);
      if (result) {
        verifiedSlotKeys.push(slotKey);
      }
    }

    return {
      verifiedJobsCount: verifiedSlotKeys.length,
      verifiedSlotKeys,
    };
  } catch (err) {
    throw parseArkivError(err, "QUERY_ERROR");
  }
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
  slotEndsAt: number; // unix seconds (needed for expiry calculation)
  note?: string;
  synthetic?: boolean;
}

export interface CreateBookingOutput {
  entityKey: Hex;
  txHash: Hex;
  expiresAt: bigint;
}

/**
 * Creates a booking entity on Arkiv Tiramisu.
 * Sets entity expiry to slot end time + 24 hours.
 */
export async function createBooking(
  wallet: WalletArkivClient,
  input: CreateBookingInput
): Promise<CreateBookingOutput> {
  acquireWriteLock("createBooking");
  try {
    const bookedAt = Math.floor(Date.now() / 1000);
    const synthetic = input.synthetic ?? false;

    const payloadObj: BookingPayload = {
      note: input.note?.slice(0, 500),
      schema_version: 1,
    };

    // Booking lives as long as the slot plus 24 hours for fulfillment
    const expiryDate = new Date((input.slotEndsAt + 86400) * 1000);
    const expires = ExpirationTime.atDate(expiryDate);

    const result = await wallet.createEntity({
      payload: jsonToPayload(payloadObj),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT_NAMESPACE),
        entity_type: str("booking"),
        slot_key: key(input.slotKey),
        booked_at: u64(BigInt(bookedAt)),
        synthetic: bool(synthetic),
      },
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
  slotKey: Hex;
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
 * Creates a completion entity on Arkiv Tiramisu.
 * Sets long-lived entity expiry (1 year) to persist as reputation receipt.
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
      schema_version: 1,
    };

    // Completions persist for 365 days
    const expires = ExpirationTime.fromDays(365);

    const result = await wallet.createEntity({
      payload: jsonToPayload(payloadObj),
      contentType: "application/json",
      attributes: {
        project: str(PROJECT_NAMESPACE),
        entity_type: str("completion"),
        slot_key: key(input.slotKey),
        role: str(input.role),
        completed_at: u64(BigInt(completedAt)),
        synthetic: bool(synthetic),
      },
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
