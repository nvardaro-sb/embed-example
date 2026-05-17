import React from "react";
import { BrowserRouter } from "react-router-dom";
import EmbedPage from "./EmbedPage";
import OktaApp from "./OktaApp";

const authMode = process.env.REACT_APP_AUTH_MODE?.trim().toLowerCase();
const useOkta = authMode === "okta";

const issuer = process.env.REACT_APP_OKTA_ISSUER?.trim();
const clientId = process.env.REACT_APP_OKTA_CLIENT_ID?.trim();

export default function Root() {
  if (!useOkta) {
    return <EmbedPage />;
  }

  if (!issuer || !clientId) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>
          <code>REACT_APP_AUTH_MODE=okta</code> is set, but Okta is not fully
          configured. Set <code>REACT_APP_OKTA_ISSUER</code> and{" "}
          <code>REACT_APP_OKTA_CLIENT_ID</code> in the root <code>.env</code>{" "}
          (see <code>.env.example</code>).
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <OktaApp />
    </BrowserRouter>
  );
}
