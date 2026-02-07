# Koi Blog

这是一个基于 Next.js（App Router）+ PostgreSQL + Nginx 反向代理的可生产部署个人博客项目。

> 给我爆点⭐！

## 功能概览
- 支持 Markdown 编辑与渲染，包含代码高亮
- 公开页面：首页、文章总览、检索、关于、友链
- 管理页面：文章管理、关于页编辑、SSL 更新入口
- 生产环境会话安全策略（`__Host-...`、`HttpOnly`、`SameSite=Strict`）
- 默认面向 HTTPS 部署（Nginx 终止 TLS）

## 技术栈
- 前后端运行时：Next.js 16（App Router）
- 语言：TypeScript
- 数据库：PostgreSQL
- 进程管理：systemd
- 反向代理 / TLS：Nginx

## 项目结构
- `app/`：页面路由与 API 路由
- `components/`：可复用 UI 组件
- `lib/`：鉴权、安全、数据库工具
- `public/`：静态资源

## 安全基线
- 生产环境启用 `FORCE_HTTPS=true`
- 生产环境启用 `COOKIE_SECURE=true`
- 配置 `APP_ORIGIN` 为线上域名
- 生产环境写接口启用同源校验
- 敏感配置仅放在 `.env.production`

## 文档说明
- 长期升级与运维检查清单：`MAINTENANCE_GUIDE.md`
- 生产环境变量配置与检查：`ENV.md`
