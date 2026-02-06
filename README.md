# Koi Blog

这是一个基于 Next.js（App Router）+ PostgreSQL + Nginx 的个人博客项目，包含前台浏览与后台内容管理能力。

## 在线站点
- 已部署地址：`https://copperkoi.cn`

## 重要说明
- 部分实际部署路径与本仓库中的路径不一致（已做公开仓库脱敏处理）。

## 功能概览
- 文章发布、编辑、删除
- Markdown 渲染与代码高亮
- 首页、文章总览、检索、关于、友链页面
- 管理端登录与基础运维入口

## 技术栈
- Next.js 16（App Router）
- TypeScript
- PostgreSQL
- Nginx + systemd

## 项目结构
- `app/`：页面与 API 路由
- `components/`：通用组件
- `lib/`：鉴权、安全、数据库工具
- `public/`：静态资源

## 安全基线（生产环境）
- `FORCE_HTTPS=true`
- `COOKIE_SECURE=true`
- `APP_ORIGIN` 配置为线上域名
- 写接口启用同源校验

## 许可证
- MIT（见 `LICENSE`）
