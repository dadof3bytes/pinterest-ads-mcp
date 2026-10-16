"use client";

import { useState } from "react";

export function VercelSetupPanel({ encryptedToken }: { encryptedToken: string }) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  async function dismiss() {
    await fetch("/api/oauth/dismiss-setup", { method: "POST" });
    setDismissed(true);
  }

  async function copy() {
    await navigator.clipboard.writeText(encryptedToken);
    setCopied(true);
  }

  return (
    <section
      style={{
        marginTop: "1.5rem",
        padding: "1rem",
        border: "1px solid #c9a227",
        borderRadius: 8,
        background: "#fffbeb",
      }}
    >
      <h2>One more step for Vercel</h2>
      <p>
        This host cannot save OAuth tokens to disk. Copy the encrypted refresh token below into
        your Vercel project → <strong>Settings → Environment Variables</strong>:
      </p>
      <ul>
        <li>
          Name: <code>PINTEREST_REFRESH_TOKEN_ENCRYPTED</code>
        </li>
        <li>
          Value: (the long string below — must match your existing{" "}
          <code>TOKEN_ENCRYPTION_KEY</code>)
        </li>
        <li>Apply to Production (and Preview if you use preview URLs).</li>
      </ul>
      <textarea
        readOnly
        value={encryptedToken}
        rows={4}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
      />
      <p style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy value"}
        </button>
        <button type="button" onClick={() => void dismiss()}>
          I saved this in Vercel — dismiss
        </button>
      </p>
      <p style={{ fontSize: 14, color: "#555" }}>
        Redeploy or wait for env to apply, then MCP tools will work. Until then, API calls will
        say no refresh token is configured.
      </p>
    </section>
  );
}
