import Link from "next/link";
import { cookies } from "next/headers";
import { getEnv } from "@/src/config/env";
import { getConnectionMeta, OAUTH_SETUP_COOKIE } from "@/src/pinterest/token-store";
import { pinterestAuthorizeUrl } from "@/src/pinterest/oauth-state";
import { VercelSetupPanel } from "@/app/connect/vercel-setup-panel";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{
    sandbox?: string;
    error?: string;
    connected?: string;
    vercel_setup?: string;
  }>;
}) {
  const params = await searchParams;
  const env = getEnv();
  const meta = await getConnectionMeta();
  const cookieStore = await cookies();
  const pendingEncrypted = cookieStore.get(OAUTH_SETUP_COOKIE)?.value;
  const sandbox = params.sandbox === "1" || env.PINTEREST_USE_SANDBOX === true;
  let authorizeUrl: string | null = null;
  try {
    authorizeUrl = pinterestAuthorizeUrl(sandbox);
  } catch {
    authorizeUrl = null;
  }

  const showVercelSetup =
    params.vercel_setup === "1" && pendingEncrypted && !env.PINTEREST_REFRESH_TOKEN_ENCRYPTED;

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <h1>Connect Pinterest</h1>
      <p>Authorize this server to access one business ad account (single-tenant).</p>

      {params.error ? (
        <p style={{ color: "#b00020" }}>OAuth error: {params.error}</p>
      ) : null}
      {params.connected === "1" && !showVercelSetup ? (
        <p style={{ color: "#0a7" }}>Pinterest connected successfully.</p>
      ) : null}
      {params.connected === "1" && showVercelSetup ? (
        <p style={{ color: "#0a7" }}>
          Pinterest authorized — finish Vercel setup below to persist the connection.
        </p>
      ) : null}

      {showVercelSetup && pendingEncrypted ? (
        <VercelSetupPanel encryptedToken={pendingEncrypted} />
      ) : null}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Environment</h2>
        <ul>
          <li>Sandbox mode: {sandbox ? "on" : "off"}</li>
          <li>
            Ad account id: {env.PINTEREST_AD_ACCOUNT_ID ?? "(set PINTEREST_AD_ACCOUNT_ID)"}
          </li>
          <li>
            Token storage:{" "}
            {env.PINTEREST_REFRESH_TOKEN_ENCRYPTED || env.PINTEREST_REFRESH_TOKEN
              ? "environment variable"
              : meta
                ? "local file (.data/oauth.json)"
                : "not configured"}
          </li>
        </ul>
      </section>

      {meta ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Stored connection</h2>
          <ul>
            <li>Connected at: {meta.connected_at}</li>
            <li>Sandbox token: {meta.sandbox ? "yes" : "no"}</li>
            <li>Scopes: {meta.scopes.join(", ") || "(none recorded)"}</li>
          </ul>
          <p>No refresh tokens are displayed on this page.</p>
        </section>
      ) : (
        <p>No encrypted refresh token stored yet.</p>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Authorize</h2>
        {authorizeUrl ? (
          <p>
            <a href={authorizeUrl}>Start Pinterest OAuth</a>
          </p>
        ) : (
          <p>
            Set PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT_URI, and
            OAUTH_STATE_SECRET, then reload.
          </p>
        )}
        <p>
          <Link href={sandbox ? "/connect" : "/connect?sandbox=1"}>
            {sandbox ? "Use production OAuth" : "Use sandbox OAuth"}
          </Link>
        </p>
      </section>
    </main>
  );
}
