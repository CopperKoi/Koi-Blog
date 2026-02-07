# 环境变量配置（`.env`）

项目运行依赖 `.env` 配置。
请勿将真实密钥提交到 Git。

## 生产环境基线

以下配置在生产环境必须满足：

```env
NODE_ENV=production
FORCE_HTTPS=true
COOKIE_SECURE=true
COOKIE_NAME=__Host-blog_session
JWT_SECRET=<高强度随机密钥>
ADMIN_PASSWORD_HASH=<转义后的bcrypt-hash>
APP_ORIGIN=https://copperkoi.cn
```

## 生产环境配置源策略

生产环境建议只使用一个由 systemd 管理的环境文件：
- `/etc/copperkoi-blog.env`

推荐的服务覆盖配置：

```ini
[Service]
EnvironmentFile=
EnvironmentFile=/etc/copperkoi-blog.env
```

重要说明：
- 服务器项目目录中不要保留鉴权/安全相关 `.env*`。
- Next.js 运行时可能加载 `.env*`，从而覆盖进程期望环境变量。

## 必要变量

```env
# 数据库
DATABASE_URL=postgres://user:password@127.0.0.1:5432/blog_db

# 管理员账号
ADMIN_USER=copperkoi
# 可选兼容旧变量名：ADMIN_USERNAME
ADMIN_PASSWORD_HASH=<转义后的bcrypt-hash>

# 鉴权 / 会话
JWT_SECRET=<高强度随机密钥>
COOKIE_NAME=__Host-blog_session
COOKIE_SECURE=true

# 中间件强制 HTTPS
FORCE_HTTPS=true

# 写请求同源校验使用的公网 origin
APP_ORIGIN=https://copperkoi.cn

# 前端 API 基址（可选，留空表示同源 /api）
NEXT_PUBLIC_API_BASE=

# SSL 更新接口使用的证书路径
SSL_KEY_PATH=/path/to/copperkoi.cn.key
SSL_CERT_PATH=/path/to/copperkoi.cn.pem
```

## 生成 bcrypt 哈希

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('ChangeMe!',12))"
```

## 安全写入 `ADMIN_PASSWORD_HASH`

写入 `.env.production` 时需要把 `$` 转义为 `\$`，避免 dotenv 展开把 bcrypt 前缀吃掉：

```bash
RAW_HASH=$(node -e "const b=require('bcryptjs');process.stdout.write(b.hashSync('ChangeMe!',12));")
ESC_HASH=$(printf '%s' "$RAW_HASH" | sed 's/\\$/\\\\$/g')
sed -i '/^ADMIN_USER=/d;/^ADMIN_PASSWORD_HASH=/d' .env.production
printf 'ADMIN_USER=copperkoi\nADMIN_PASSWORD_HASH=%s\n' "$ESC_HASH" >> .env.production
```

文件中期望值应以 `\$2b\$12\$...` 形式出现。

## 校验加载后的哈希

```bash
node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(), false); const b=require("bcryptjs"); const h=process.env.ADMIN_PASSWORD_HASH||""; console.log("prefix",h.slice(0,4)); console.log("match",b.compareSync("ChangeMe!",h));'
```

期望：
- `prefix` 为 `$2b$`（或 `$2a$`/`$2y$`）
- `match` 为 `true`

## 安全说明

- 生产环境保持 `FORCE_HTTPS=true` 并部署在 TLS 后。
- 生产环境保持 `COOKIE_SECURE=true`。
- `JWT_SECRET` 使用高熵随机值（至少 32 字节）。
- `APP_ORIGIN` 必须与线上 HTTPS 域名一致。
- 静态服务规则中禁止暴露 `.env` 文件。
- 生产环境不要使用默认或兜底密钥。
