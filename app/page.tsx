export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Pinterest Ads MCP</h1>
      <p>
        MCP endpoint: <code>/api/mcp</code>
      </p>
      <p>
        OAuth setup lives on <code>/connect</code>. On production, set{" "}
        <code>CONNECT_PAGE_TOKEN</code> and use{" "}
        <code>/connect?connect_token=…</code> (see README). Do not link this page publicly
        without that gate.
      </p>
    </main>
  );
}
