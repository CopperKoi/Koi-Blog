# Deployment Notes (Ubuntu + Nginx + systemd)

## Scope
This note records issues encountered during the production deployment of `copperkoi-blog` and the final stable practices.

## Environment
- OS: Ubuntu 24.04 LTS
- Reverse proxy: Nginx
- App runtime: Next.js (Node.js)
- Process manager: systemd
- Database: PostgreSQL
- Public domain: `https://copperkoi.cn`

## Issues Encountered and Fixes

### 1) `systemd` service failed with `status=203/EXEC`
Symptoms:
- `systemctl status copperkoi-blog` showed `status=203/EXEC`
- Nginx returned `502 Bad Gateway`

Root causes:
- `ExecStart` missing or placed in the wrong section
- Invalid Node/NPM path in service file

Fix:
- Keep `ExecStart` in `[Service]`
- Use absolute Node path from server environment
- Keep `WorkingDirectory` set to project root

### 2) App failed with `Could not find a production build in .next`
Symptoms:
- Service starts and exits repeatedly
- Logs mention missing production build

Fix:
- Run build before start:
  - `npm install`
  - `npm run build`
  - `systemctl restart copperkoi-blog`

### 3) Login API returned `403 Forbidden` in production
Symptoms:
- Login page always showed generic credential failure
- Direct API call returned `{"error":"Forbidden"}`

Root cause:
- Same-origin write check used `request.url` origin directly
- Behind reverse proxy, request origin may differ from public domain

Fix:
- `lib/security.ts` updated to prefer `APP_ORIGIN` in production
- Set `APP_ORIGIN=https://copperkoi.cn` in `.env.production`

### 4) Admin credentials looked correct but login still failed
Symptoms:
- `.env.production` had values, still got invalid credentials

Root causes:
- Wrong variable name used (`ADMIN_USERNAME` vs `ADMIN_USER`)
- Duplicate `ADMIN_PASSWORD_HASH` entries in `.env.production`
- `$` in bcrypt hash got expanded by dotenv and broke hash prefix

Fix:
- Use correct keys expected by code:
  - `ADMIN_USER`
  - `ADMIN_PASSWORD_HASH`
- Use bcrypt hash only
- Write hash as escaped form in `.env.production` (e.g. `\$2b\$12\$...`)
- Keep only one `ADMIN_PASSWORD_HASH` line

### 5) Homepage avatar rendered as alt text only
Symptoms:
- `CopperKoi avatar` text shown instead of image

Fix:
- Set `unoptimized` for homepage avatar `next/image` usage in `app/page.tsx`

### 6) Login returned `Invalid credentials:pass` and later `500`
Symptoms:
- Login API returned `{"error":"Invalid credentials:pass"}` although process env bcrypt check was `match=true`
- After auth fixes, API returned `500`

Root causes:
- Next.js loaded project `.env*` files at runtime and overrode expected service env values
- `COOKIE_SECURE=true` was missing in the active production env source

Fix:
- Use one production env source file: `/etc/copperkoi-blog.env`
- In `systemd`, clear old `EnvironmentFile` then set:
  - `EnvironmentFile=/etc/copperkoi-blog.env`
- Remove project-level `.env*` files from production deployment path
- Rebuild and restart after env changes:
  - `rm -rf .next && npm run build && systemctl daemon-reload && systemctl restart copperkoi-blog`

## Production `.env` Checklist
- `NODE_ENV=production`
- `FORCE_HTTPS=true`
- `COOKIE_SECURE=true`
- `COOKIE_NAME=__Host-...`
- `JWT_SECRET=<strong random>`
- `APP_ORIGIN=https://copperkoi.cn`
- `DATABASE_URL=postgres://...`
- `ADMIN_USER=copperkoi`
- `ADMIN_PASSWORD_HASH=\$2b\$12\$...`

## Verification Checklist
- `systemctl status copperkoi-blog --no-pager`
- `journalctl -u copperkoi-blog -n 100 --no-pager`
- `ss -ltnp | grep 8080`
- `curl -I http://127.0.0.1:8080`
- `curl -I https://copperkoi.cn`

Extra auth verification:
- `PID=$(systemctl show -p MainPID --value copperkoi-blog)`
- `tr '\0' '\n' < /proc/$PID/environ | grep -E '^ADMIN_USER=|^ADMIN_PASSWORD_HASH=|^COOKIE_SECURE='`
- `H=$(tr '\0' '\n' < /proc/$PID/environ | sed -n 's/^ADMIN_PASSWORD_HASH=//p')`
- `node -e 'const b=require("bcryptjs");const h=process.argv[1]||"";console.log("match=",b.compareSync("ChangeMe!",h));' "$H"`

## No-Git Server (FTP) Deployment Flow
If the server has no `git`, deploy with FTP/SFTP using this order:
1. Upload changed source files and docs.
2. Upload `package.json`/`package-lock.json` when dependencies changed.
3. On server, remove stale build output: `rm -rf .next`
4. Install deps if needed: `npm install`
5. Build and restart:
   - `npm run build`
   - `systemctl restart copperkoi-blog`

## Security Notes
- Do not commit `.env.production`
- Keep secrets rotated when sharing server access
- Restrict write endpoints with same-origin checks + HTTPS
- Keep Nginx forwarding headers (`X-Forwarded-Proto`, `X-Forwarded-For`)
