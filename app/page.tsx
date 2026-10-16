import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Pinterest Ads MCP</h1>
      <p>
        MCP endpoint: <code>/api/mcp</code>
      </p>
      <p>
        <Link href="/connect">Connect Pinterest OAuth</Link>
      </p>
    </main>
  );
}
