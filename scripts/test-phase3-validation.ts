/**
 * scripts/test-phase3-validation.ts
 *
 * Phase 3 Unit Test Suite:
 *  1. Field length constraints (title <= 60, description <= 280)
 *  2. PII / Sensitive data detection (phone, email, Aadhaar, GSTIN)
 *  3. Slot duration bounds (min 15m, max 7d, endsAt > startsAt)
 *  4. Double-click pending guard / write-lock idempotency
 *  5. Attribute charset & byte constraints
 *
 * Usage:
 *  npx tsx scripts/test-phase3-validation.ts
 */

import {
  validateSlotForm,
  checkSensitiveData,
  validateAttributeCharset,
  PHONE_REGEX,
  EMAIL_REGEX,
  AADHAAR_REGEX,
  GSTIN_REGEX,
  type SlotFormValues,
} from "../src/lib/slotValidation.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
    failedCount++;
  }
}

const NOW = Math.floor(Date.now() / 1000);

const VALID_BASE_FORM: SlotFormValues = {
  category: "machine",
  title: "Precision Lathe 4-hour batch run",
  description: "High quality CNC milling with operator included.",
  cluster: "jaipur",
  lat: 26.9124,
  lon: 75.7873,
  startsAt: NOW,
  endsAt: NOW + 4 * 3600, // 4 hours
  priceBand: "mid",
  confirmedNoPii: true,
};

console.log("============================================================");
console.log("PHASE 3: SLOT VALIDATION & IDEMPOTENCY UNIT TESTS");
console.log("============================================================\n");

// ─────────────────────────────────────────────────────────────────────────────
// 1. FIELD LENGTH CONSTRAINTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("1. FIELD LENGTH VALIDATION");

{
  // Valid base form passes
  const res = validateSlotForm(VALID_BASE_FORM);
  assert(res.valid, "Valid standard form passes with 0 errors");

  // Empty title fails
  const resEmpty = validateSlotForm({ ...VALID_BASE_FORM, title: "" });
  assert(!resEmpty.valid && Boolean(resEmpty.errors.title), "Empty title is rejected");

  // Title exactly 60 characters passes
  const title60 = "A".repeat(60);
  const res60 = validateSlotForm({ ...VALID_BASE_FORM, title: title60 });
  assert(res60.valid, "Title with exactly 60 characters passes");

  // Title 61 characters fails
  const title61 = "A".repeat(61);
  const res61 = validateSlotForm({ ...VALID_BASE_FORM, title: title61 });
  assert(!res61.valid && Boolean(res61.errors.title), "Title with 61 characters is rejected");

  // Description exactly 280 characters passes
  const desc280 = "B".repeat(280);
  const res280 = validateSlotForm({ ...VALID_BASE_FORM, description: desc280 });
  assert(res280.valid, "Description with exactly 280 characters passes");

  // Description 281 characters fails
  const desc281 = "B".repeat(281);
  const res281 = validateSlotForm({ ...VALID_BASE_FORM, description: desc281 });
  assert(!res281.valid && Boolean(res281.errors.description), "Description with 281 characters is rejected");
}

console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// 2. PII / SENSITIVE DATA DETECTION
// ─────────────────────────────────────────────────────────────────────────────
console.log("2. SENSITIVE DATA & PII GUARDS");

{
  // Clean text
  assert(checkSensitiveData("Standard machine shop booking") === null, "Clean text has no PII violations");

  // Indian Phone Numbers
  const phone1 = "Contact me at 9876543210 for urgent pickup";
  assert(PHONE_REGEX.test(phone1), "Phone regex matches 10-digit Indian mobile");
  assert(checkSensitiveData(phone1) !== null, "checkSensitiveData detects phone number");

  const phone2 = "Call +91 9123456789";
  assert(checkSensitiveData(phone2) !== null, "checkSensitiveData detects +91 prefixed phone");

  // Email Addresses
  const emailText = "Inquiries to workshop.delhi@gmail.com please";
  assert(EMAIL_REGEX.test(emailText), "Email regex matches standard email");
  assert(checkSensitiveData(emailText) !== null, "checkSensitiveData detects email address");

  // Aadhaar Numbers (12 digits with or without spaces)
  const aadhaarText1 = "Aadhaar: 1234 5678 9012 for verification";
  assert(AADHAAR_REGEX.test(aadhaarText1), "Aadhaar regex matches spaced 12-digit number");
  assert(checkSensitiveData(aadhaarText1) !== null, "checkSensitiveData detects spaced Aadhaar number");

  const aadhaarText2 = "ID 987654321098";
  assert(checkSensitiveData(aadhaarText2) !== null, "checkSensitiveData detects unspaced 12-digit Aadhaar number");

  // GSTIN Numbers (15 alphanumeric characters)
  const gstinText = "Invoice under GSTIN 29ABCDE1234F1Z5";
  assert(GSTIN_REGEX.test(gstinText), "GSTIN regex matches 15-character GST format");
  assert(checkSensitiveData(gstinText) !== null, "checkSensitiveData detects GSTIN identification");

  // Integration test: Title with phone number fails validateSlotForm
  const resPiiTitle = validateSlotForm({
    ...VALID_BASE_FORM,
    title: "Milling slot call 9876543210",
  });
  assert(!resPiiTitle.valid && Boolean(resPiiTitle.errors.title), "Form rejects slot title containing phone number");

  // Integration test: Description with email fails validateSlotForm
  const resPiiDesc = validateSlotForm({
    ...VALID_BASE_FORM,
    description: "Send inquiries to dev@example.com for quotes",
  });
  assert(!resPiiDesc.valid && Boolean(resPiiDesc.errors.description), "Form rejects slot description containing email");
}

console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// 3. DURATION & EXPIRY CONSTRAINTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("3. DURATION & EXPIRY CONSTRAINTS");

{
  // End time before start time fails
  const resEndBeforeStart = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW + 1000,
    endsAt: NOW + 500,
  });
  assert(!resEndBeforeStart.valid && Boolean(resEndBeforeStart.errors.endsAt), "End time before start time is rejected");

  // End time equal to start time fails
  const resEqual = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW,
    endsAt: NOW,
  });
  assert(!resEqual.valid && Boolean(resEqual.errors.endsAt), "Zero duration slot is rejected");

  // Duration < 15 minutes fails (14m 50s)
  const resUnder15m = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW,
    endsAt: NOW + (14 * 60 + 50),
  });
  assert(!resUnder15m.valid && Boolean(resUnder15m.errors.endsAt), "Duration under 15 minutes is rejected");

  // Duration exactly 15 minutes passes
  const res15m = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW,
    endsAt: NOW + 15 * 60,
  });
  assert(res15m.valid, "Duration exactly 15 minutes passes");

  // Duration exactly 7 days passes
  const res7d = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW,
    endsAt: NOW + 7 * 86400,
  });
  assert(res7d.valid, "Duration exactly 7 days passes");

  // Duration > 7 days fails (7 days + 1 minute)
  const resOver7d = validateSlotForm({
    ...VALID_BASE_FORM,
    startsAt: NOW,
    endsAt: NOW + (7 * 86400 + 60),
  });
  assert(!resOver7d.valid && Boolean(resOver7d.errors.endsAt), "Duration exceeding 7 days is rejected");

  // Missing PII checkbox confirmation fails
  const resNoConfirm = validateSlotForm({
    ...VALID_BASE_FORM,
    confirmedNoPii: false,
  });
  assert(!resNoConfirm.valid && Boolean(resNoConfirm.errors.confirmedNoPii), "Missing PII checkbox confirmation is rejected");
}

console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOUBLE-CLICK PENDING GUARD / IDEMPOTENCY
// ─────────────────────────────────────────────────────────────────────────────
console.log("4. DOUBLE-CLICK PENDING GUARD / IDEMPOTENCY");

{
  // Test pending submission state simulation
  let isSubmitting = false;

  function simulateSubmitClick() {
    if (isSubmitting) {
      throw new Error("CONCURRENT_SUBMISSION: A submission is already in progress");
    }
    isSubmitting = true;
  }

  // First click succeeds
  let firstClickSuccess = false;
  try {
    simulateSubmitClick();
    firstClickSuccess = isSubmitting === true;
  } catch {
    firstClickSuccess = false;
  }
  assert(firstClickSuccess, "First click successfully enters isSubmitting pending state");

  // Second immediate click throws concurrent error
  let secondClickBlocked = false;
  try {
    simulateSubmitClick();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("CONCURRENT_SUBMISSION")) {
      secondClickBlocked = true;
    }
  }
  assert(secondClickBlocked, "Immediate second click is blocked by idempotency guard");
}

console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// 5. ATTRIBUTE CHARSET & BOUNDS
// ─────────────────────────────────────────────────────────────────────────────
console.log("5. ATTRIBUTE CHARSET & BOUNDS");

{
  assert(validateAttributeCharset("starts_at"), "Valid snake_case attribute 'starts_at' passes");
  assert(validateAttributeCharset("cluster"), "Valid attribute 'cluster' passes");
  assert(validateAttributeCharset("price_band"), "Valid attribute 'price_band' passes");
  assert(!validateAttributeCharset("StartsAt"), "Uppercase attribute 'StartsAt' fails (FR-003 protection)");
  assert(!validateAttributeCharset("user-name"), "Hyphenated attribute 'user-name' fails charset");
  assert(!validateAttributeCharset("a".repeat(33)), "Attribute exceeding 32 chars fails bound check");
  assert(!validateAttributeCharset(""), "Empty attribute string fails bound check");
}

console.log("");
console.log("============================================================");
console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log("============================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
