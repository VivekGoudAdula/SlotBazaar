/**
 * scripts/print-schema-versions.ts
 *
 * Prints the active schema_v constants from src/lib/arkiv.ts
 */

import {
  SLOT_SCHEMA_VERSION,
  BOOKING_SCHEMA_VERSION,
  COMPLETION_SCHEMA_VERSION,
} from "../src/lib/arkiv.js";

console.log("schema_v is per entity type:");
console.log(`  slot       schema_v = "${SLOT_SCHEMA_VERSION}"`);
console.log(`  booking    schema_v = "${BOOKING_SCHEMA_VERSION}"`);
console.log(`  completion schema_v = "${COMPLETION_SCHEMA_VERSION}"`);
