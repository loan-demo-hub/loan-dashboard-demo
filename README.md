# 智能催收助手

贷款逾期催收智能看板 — 规则引擎 + 逾期原因标签 + AI 对话（LongCat 可选）。

**在线演示：** 部署完成后访问 `https://<你的用户名>.github.io/<仓库名>/`

## 本地运行

```bat
start-server.bat
```

浏览器打开 http://127.0.0.1:8765

## 部署

见 [DEPLOY.md](./DEPLOY.md) 与 [RELEASE.md](./RELEASE.md)。

### GitHub Pages（推荐）

1. 将本目录推送到 GitHub 仓库
2. **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
3. 推送 `main` 分支后，Actions 会自动部署

或使用脚本（需已安装 Git）：

```powershell
powershell -ExecutionPolicy Bypass -File tools\setup-github-pages.ps1
```

## 技术栈

纯静态：HTML / CSS / JavaScript，无构建步骤。
