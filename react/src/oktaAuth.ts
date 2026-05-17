import { OktaAuth } from "@okta/okta-auth-js";

let client: OktaAuth | null = null;

/** Call only when `REACT_APP_OKTA_*` env vars are set (see Root.tsx). */
export function getOktaAuth(): OktaAuth {
  if (client) return client;
  const issuer = process.env.REACT_APP_OKTA_ISSUER?.trim();
  const clientId = process.env.REACT_APP_OKTA_CLIENT_ID?.trim();
  if (!issuer || !clientId) {
    throw new Error("Okta env vars are missing");
  }
  client = new OktaAuth({
    issuer,
    clientId,
    redirectUri: `${window.location.origin}/login/callback`,
    scopes: ["openid", "profile", "email"],
    pkce: true,
  });
  return client;
}
