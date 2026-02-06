# CopperKoi Blog

A production-ready personal blog built with Next.js (App Router), PostgreSQL, and Nginx reverse proxy.

## Highlights
- Content publishing and management for a single admin account (`copperkoi`)
- Markdown editing and rendering with code highlighting
- Public pages: home, article list, search, about, friends
- Admin pages: post management, about editing, SSL update entry
- Secure session cookie policy for production (`__Host-...`, `HttpOnly`, `SameSite=Strict`)
- HTTPS-first deployment design behind Nginx

## Tech Stack
- Frontend & backend runtime: Next.js 16 (App Router)
- Language: TypeScript
- Database: PostgreSQL
- Process manager: systemd
- Reverse proxy / TLS termination: Nginx

## Project Structure
- `app/`: routes and API handlers
- `components/`: reusable UI components
- `lib/`: auth, security, DB utilities
- `public/`: static assets
- `ENV.md`: environment variable reference
- `DEPLOYMENT_NOTES.md`: deployment troubleshooting notes
- `MAINTENANCE_GUIDE.md`: long-term maintenance and upgrade playbook

## Security Baseline
- `FORCE_HTTPS=true` in production
- `COOKIE_SECURE=true` in production
- `APP_ORIGIN` configured to public domain
- Write APIs protected by same-origin checks in production
- Sensitive config kept in `.env.production` only

## Documentation
- English docs and Chinese translated docs are both provided.
- Chinese files are named with `.zh-CN.md` suffix.

## License
Private/internal use by repository owner unless otherwise stated.
