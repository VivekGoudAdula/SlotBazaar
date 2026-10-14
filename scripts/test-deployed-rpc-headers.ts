/**
 * scripts/test-deployed-rpc-headers.ts
 *
 * Checks CORS headers on Arkiv Tiramisu RPC when called with Origin: https://slotbazaar.vercel.app
 */

async function main() {
  const url = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
  const origin = "https://slotbazaar.vercel.app";

  console.log(`Sending POST to ${url} with Origin: ${origin}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Origin": origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    }),
  });

  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log("Response Headers:");
  for (const [key, val] of res.headers.entries()) {
    console.log(`  ${key}: ${val}`);
  }

  const text = await res.text();
  console.log("\nResponse Body:", text);

  // Also test pre-flight OPTIONS request
  console.log(`\nSending OPTIONS pre-flight to ${url}`);
  const optionsRes = await fetch(url, {
    method: "OPTIONS",
    headers: {
      "Origin": origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  console.log(`OPTIONS Status: ${optionsRes.status} ${optionsRes.statusText}`);
  console.log("OPTIONS Response Headers:");
  for (const [key, val] of optionsRes.headers.entries()) {
    console.log(`  ${key}: ${val}`);
  }
}

main().catch(console.error);
