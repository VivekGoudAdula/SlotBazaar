import { getArkivPublicClient, fetchLiveSlots } from "../src/lib/arkiv.js";

async function main() {
  console.log("Fetching live slots...");
  const c = getArkivPublicClient();
  const slots = await fetchLiveSlots(c);
  console.log(`Found ${slots.length} slots:`);
  for (const s of slots) {
    console.log(`- [${s.cluster}] "${s.title}" ends: ${new Date(s.endsAt * 1000).toLocaleTimeString()} key: ${s.key}`);
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
