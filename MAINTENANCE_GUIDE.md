# Maintenance Guide

This guide is for framework upgrades, middleware changes, code maintenance, and production operations.

## 1. Version Strategy

### 1.1 Runtime
- Keep Node.js on active LTS for production.
- Pin Node major version in deployment scripts and service docs.

### 1.2 Framework and Dependencies
- Upgrade Next.js in small steps (minor before major).
- Run dependency updates in this order:
  1. Security patches
  2. Build/runtime dependencies
  3. Tooling/lint/dev dependencies
- Record breaking changes and migration actions in changelog or PR notes.

## 2. Upgrade Workflow

### 2.1 Before Upgrade
- Backup database.
- Confirm current app health (`systemctl`, `/api` smoke check).
- Create a rollback tag or keep previous deploy snapshot.

### 2.2 Execute Upgrade
- Update dependencies.
- Build locally and in server staging path.
- Run smoke tests for:
  - login flow
  - article create/edit/delete
  - friends create/edit/delete
  - about update
  - SSL update page access (admin only)

### 2.3 After Upgrade
- Monitor logs for at least 15-30 minutes:
  - `journalctl -u copperkoi-blog -f`
  - Nginx access/error logs
- Verify no repeated 4xx/5xx spikes.

## 3. Middleware / Security Change Checklist

When changing middleware, verify:
- `FORCE_HTTPS` behavior behind reverse proxy
- same-origin checks use public origin (`APP_ORIGIN`)
- no accidental block for normal browser requests
- production headers remain strict (HSTS, CSP, no X-Powered-By)

Also verify admin auth env integrity:
- Keep only one `ADMIN_PASSWORD_HASH` in `.env.production`
- Store bcrypt hash with escaped dollars (`\$2b\$12\$...`)
- Restart service and verify loaded env + bcrypt match

## 4. Code Maintenance Rules
- Keep API responses deterministic and explicit.
- Avoid hidden fallback secrets in production paths.
- Centralize auth/security helpers in `lib/`.
- Add comments only where behavior is non-obvious.
- Prefer small, reversible commits for risky areas.

## 5. Operations Runbook

### 5.1 Common Commands
- App status: `systemctl status copperkoi-blog --no-pager`
- App logs: `journalctl -u copperkoi-blog -n 200 --no-pager`
- Port check: `ss -ltnp | grep 8080`
- Nginx check: `nginx -t`

### 5.2 Deploy Sequence
1. Pull latest code
2. `npm install`
3. `npm run build`
4. `systemctl restart copperkoi-blog`
5. Verify with curl + browser

### 5.3 Rollback Sequence
1. Restore previous code snapshot/tag
2. `npm install` (if lockfile changed)
3. `npm run build`
4. `systemctl restart copperkoi-blog`
5. Validate critical paths

## 6. Database Maintenance
- Use a clean production database, never copy local test DB directly.
- Backup before schema-impacting changes.
- Keep migration scripts versioned and reviewable.

## 7. Incident Response
- Classify incident: availability / auth / data / security
- Capture first evidence (status, logs, timestamps)
- Mitigate first (rollback/disable risky route), then root-cause
- Write postmortem summary into deployment notes

## 8. Mandatory Pre-Release Checks
Before each production release, verify all items below:
- Auth env values come from one source (`/etc/copperkoi-blog.env`).
- No project-level `.env`, `.env.local`, `.env.production.local` left in production path.
- `COOKIE_SECURE=true`, `FORCE_HTTPS=true`, `APP_ORIGIN=https://<public-domain>`.
- `JWT_SECRET` is set and not default/fallback.
- Admin hash is bcrypt and `compareSync` check returns `true`.
- Build + restart sequence completed:
  - `rm -rf .next && npm run build && systemctl daemon-reload && systemctl restart copperkoi-blog`

## 9. No-Git Operations Policy
If production host has no `git`:
- Treat FTP/SFTP package as a release artifact.
- Keep a release folder locally with:
  - changed source files
  - changed docs
  - `package.json`/`package-lock.json` (if dependency changes)
- On server always rebuild from uploaded source; do not reuse old `.next`.
