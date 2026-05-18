# Dealer Direct - External App OAuth Deployment Guide

---

## Prerequisites

- Server running Proxmox (Debian-based Linux)
- SSH access and `sudo` privileges
- `git` installed on the server (`sudo apt-get install -y git` if not)

---

## Step 1: Get code onto the server

SSH or log into the remote server, then install git and clone the repo:

```bash
sudo apt-get install -y git
git clone https://github.com/nvardaro-sb/embed-example.git /opt/dealer-direct-poc
```

Fix ownership so the service user can read the files:

```bash
sudo chown -R <linux-username>:<linux-username> /opt/dealer-direct-poc
```

> **Finding your username:** Run `whoami` on the server — the output (e.g. `ubuntu`, `debian`) is what you substitute for `<linux-username>`. On Proxmox/Debian VMs, common defaults are `ubuntu` or `debian`.

---

## Step 2: Install Node.js and dependencies on the server

```bash
# Install Node.js (using NodeSource for current LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version

# Go to your app folder and install dependencies
cd /opt/dealer-direct-poc
npm install
```

> **Note:** Do not run `npm run build` yet — the React build bakes in `REACT_APP_*` values from `.env`, so the `.env` file must be filled in first (Step 3). Run the build after completing Step 3.

---

## Step 3: Set up environment variables on the server

Copy the example file to create your `.env`:

```bash
cp /opt/dealer-direct-poc/.env.example /opt/dealer-direct-poc/.env
nano /opt/dealer-direct-poc/.env
```

All the keys are already in the file — just fill in the empty values:

- `SB_EMBED_TOKEN` — Superblocks → **Settings** → **Embed** → **Embed Tokens** → create or copy a token
- `REACT_APP_SUPERBLOCKS_EMBED_SRC` — Open your app in Superblocks → click **Embed** → copy the embed URL (must contain `/embed/applications/` in the path)
- `REACT_APP_OKTA_ISSUER` — Okta Admin Console → **Security** → **API** → **Authorization Servers** → open `default` → copy the **Issuer URI**
- `REACT_APP_OKTA_CLIENT_ID` — Okta Admin Console → your SPA app → **General** tab → **Client ID**
- `DATABASE_URL` — NeonDB dashboard → **Connection Details** → use the **pooled** connection string

> **Saving in nano:** When done editing, press `Ctrl + X` → `Y` → `Enter` to save and exit.

Lock down the file permissions:

```bash
chmod 600 /opt/dealer-direct-poc/.env
```

Now build the React app (`.env` must be in place before this):

```bash
cd /opt/dealer-direct-poc
npm run build
```

---

## Step 4: Run the web server as a systemd service

Create the service file:

```bash
sudo nano /etc/systemd/system/dealer-direct.service
```

Paste in:

```ini
[Unit]
Description=Dealer Direct POC
After=network.target

[Service]
Type=simple
User=<linux-username>  # run `whoami` on the server to find this
WorkingDirectory=/opt/dealer-direct-poc
EnvironmentFile=/opt/dealer-direct-poc/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> **Saving in nano:** Press `Ctrl + X` → `Y` → `Enter` to save and exit.

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dealer-direct
sudo systemctl start dealer-direct
sudo systemctl status dealer-direct
```

The server is now running in the background, auto-restarts if it crashes, and survives reboots.

To verify it started correctly:

```bash
# Check the service status — look for "active (running)"
sudo systemctl status dealer-direct

curl http://localhost:3000/api/superblocks/token
```

> **Expected response:** `{"error":"Unauthorized"}` — this is correct. It means the server is running and responding. The endpoint requires an Okta JWT, so an unauthorized error without one is expected behavior.

If the service failed to start, check the logs:

```bash
sudo journalctl -u dealer-direct -n 50
```

---

## Step 5: Install nginx and open firewall ports

```bash
sudo apt-get install -y nginx
```

Then check if a firewall is running (on a fresh Debian install it usually isn't):

```bash
sudo ufw status
```

- `command not found` or `Status: inactive` — no firewall, nothing else to do here.
- `Status: active` — firewall is on, run this before continuing:

```bash
sudo ufw allow 'Nginx Full'
```

---

## Step 6: Generate a self-signed certificate

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/dealer-direct.key \
  -out /etc/nginx/ssl/dealer-direct.crt \
  -subj "/CN=dealerdirect-poc.octane.internal"
```

> **Note:** This certificate expires after 365 days. When it does, rerun the `openssl` command above and then run `sudo systemctl reload nginx`.

---

## Step 7: Configure nginx as a reverse proxy

Create the site config:

```bash
sudo nano /etc/nginx/sites-available/dealer-direct
```

Paste in:

```nginx
server {
    listen 80;
    server_name dealerdirect-poc.octane.internal;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name dealerdirect-poc.octane.internal;

    ssl_certificate     /etc/nginx/ssl/dealer-direct.crt;
    ssl_certificate_key /etc/nginx/ssl/dealer-direct.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support if needed
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

> **Saving in nano:** Press `Ctrl + X` → `Y` → `Enter` to save and exit.

Enable and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/dealer-direct /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 8: Update Okta with the production URL

> **Prerequisite:** Before this step, the Okta account and SPA app must already be created and working locally. If not, complete the Okta setup first — create a free account at [developer.okta.com/signup](https://developer.okta.com/signup/), create a **Single-Page Application (OIDC)**, add an access policy on the default authorization server, and confirm login works at `http://localhost:3000` before deploying.

In the Okta admin console, open your Dealer Direct OIDC app and update:

- **Sign-in redirect URIs:** add `https://dealerdirect-poc.octane.internal/login/callback`
- **Sign-out redirect URIs:** add `https://dealerdirect-poc.octane.internal`

---

## Step 9: Set up DNS

Since this is a single-machine setup, add the hostname to the server's own `/etc/hosts` file:

```bash
sudo nano /etc/hosts
```

Add a new line at the bottom:

```
127.0.0.1    dealerdirect-poc.octane.internal
```

Add the line at the very bottom of the file, after the last existing entry.

Using `127.0.0.1` means the server resolves the hostname to itself, which is correct for a self-contained POC running everything on one machine.

> **Saving in nano:** Press `Ctrl + X` → `Y` → `Enter` to save and exit.

---

## Step 10: Test it works

Test DNS resolution:

```bash
ping dealerdirect-poc.octane.internal
```

Should resolve to `127.0.0.1`. Press `Ctrl + C` to stop the ping. Then test the full stack:

```bash
curl -k https://dealerdirect-poc.octane.internal
```

The `-k` flag skips certificate verification for the self-signed cert.

> **Expected response:** `{"message":"Welcome to the Superblocks Embed API Server","endpoints":{"token":"/api/superblocks/token"}}` — this means nginx, Node, and DNS are all wired up correctly.

If you get a connection refused or nginx error instead, check the logs:

```bash
sudo systemctl status dealer-direct
sudo journalctl -u dealer-direct
```

To tail logs in real time:

```bash
sudo journalctl -u dealer-direct -f
```
