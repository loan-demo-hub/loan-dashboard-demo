# Deployment Guide

Static single-page app — **no build step required**.

## Prerequisites

- Entry point: `index.html` at project root
- All assets use **relative paths** (works on Vercel root deploy and GitHub Pages project sites)

## Vercel

1. Push repository to GitHub
2. Import project in [Vercel](https://vercel.com)
3. **Framework Preset:** Other
4. **Root Directory:** `loan-dashboard-demo` (if repo contains parent folder) or `.` (if repo root is the demo)
5. **Build Command:** leave empty
6. **Output Directory:** `.`
7. Deploy

`vercel.json` is included for cache headers on static assets.

### LongCat on Vercel

Static hosting has no `/api/longcat` proxy. In **API 设置**:

- Disable「通过本地代理」
- Set **API Base URL** to `https://api.longcat.chat/openai`
- Enter your **API Key**

## GitHub Pages

### 方式 A：一键脚本（推荐，需 Git + GitHub CLI）

```powershell
cd loan-dashboard-demo
powershell -ExecutionPolicy Bypass -File tools\setup-github-pages.ps1
```

可选参数：仓库名（默认 `loan-dashboard-demo`）、`--private` 私有仓库。

脚本会：init → commit → 创建 GitHub 仓库 → push → 触发 Actions 部署。

### 方式 B：手动步骤

1. 在 GitHub 新建仓库（如 `loan-dashboard-demo`）
2. 在本目录执行：

```bash
git init -b main
git add -A
git commit -m "chore: deploy to GitHub Pages"
git remote add origin https://github.com/<用户名>/loan-dashboard-demo.git
git push -u origin main
```

3. **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
4. 工作流 `.github/workflows/deploy-pages.yml` 会在 push 后自动部署

`.nojekyll` 已包含，避免 Jekyll 干扰静态资源。

## Local development (optional)

```bat
start-server.bat
```

Opens `http://127.0.0.1:8765` with LongCat proxy at `/api/longcat`.

## Pre-deploy checklist

- [ ] Open app — status bar shows `规则 7 条 · 逾期原因标签 36 条`
- [ ] Select contract — summary renders without errors
- [ ] First chat message — analysis card appears
- [ ] Second message — natural language reply (not card)
- [ ] Browser console — no uncaught errors on load
- [ ] Hard refresh — mock data loads (YAML fetch or bundle fallback)
- [ ] Mobile / 1024px — layout does not overflow horizontally

## Regenerate overdue tags bundle (maintainers)

After editing `mock-data/overdue_reason_tags.yaml`:

```bat
cscript //Nologo tools\generate-overdue-bundle.js
```
