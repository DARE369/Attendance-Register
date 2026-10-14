# 09 — Accounts & Credentials Handover Checklist

Use this checklist to transfer ownership of every external account and secret.
**Do not store actual passwords/keys in this file or in git** — record them in a
shared password manager (1Password, Bitwarden, etc.) and tick the boxes here.

---

## Third-party accounts to transfer

| # | Service | Used for | What to hand over |
|---|---------|----------|-------------------|
| 1 | **Supabase** | Database | Project URL, org/owner access, anon key, **service-role key** |
| 2 | **Fly.io** | Backend hosting | App `peculiar-register`, org membership, billing |
| 3 | **Vercel** | Frontend hosting | Project + git connection, env vars, billing |
| 4 | **Gmail (school)** | Email notifications | Account login + a fresh **App Password** |
| 5 | **D7 Networks** | WhatsApp notifications | Account login, API token, registered sender number |
| 6 | **Domain / DNS** (if any) | Custom domain | Registrar access, DNS records |
| 7 | **GitHub / Git host** | Source code | Repo ownership/admin, branch protections |

---

## Per-account steps

### 1. Supabase
- [ ] Add new owner to the Supabase org (Settings → Team) as Owner/Admin.
- [ ] Confirm new owner can open the SQL Editor and see all tables (doc 04).
- [ ] **Rotate** the anon key and service-role key (Settings → API) after transfer.
- [ ] Update `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in Fly secrets + local `.env`.
- [ ] Verify/enable a backup schedule (Database → Backups).

### 2. Fly.io
- [ ] Add new owner to the Fly organization that holds `peculiar-register`.
- [ ] Transfer billing / payment method.
- [ ] Confirm `fly status`, `fly logs`, `fly secrets list` work for the new owner.
- [ ] Re-set rotated secrets with `fly secrets set ...` and `fly deploy`.

### 3. Vercel
- [ ] Transfer the project to the new owner's Vercel team (or add them as member).
- [ ] Re-link the GitHub repo if ownership changed.
- [ ] Confirm `VITE_API_BASE_URL` env var is set to the Fly URL.
- [ ] Trigger a deploy and confirm the live site loads + logs in.

### 4. Gmail (notification sender)
- [ ] Hand over the Gmail account credentials (or migrate to the new owner's account).
- [ ] Ensure 2FA is on, then create a **new App Password** (myaccount.google.com → Security).
- [ ] Update `SMTP_EMAIL` / `SMTP_PASSWORD` in Fly secrets + local `.env`.
- [ ] **Revoke** the old App Password.
- [ ] Send a test notification to confirm delivery.

### 5. D7 Networks (WhatsApp)
- [ ] Transfer or share the D7 account.
- [ ] Regenerate the API token; update `D7_API_TOKEN`.
- [ ] Confirm `D7_WHATSAPP_FROM` sender number is valid/registered.
- [ ] Use the dashboard "Test WhatsApp" button to confirm delivery.

### 6. Domain / DNS (if a custom domain is used)
- [ ] Transfer registrar access.
- [ ] Document DNS records pointing to Vercel (frontend) and any for the API.

### 7. Source code (GitHub / Git host)
- [ ] Make the new owner an admin/owner of the repository.
- [ ] Hand over any deploy keys / CI tokens.
- [ ] Ensure the **uncommitted working-tree changes** are committed first (doc 08).

---

## Application credentials (not third-party)

| Item | Where | Action |
|------|-------|--------|
| `JWT_SECRET` | Fly secrets / `.env` | Rotate to long random value |
| `ADMIN_REGISTER_SECRET` | Fly secrets / `.env` | Rotate |
| First **super_admin** login | `admins` table | Hand over username; set a new password (bcrypt) |
| Any additional admin/scanner accounts | `admins` table | Review, remove stale accounts |

---

## Final verification (after all transfers + rotations)

- [ ] `GET https://peculiar-register.fly.dev/health` returns `{"status":"ok"}`.
- [ ] New owner can log into the dashboard with a known admin account.
- [ ] A test barcode scan records correctly and appears on the dashboard.
- [ ] A test email notification is delivered.
- [ ] A test WhatsApp notification is delivered.
- [ ] Old owner's access has been removed from all services above.
- [ ] All rotated secrets are stored in the shared password manager.
