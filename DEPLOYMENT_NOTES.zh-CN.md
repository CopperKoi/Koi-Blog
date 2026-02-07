# 部署记录（Ubuntu + Nginx + systemd）

## 适用范围
本文记录 `copperkoi-blog` 生产部署过程中遇到的问题和最终稳定做法。

## 环境信息
- 操作系统：Ubuntu 24.04 LTS
- 反向代理：Nginx
- 应用运行时：Next.js（Node.js）
- 进程管理：systemd
- 数据库：PostgreSQL
- 公网域名：`https://copperkoi.cn`

## 部署问题与修复

### 1) `systemd` 服务 `status=203/EXEC`
现象：
- `systemctl status copperkoi-blog` 出现 `status=203/EXEC`
- Nginx 返回 `502 Bad Gateway`

原因：
- `ExecStart` 缺失或写在错误 section
- 服务文件中 Node/NPM 路径无效

修复：
- `ExecStart` 必须放在 `[Service]`
- 使用服务器上的 Node 绝对路径
- `WorkingDirectory` 指向项目根目录

### 2) 启动报错：缺少 `.next` 生产构建
现象：
- 服务反复拉起后退出
- 日志提示没有 production build

修复：
- 启动前先构建：
  - `npm install`
  - `npm run build`
  - `systemctl restart copperkoi-blog`

### 3) 生产环境登录接口返回 `403 Forbidden`
现象：
- 登录页提示账号密码错误
- 直接请求 API 返回 `{"error":"Forbidden"}`

原因：
- 写接口同源校验直接使用 `request.url` 的 origin
- 反代场景下请求 origin 可能是内网地址

修复：
- `lib/security.ts` 改为生产优先使用 `APP_ORIGIN`
- `.env.production` 配置 `APP_ORIGIN=https://copperkoi.cn`

### 4) 管理员配置看似正确但无法登录
现象：
- `.env.production` 已配置，仍提示凭据错误

原因：
- 使用了错误变量名（`ADMIN_USERNAME` vs `ADMIN_USER`）
- `.env.production` 中存在重复的 `ADMIN_PASSWORD_HASH`
- bcrypt 哈希中的 `$` 被 dotenv 展开，导致前缀损坏

修复：
- 使用代码要求的键名：
  - `ADMIN_USER`
  - `ADMIN_PASSWORD_HASH`
- 仅使用 bcrypt 哈希
- `.env.production` 中使用转义形式写入（如 `\$2b\$12\$...`）
- 保证 `ADMIN_PASSWORD_HASH` 仅保留一行

### 5) 首页头像只显示替代文本
现象：
- 页面出现 `CopperKoi avatar` 文本，图片未显示

修复：
- 在 `app/page.tsx` 头像 `next/image` 上增加 `unoptimized`

### 6) 登录先报 `Invalid credentials:pass`，后报 `500`
现象：
- 登录接口返回 `{"error":"Invalid credentials:pass"}`，但进程环境中的 bcrypt 比对是 `match=true`
- 修完鉴权后接口返回 `500`

根因：
- Next.js 运行时会加载项目目录下 `.env*`，覆盖了服务进程预期环境变量
- 生效环境中缺少 `COOKIE_SECURE=true`，导致签发会话时触发安全配置异常

修复：
- 生产环境只保留一个配置源：`/etc/copperkoi-blog.env`
- `systemd` 中先清空旧 `EnvironmentFile`，再设置：
  - `EnvironmentFile=/etc/copperkoi-blog.env`
- 生产部署目录移除项目内 `.env*`
- 环境变量变更后必须重建并重启：
  - `rm -rf .next && npm run build && systemctl daemon-reload && systemctl restart copperkoi-blog`

## 生产 `.env` 核对清单
- `NODE_ENV=production`
- `FORCE_HTTPS=true`
- `COOKIE_SECURE=true`
- `COOKIE_NAME=__Host-...`
- `JWT_SECRET=<高强度随机值>`
- `APP_ORIGIN=https://copperkoi.cn`
- `DATABASE_URL=postgres://...`
- `ADMIN_USER=copperkoi`
- `ADMIN_PASSWORD_HASH=\$2b\$12\$...`

## 验证清单
- `systemctl status copperkoi-blog --no-pager`
- `journalctl -u copperkoi-blog -n 100 --no-pager`
- `ss -ltnp | grep 8080`
- `curl -I http://127.0.0.1:8080`
- `curl -I https://copperkoi.cn`

鉴权专项核验：
- `PID=$(systemctl show -p MainPID --value copperkoi-blog)`
- `tr '\0' '\n' < /proc/$PID/environ | grep -E '^ADMIN_USER=|^ADMIN_PASSWORD_HASH=|^COOKIE_SECURE='`
- `H=$(tr '\0' '\n' < /proc/$PID/environ | sed -n 's/^ADMIN_PASSWORD_HASH=//p')`
- `node -e 'const b=require("bcryptjs");const h=process.argv[1]||"";console.log("match=",b.compareSync("ChangeMe!",h));' "$H"`

## 无 Git 服务器（FTP/SFTP）发布流程
如果服务器没有 `git`，请按以下顺序发布：
1. 上传本次改动的源码和文档。
2. 若依赖变更，同时上传 `package.json`/`package-lock.json`。
3. 服务器删除旧构建：`rm -rf .next`
4. 必要时安装依赖：`npm install`
5. 构建并重启：
   - `npm run build`
   - `systemctl restart copperkoi-blog`

## 安全注意事项
- 不要提交 `.env.production`
- 多人协作时定期轮换密钥
- 写接口应保留同源校验并强制 HTTPS
- Nginx 保留转发头（`X-Forwarded-Proto`、`X-Forwarded-For`）
