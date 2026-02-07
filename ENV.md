# Environment Configuration (`.env`)

This project uses `.env` for runtime configuration.
Never commit real secrets to Git.

## Production baseline

The following values are mandatory in production:

```env
NODE_ENV=production
FORCE_HTTPS=true
COOKIE_SECURE=true
COOKIE_NAME=__Host-blog_session
JWT_SECRET=<strong-random-secret>
ADMIN_PASSWORD_HASH=<escaped-bcrypt-hash>
APP_ORIGIN=https://copperkoi.cn
```

## Production source-of-truth policy

For production, use one env file managed by systemd:
- `/etc/copperkoi-blog.env`

Recommended service override:

```ini
[Service]
EnvironmentFile=
EnvironmentFile=/etc/copperkoi-blog.env
```

Important:
- Do **not** keep auth/security keys in project-level `.env*` files on server.
- Next.js may load `.env*` at runtime and override expected process env values.

## Required variables

```env
# Database
DATABASE_URL=postgres://user:password@127.0.0.1:5432/blog_db

# Admin account
ADMIN_USER=copperkoi
# Optional legacy alias still accepted: ADMIN_USERNAME
ADMIN_PASSWORD_HASH=<escaped-bcrypt-hash>

# Auth/session
JWT_SECRET=<strong-random-secret>
COOKIE_NAME=__Host-blog_session
COOKIE_SECURE=true

# Enforce HTTPS in middleware
FORCE_HTTPS=true

# Public origin for write request same-origin validation
APP_ORIGIN=https://copperkoi.cn

# Public API base (optional, empty means same-origin /api)
NEXT_PUBLIC_API_BASE=

# SSL update API write targets
SSL_KEY_PATH=/path/to/copperkoi.cn.key
SSL_CERT_PATH=/path/to/copperkoi.cn.pem
```

## Generate bcrypt hash

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('ChangeMe!',12))"
```

## Write `ADMIN_PASSWORD_HASH` safely

Use escaped dollars when writing `.env.production` to prevent dotenv expansion from stripping bcrypt prefix:

```bash
RAW_HASH=$(node -e "const b=require('bcryptjs');process.stdout.write(b.hashSync('ChangeMe!',12));")
ESC_HASH=$(printf '%s' "$RAW_HASH" | sed 's/\\$/\\\\$/g')
sed -i '/^ADMIN_USER=/d;/^ADMIN_PASSWORD_HASH=/d' .env.production
printf 'ADMIN_USER=copperkoi\nADMIN_PASSWORD_HASH=%s\n' "$ESC_HASH" >> .env.production
```

Expected stored form starts with `\$2b\$12\$...` in file.

## Validate loaded hash

```bash
node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(), false); const b=require("bcryptjs"); const h=process.env.ADMIN_PASSWORD_HASH||""; console.log("prefix",h.slice(0,4)); console.log("match",b.compareSync("ChangeMe!",h));'
```

Expected:
- `prefix` is `$2b$` (or `$2a$`/`$2y$`)
- `match` is `true`

## Security notes

- Keep `FORCE_HTTPS=true` and deploy behind TLS.
- Keep `COOKIE_SECURE=true` in production.
- Use a high-entropy `JWT_SECRET` (at least 32 bytes random).
- Keep `APP_ORIGIN` equal to your public HTTPS domain.
- Do not expose `.env` via static file server rules.
- Do not run production with default/fallback secrets.
