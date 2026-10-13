/**
 * src/lib/slotValidation.ts
 *
 * Pure validation logic for slot creation:
 *  - Field lengths (title <= 60, description <= 280)
 *  - Expiry constraints (min 15 min, max 7 days, end > start)
 *  - PII / personal data guard (phone numbers, emails, Aadhaar, GSTIN)
 *  - Attribute charset and byte constraints
 */

export interface SlotFormValues {
  category: "machine" | "transport" | "freelance";
  title: string;
  description: string;
  cluster: string;
  lat: number;
  lon: number;
  startsAt: number; // unix seconds
  endsAt: number;   // unix seconds
  priceBand: "low" | "mid" | "high";
  confirmedNoPii: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// ─── PII REGEX PATTERNS ───────────────────────────────────────────────────────
// Indian mobile: 10 digits starting with 6,7,8,9, optional +91 or 0 prefix
export const PHONE_REGEX = /(?:(?:\+|0{0,2})91[\s-]?)?[6-9]\d{9}\b/;
// Standard email pattern
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// 12-digit Indian Aadhaar number
export const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
// 15-character Indian GSTIN pattern
export const GSTIN_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i;

const MIN_DURATION_SEC = 15 * 60;        // 15 minutes
const MAX_DURATION_SEC = 7 * 86400;      // 7 days

/**
 * Checks text for sensitive personal data (phone numbers, emails, Aadhaar, GSTIN).
 * Returns a friendly violation message or null if clean.
 */
export function checkSensitiveData(text: string): string | null {
  if (!text) return null;
  if (EMAIL_REGEX.test(text)) {
    return "Email addresses are not permitted in public slots.";
  }
  if (PHONE_REGEX.test(text)) {
    return "Phone numbers are not permitted in public slots.";
  }
  if (AADHAAR_REGEX.test(text)) {
    return "Aadhaar numbers are not permitted in public slots.";
  }
  if (GSTIN_REGEX.test(text)) {
    return "GSTIN identification numbers are not permitted in public slots.";
  }
  return null;
}

/**
 * Validates slot form inputs prior to on-chain transaction preparation.
 */
export function validateSlotForm(values: SlotFormValues): ValidationResult {
  const errors: Record<string, string> = {};

  // Title validation
  const trimmedTitle = values.title.trim();
  if (!trimmedTitle) {
    errors.title = "Title is required.";
  } else if (trimmedTitle.length > 60) {
    errors.title = "Title must be 60 characters or fewer.";
  } else {
    const piiError = checkSensitiveData(trimmedTitle);
    if (piiError) errors.title = piiError;
  }

  // Description validation
  const trimmedDesc = values.description.trim();
  if (trimmedDesc.length > 280) {
    errors.description = "Description must be 280 characters or fewer.";
  } else if (trimmedDesc) {
    const piiError = checkSensitiveData(trimmedDesc);
    if (piiError) errors.description = piiError;
  }

  // Cluster validation
  if (!values.cluster || !values.cluster.trim()) {
    errors.cluster = "Cluster / City is required.";
  }

  // Coordinates validation
  if (isNaN(values.lat) || values.lat < -90 || values.lat > 90) {
    errors.lat = "Latitude must be between -90 and 90.";
  }
  if (isNaN(values.lon) || values.lon < -180 || values.lon > 180) {
    errors.lon = "Longitude must be between -180 and 180.";
  }

  // Time / Duration validation
  const duration = values.endsAt - values.startsAt;
  if (values.endsAt <= values.startsAt) {
    errors.endsAt = "End time must be strictly after start time.";
  } else if (duration < MIN_DURATION_SEC) {
    errors.endsAt = "Slot duration must be at least 15 minutes.";
  } else if (duration > MAX_DURATION_SEC) {
    errors.endsAt = "Slot duration cannot exceed 7 days.";
  }

  // PII Confirmation Checkbox
  if (!values.confirmedNoPii) {
    errors.confirmedNoPii = "You must confirm the slot contains no personal data.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Arkiv attribute names to guarantee lower-case charset and byte bounds.
 */
export function validateAttributeCharset(name: string): boolean {
  if (!name || name.length === 0 || name.length > 32) return false;
  // Lowercase alphanumeric and underscores only
  return /^[a-z0-9_]+$/.test(name);
}
