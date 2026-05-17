import React, { useState, useEffect, useCallback } from "react";
import { SuperblocksEmbed } from "@superblocksteam/embed-react";

const embedSrc = process.env.REACT_APP_SUPERBLOCKS_EMBED_SRC?.trim();

export type EmbedPageProps = {
  /** When set (Okta), sent as `Authorization: Bearer` to `/api/superblocks/token`. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  onSignOut?: () => void;
};

async function getSBToken(
  getAccessToken?: () => string | undefined | Promise<string | undefined>
): Promise<string> {
  const headers: Record<string, string> = {};
  if (getAccessToken) {
    const accessToken = await Promise.resolve(getAccessToken());
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  const response = await fetch("/api/superblocks/token", { headers });
  if (!response.ok) {
    throw new Error("Failed to fetch Superblocks token");
  }
  const data = await response.json();
  return data.access_token;
}

export default function EmbedPage({ getAccessToken, onSignOut }: EmbedPageProps) {
  const [token, setToken] = useState<string | null>(null);

  const fetchToken = useCallback(() => {
    if (!embedSrc) return;
    getSBToken(getAccessToken)
      .then(setToken)
      .catch(() => console.log("Failed to get Superblocks auth token"));
  }, [getAccessToken]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const handleFailedAuth = () => {
    console.log("Superblocks auth token invalid");
  };

  if (!embedSrc) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>
          Set <code>REACT_APP_SUPERBLOCKS_EMBED_SRC</code> in the repository
          root <code>.env</code> (see <code>.env.example</code>).
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "12px 16px",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "1rem",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span>Superblocks Embedded App Example</span>
        {onSignOut ? (
          <button
            type="button"
            onClick={() => onSignOut()}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Sign out
          </button>
        ) : null}
      </header>
      <div style={{ flex: 1 }}>
        {token ? (
          <SuperblocksEmbed
            src={embedSrc}
            token={token}
            properties={{ colorScheme: "light" }}
            onAuthError={handleFailedAuth}
          />
        ) : (
          <div style={{ padding: 16 }}>Loading…</div>
        )}
      </div>
    </div>
  );
}
