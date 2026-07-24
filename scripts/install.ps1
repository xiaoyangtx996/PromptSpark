#Requires -Version 5.1
<#
.SYNOPSIS
  PromptSpark 一键安装 / 卸载（Windows）

.DESCRIPTION
  从 GitHub 拉取安装器到本地缓存，注入已验证宿主（当前仅 Cursor）。

.EXAMPLE
  # 推荐：一键安装
  irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex

.EXAMPLE
  # 国内加速（可选）
  irm https://wget.la/https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex

.EXAMPLE
  # 带参数
  iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Hosts cursor -NoRestart"
  iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Uninstall"
#>
param(
  [switch]$Uninstall,
  [string]$Hosts = "",
  [switch]$NoRestart,
  [string]$Branch = "main",
  [string]$Repo = "xiaoyangtx996/PromptSpark"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$InstallDir = Join-Path $env:LOCALAPPDATA "PromptSpark"
$RawBase = "https://raw.githubusercontent.com/$Repo/$Branch"
$RawMirrors = @(
  $RawBase,
  "https://wget.la/$RawBase",
  "https://cdn.jsdelivr.net/gh/$Repo@$Branch"
)

function Write-Step([string]$Message) {
  Write-Host "→ $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Err([string]$Message) {
  Write-Host "✗ $Message" -ForegroundColor Red
}

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\node\node.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Ensure-Node {
  $node = Get-NodePath
  if ($node) {
    $ver = & $node -v 2>$null
    Write-Ok "Node.js $ver"
    return $node
  }
  Write-Err "未检测到 Node.js（安装器依赖 Node 运行）。"
  Write-Host "请先安装 LTS：https://nodejs.org/  安装后重新打开终端再执行本命令。" -ForegroundColor Yellow
  exit 1
}

function Try-Download([string]$Url, [string]$OutFile) {
  try {
    $dir = Split-Path -Parent $OutFile
    if (-not (Test-Path $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 60
    if ((Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 0)) {
      return $true
    }
  } catch {
    # try next mirror
  }
  return $false
}

function Download-File([string]$RelativePath, [string]$OutFile) {
  foreach ($base in $RawMirrors) {
    $url = "$base/$RelativePath".Replace("\", "/")
    Write-Step "下载 $RelativePath"
    if (Try-Download -Url $url -OutFile $OutFile) {
      Write-Ok $RelativePath
      return
    }
  }
  throw "无法下载 $RelativePath（已尝试 GitHub / wget.la / jsDelivr）"
}

function Sync-Installer {
  Write-Step "安装目录: $InstallDir"
  New-Item -ItemType Directory -Path (Join-Path $InstallDir "dist") -Force | Out-Null

  Download-File "install.mjs" (Join-Path $InstallDir "install.mjs")
  Download-File "proxy.mjs" (Join-Path $InstallDir "proxy.mjs")
  Download-File "dist/prompt-optimize.js" (Join-Path $InstallDir "dist\prompt-optimize.js")

  # optional helpers (best-effort)
  Try-Download -Url "$RawBase/package.json" -OutFile (Join-Path $InstallDir "package.json") | Out-Null
  Try-Download -Url "$RawBase/install.cmd" -OutFile (Join-Path $InstallDir "install.cmd") | Out-Null
}

function Invoke-Installer([string]$NodePath) {
  $args = @()
  if ($Uninstall) { $args += "--uninstall" }
  if ($NoRestart) { $args += "--no-restart" }
  if ($Hosts -and $Hosts.Trim().Length -gt 0) {
    $args += "--hosts=$($Hosts.Trim())"
  }

  $action = if ($Uninstall) { "卸载" } else { "安装" }
  Write-Host ""
  Write-Host "PromptSpark  ·  一键$action" -ForegroundColor Magenta
  Write-Host ""

  Push-Location $InstallDir
  try {
    & $NodePath ".\install.mjs" @args
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($null -ne $code -and $code -ne 0) {
    exit $code
  }
}

# ── main ──
Write-Host ""
Write-Host "PromptSpark bootstrap" -ForegroundColor Magenta
Write-Host "https://github.com/$Repo" -ForegroundColor DarkGray
Write-Host ""

$nodePath = Ensure-Node
Sync-Installer
Invoke-Installer -NodePath $nodePath
