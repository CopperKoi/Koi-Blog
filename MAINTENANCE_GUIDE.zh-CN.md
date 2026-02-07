# 维护指南

本文用于指导后续框架升级、中间件调整、代码维护与生产运维。

## 1. 版本策略

### 1.1 运行时
- 生产环境建议使用 Node.js 的当前 LTS 版本。
- 在部署脚本和服务文档中固定 Node 主版本。

### 1.2 框架与依赖
- Next.js 升级建议小步进行（先小版本，再大版本）。
- 依赖升级顺序建议：
  1. 安全补丁
  2. 构建/运行时依赖
  3. 工具链/开发依赖
- 对破坏性变更与迁移动作做记录（changelog 或 PR 说明）。

## 2. 升级流程

### 2.1 升级前
- 先备份数据库。
- 确认当前服务健康（`systemctl`、`/api` 冒烟检查）。
- 准备回滚点（tag 或上一版部署快照）。

### 2.2 执行升级
- 更新依赖。
- 在本地和服务器预发路径完成构建验证。
- 对以下关键流程做冒烟测试：
  - 登录流程
  - 文章增删改
  - 友链增删改
  - 关于页更新
  - SSL 更新页访问（仅管理员）

### 2.3 升级后
- 持续观察 15~30 分钟日志：
  - `journalctl -u copperkoi-blog -f`
  - Nginx access/error 日志
- 确认没有持续 4xx/5xx 异常增长。

## 3. 中间件 / 安全改动检查清单

修改中间件时，至少确认：
- 反代场景下 `FORCE_HTTPS` 行为正确
- 同源校验使用公网域名（`APP_ORIGIN`）
- 不会误伤正常浏览器请求
- 生产安全响应头仍有效（HSTS、CSP、去除 X-Powered-By）

同时校验管理员鉴权环境变量：
- `.env.production` 仅保留一行 `ADMIN_PASSWORD_HASH`
- bcrypt 哈希以转义美元符写入（`\$2b\$12\$...`）
- 重启服务后验证已加载值与 bcrypt 比对结果

## 4. 代码维护规则
- API 返回要明确、可预期。
- 生产路径中不要保留隐藏兜底密钥。
- 将鉴权与安全逻辑集中在 `lib/`。
- 仅在行为不直观处添加必要注释。
- 高风险改动尽量拆成小提交，便于回滚。

## 5. 运维手册

### 5.1 常用命令
- 服务状态：`systemctl status copperkoi-blog --no-pager`
- 服务日志：`journalctl -u copperkoi-blog -n 200 --no-pager`
- 端口检查：`ss -ltnp | grep 8080`
- Nginx 配置检查：`nginx -t`

### 5.2 发布流程
1. 拉取最新代码
2. `npm install`
3. `npm run build`
4. `systemctl restart copperkoi-blog`
5. 用 curl + 浏览器做验证

### 5.3 回滚流程
1. 切回上一版代码（tag/快照）
2. `npm install`（如 lockfile 变化）
3. `npm run build`
4. `systemctl restart copperkoi-blog`
5. 验证关键路径

## 6. 数据库维护
- 生产环境使用独立干净数据库，不直接复用本地测试库。
- 涉及 schema 变更前先备份。
- 迁移脚本需版本化并可审计。

## 7. 事故响应
- 先归类：可用性 / 鉴权 / 数据 / 安全
- 第一时间保留证据（状态、日志、时间线）
- 先止损（回滚/下线风险路由），再做根因分析
- 将复盘结论补充到部署记录文档

## 8. 发布前强制检查项
每次生产发布前，必须完成以下检查：
- 鉴权相关环境变量只有一个来源（`/etc/copperkoi-blog.env`）。
- 生产目录中不存在 `.env`、`.env.local`、`.env.production.local`。
- `COOKIE_SECURE=true`、`FORCE_HTTPS=true`、`APP_ORIGIN=https://<公网域名>`。
- `JWT_SECRET` 已设置，且不是默认/兜底值。
- 管理员密码哈希为 bcrypt，`compareSync` 校验结果为 `true`。
- 完整执行构建与重启：
  - `rm -rf .next && npm run build && systemctl daemon-reload && systemctl restart copperkoi-blog`

## 9. 无 Git 运维策略
当生产机没有 `git` 时：
- 将 FTP/SFTP 上传包视为正式发布产物。
- 本地维护发布目录，至少包含：
  - 变更源码
  - 变更文档
  - `package.json`/`package-lock.json`（如依赖有变化）
- 服务器端必须基于上传后的源码重新构建，不复用旧 `.next`。
