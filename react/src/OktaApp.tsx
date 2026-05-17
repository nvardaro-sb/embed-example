import React, { useCallback, useEffect, useMemo } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { LoginCallback, Security, useOktaAuth } from "@okta/okta-react";
import { toRelativeUrl } from "@okta/okta-auth-js";
import EmbedPage from "./EmbedPage";
import { getOktaAuth } from "./oktaAuth";

/** All routes here require an Okta session (except children handle their own UI). */
function ProtectedLayout() {
  const { oktaAuth, authState } = useOktaAuth();

  useEffect(() => {
    if (!authState) return;
    if (!authState.isAuthenticated) {
      void oktaAuth.signInWithRedirect();
    }
  }, [oktaAuth, authState]);

  if (!authState?.isAuthenticated) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        Redirecting to sign in…
      </div>
    );
  }

  return <Outlet />;
}

function OktaEmbedPage() {
  const { oktaAuth } = useOktaAuth();
  const getAccessToken = useCallback(() => oktaAuth.getAccessToken(), [oktaAuth]);
  const onSignOut = useCallback(() => void oktaAuth.signOut(), [oktaAuth]);
  return <EmbedPage getAccessToken={getAccessToken} onSignOut={onSignOut} />;
}

/** Example second screen — same auth gate as `/` (see `ProtectedLayout`). */
function SecretDemoPage() {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 560,
      }}
    >
      <p style={{ marginBottom: 16 }}>
        If you see this, you already passed Okta sign-in. This route exists so
        you can try opening <code>/secret</code> in a private window before
        logging in — you should be sent to Okta first.
      </p>
      <Link to="/">← Back to embed</Link>
    </div>
  );
}

function OktaSecurityShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const oktaAuth = useMemo(() => getOktaAuth(), []);

  const restoreOriginalUri = useCallback(
    async (_oktaAuth: typeof oktaAuth, originalUri: string | undefined) => {
      navigate(
        toRelativeUrl(originalUri || "/", window.location.origin),
        { replace: true }
      );
    },
    [navigate]
  );

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      {children}
    </Security>
  );
}

export default function OktaApp() {
  return (
    <OktaSecurityShell>
      <Routes>
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<OktaEmbedPage />} />
          <Route path="secret" element={<SecretDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </OktaSecurityShell>
  );
}
