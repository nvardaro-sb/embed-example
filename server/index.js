const express = require("express");
const path = require("path");
const axios = require("axios");
const cors = require("cors");
const OktaJwtVerifier = require("@okta/jwt-verifier");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT) || 3001;
const SB_EMBED_TOKEN = process.env.SB_EMBED_TOKEN;
const SUPERBLOCKS_TOKEN_URL =
  process.env.SUPERBLOCKS_TOKEN_URL ||
  "https://app.superblocks.com/api/v1/public/token";

const authModeOkta =
  process.env.REACT_APP_AUTH_MODE?.trim().toLowerCase() === "okta";
const OKTA_ISSUER = process.env.REACT_APP_OKTA_ISSUER?.trim();
const OKTA_CLIENT_ID = process.env.REACT_APP_OKTA_CLIENT_ID?.trim();
const OKTA_AUDIENCE =
  process.env.REACT_APP_OKTA_AUDIENCE?.trim() || "api://default";

const db = new Pool({ connectionString: process.env.DATABASE_URL });

/** Deterministic small int from Okta `sub` for Superblocks metadata. */
function externalUserIdFromSub(sub) {
  let h = 0;
  for (let i = 0; i < sub.length; i++) {
    h = (Math.imul(31, h) + sub.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

let oktaVerifier = null;
if (authModeOkta) {
  if (!OKTA_ISSUER || !OKTA_CLIENT_ID) {
    console.error(
      "REACT_APP_AUTH_MODE=okta requires REACT_APP_OKTA_ISSUER and REACT_APP_OKTA_CLIENT_ID in .env"
    );
    process.exit(1);
  }
  oktaVerifier = new OktaJwtVerifier({ issuer: OKTA_ISSUER });
  console.log("Okta JWT verification enabled for /api/superblocks/token");
}

if (!SB_EMBED_TOKEN || !SB_EMBED_TOKEN.trim()) {
  console.error(
    "Missing SB_EMBED_TOKEN. Copy .env.example to .env and set your Superblocks embed token."
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "build")));

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Superblocks Embed API Server",
    endpoints: {
      token: "/api/superblocks/token",
    },
  });
});

async function userFromRequest(req) {
  if (!oktaVerifier) {
    return {
      email: "embed-demo@example.invalid",
      name: "Embed demo user",
      metadata: {
        externalUserId: 12345,
        externalOrgId: 54321,
      },
    };
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  const jwt = auth.slice(7).trim();
  let claims;
  try {
    const result = await oktaVerifier.verifyAccessToken(jwt, OKTA_AUDIENCE);
    claims = result.claims;
  } catch {
    const err = new Error("Invalid token");
    err.statusCode = 401;
    throw err;
  }

  const sub = claims.sub;
  const email =
    (typeof claims.email === "string" && claims.email) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    sub;
  const name =
    (typeof claims.name === "string" && claims.name) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    email;

  const { rows } = await db.query(
    "SELECT sys_id FROM external.users WHERE email = $1 LIMIT 1",
    [email]
  );
  const sysId = rows[0]?.sys_id ?? null;

  return {
    email,
    name,
    metadata: {
      externalUserId: externalUserIdFromSub(sub),
      externalOrgId: 54321,
      sysId,
    },
  };
}

function getUser(req) {
  return req.superblocksUser;
}

async function checkAuthentication(req, res, next) {
  try {
    req.superblocksUser = await userFromRequest(req);
    next();
  } catch (e) {
    const code = e.statusCode || 500;
    if (code === 500) console.error("checkAuthentication error:", e);
    res.status(code).json({
      error: code === 401 ? "Unauthorized" : "Server error",
    });
  }
}

// Get user session token from Superblocks API (see Superblocks embed docs)
app.get("/api/superblocks/token", checkAuthentication, (req, res) => {
  const user = getUser(req);

  const config = {
    url: SUPERBLOCKS_TOKEN_URL,
    method: "post",
    headers: {
      Authorization: `Bearer ${SB_EMBED_TOKEN}`,
      "Content-Type": "application/json",
    },
    data: {
      email: user.email,
      name: user.name,
      metadata: {
        externalUserId: user.metadata.externalUserId,
        externalOrgId: user.metadata.externalOrgId,
        sysId: user.metadata.sysId,
      },
    },
  };

  axios(config)
    .then((response) => {
      if (response.status === 200) {
        res.json(response.data);
      } else {
        throw new Error("Could not authenticate user with Superblocks");
      }
    })
    .catch((error) => {
      res.status(401).json({
        error: "unauthorized",
        message: error.message,
      });
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
