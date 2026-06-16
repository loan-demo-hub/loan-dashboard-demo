$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Find-Git {
    $candidates = @(
        "git",
        "C:\Program Files\Git\bin\git.exe",
        "C:\Program Files (x86)\Git\bin\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
    )
    foreach ($c in $candidates) {
        if ($c -eq "git") {
            $cmd = Get-Command git -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
        } elseif (Test-Path $c) {
            return $c
        }
    }
    return $null
}

function Find-Gh {
    $candidates = @("gh", "$env:ProgramFiles\GitHub CLI\gh.exe", "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe")
    foreach ($c in $candidates) {
        if ($c -eq "gh") {
            $cmd = Get-Command gh -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
        } elseif (Test-Path $c) {
            return $c
        }
    }
    return $null
}

$git = Find-Git
if (-not $git) {
    Write-Host ""
    Write-Host "未检测到 Git。请先安装：" -ForegroundColor Red
    Write-Host "  https://git-scm.com/download/win"
    Write-Host ""
    Write-Host "安装后重新运行："
    Write-Host "  powershell -ExecutionPolicy Bypass -File tools\setup-github-pages.ps1"
    Write-Host ""
    exit 1
}

function Invoke-Git {
    param([string[]]$Args)
    & $git @Args
    if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') failed ($LASTEXITCODE)" }
}

$gh = Find-Gh
$repoName = if ($args[0]) { $args[0] } else { "loan-dashboard-demo" }
$isPrivate = $false
if ($args -contains "--private") { $isPrivate = $true }

Write-Host ""
Write-Host "=== GitHub Pages 初始化 ===" -ForegroundColor Cyan
Write-Host "目录: $Root"
Write-Host ""

if (-not (Test-Path ".git")) {
    Write-Host "[1/5] git init ..."
    Invoke-Git @("init", "-b", "main")
} else {
    Write-Host "[1/5] 已有 Git 仓库，跳过 init"
}

Write-Host "[2/5] git add ..."
Invoke-Git @("add", "-A")

$status = & $git status --porcelain
if ($status) {
    Write-Host "[3/5] git commit ..."
    Invoke-Git @("commit", "-m", "chore: initial release for GitHub Pages")
} else {
    Write-Host "[3/5] 无新变更，跳过 commit"
}

$remoteUrl = & $git remote get-url origin 2>$null
if (-not $remoteUrl) {
    if (-not $gh) {
        Write-Host ""
        Write-Host "未检测到 GitHub CLI (gh)。请手动：" -ForegroundColor Yellow
        Write-Host "  1. 在 GitHub 新建仓库: $repoName"
        Write-Host "  2. 运行:"
        Write-Host "     git remote add origin https://github.com/<用户名>/$repoName.git"
        Write-Host "     git push -u origin main"
        Write-Host "  3. GitHub → Settings → Pages → Source 选 GitHub Actions"
        Write-Host ""
        exit 0
    }

    Write-Host "[4/5] gh repo create ..."
    $visibility = if ($isPrivate) { "--private" } else { "--public" }
    & $gh repo create $repoName --source=. --remote=origin --push $visibility
    if ($LASTEXITCODE -ne 0) { throw "gh repo create failed" }
} else {
    Write-Host "[4/5] 已有 remote: $remoteUrl"
    Write-Host "      git push ..."
    Invoke-Git @("push", "-u", "origin", "main")
}

Write-Host "[5/5] 启用 GitHub Pages (Actions) ..."
if ($gh) {
    & $gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow 2>$null
    Write-Host ""
    $pagesUrl = & $gh repo view --json url -q ".url" 2>$null
    if ($pagesUrl) {
        $site = $pagesUrl -replace "github.com", "github.io"
        Write-Host "部署已触发。约 1–2 分钟后访问：" -ForegroundColor Green
        Write-Host "  $site"
    }
    Write-Host ""
    Write-Host "Actions 进度: gh run list --workflow=deploy-pages.yml"
} else {
    Write-Host "请在 GitHub 仓库 Settings → Pages → Source 选择 GitHub Actions"
}

Write-Host ""
Write-Host "完成。" -ForegroundColor Green
Write-Host ""
