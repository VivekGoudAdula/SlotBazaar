import React from "react";

/**
 * SlotBazaar — Phase 0 placeholder.
 * The actual UI map will be built in Phase 1.
 * Arkiv is the only data layer; without a connected wallet this shows nothing.
 */
function App(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FBF7F0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        color: "#1A1208",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0, letterSpacing: "-0.02em" }}>
        SlotBazaar
      </h1>
      <p style={{ marginTop: "0.5rem", color: "#6B5E4A", fontSize: "1.1rem" }}>
        Live India map for expiring time slots — powered by{" "}
        <strong>Arkiv</strong>, the Web3 database.
      </p>
      <p
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1.5rem",
          border: "2px solid #1A1208",
          boxShadow: "4px 4px 0 #1A1208",
          background: "#FFF9ED",
          fontFamily: "monospace",
          fontSize: "0.9rem",
        }}
      >
        🚧 Phase 0 — UI coming in Phase 1
      </p>
      <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#9A8A78" }}>
        Arkiv Tiramisu testnet · Chain ID 7738577
      </p>
    </main>
  );
}

export default App;
