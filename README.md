# PromptSpark

**提示火花** — 在 Composer 输入框旁一键优化提示词：点一下改写，再点还原；右键 / Alt+点击打开设置。

[![GitHub stars](https://img.shields.io/github/stars/xiaoyangtx996/PromptSpark?style=flat-square&logo=github)](https://github.com/xiaoyangtx996/PromptSpark/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/xiaoyangtx996/PromptSpark?style=flat-square)](https://github.com/xiaoyangtx996/PromptSpark/issues)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](./LICENSE)
[![认可 linux.do](https://img.shields.io/badge/认可-linux.do-blue?style=flat-square)](https://linux.do)

多宿主规划中；**当前安装入口仅开放已验证的 Cursor**（Codex / Devin / Antigravity 测试通过后再开放）。

本项目认可 [LINUX DO 社区](https://linux.do)。

<p align="center">
  <img src="./image/ui-preview.png" alt="PromptSpark 设置界面预览" width="420" />
</p>

<p align="center">
  <sub>设置面板：接口配置（OpenAI 兼容 / Anthropic）· 默认三风格 · 自定义风格 · 本地代理通道</sub>
</p>

---

## ✨ 功能特性

| 能力 | 说明 |
|:---|:---|
| 一键优化 | Composer 旁出现星星按钮，左键调用你配置的 LLM 改写当前提示词 |
| 一键还原 | 优化后再次点击，恢复原文 |
| 取消进行中 | 优化请求进行中再次点击可取消 |
| 多风格 | 内置 **简洁 / 结构化 / 编程**，并支持自定义风格（可增删） |
| 自带设置面板 | 右键或 **Alt+点击** 打开：协议、Base URL、API Key、Model、风格 |
| 协议兼容 | OpenAI 兼容接口 / Anthropic |
| 本地代理 | 自动拉起 `127.0.0.1:37841`，绕过 Cursor 等 Electron CORS 限制 |
| 一键安装 | PowerShell `irm \| iex`，无需手动 clone |

---

## 🖱️ 使用方式

安装并重启对应应用后：

1. 在聊天 / Composer 输入框写好提示词  
2. 点击输入栏旁的 **星星** 图标 → 开始优化  
3. 再点一次 → **还原**原文  
4. **右键** 或 **Alt+点击** 星星 → 打开 **PromptSpark** 设置（见上方界面预览）  

优化中图标会切换为旋转的刷新箭头；可再次点击取消。

---

## 📋 前置要求

- **Windows**（当前一键脚本面向 Windows）
- **[Node.js LTS](https://nodejs.org/)**（安装器与本地代理依赖 Node）
- 已安装 **Cursor**
- 可用的 LLM API（OpenAI 兼容或 Anthropic）

> 若尚未安装 Node：打开 https://nodejs.org/ 安装 LTS，然后**重新打开**终端再执行安装命令。

---

## 🚀 一键安装

### 全球

```powershell
irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

### 国内网络（推荐镜像）

```powershell
irm https://wget.la/https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

> 若怀疑镜像缓存了旧脚本，可加时间戳绕过：
>
> ```powershell
> irm "https://wget.la/https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1?$(Get-Date -Format yyyyMMddHHmmss)" | iex
> ```

### 安装过程会做什么？

1. 检测 Node.js  
2. 将安装器缓存到 `%LOCALAPPDATA%\PromptSpark`  
3. 交互选择要注入的应用  
4. 写入脚本 / 修补 `workbench.html`（并更新 checksum）  
5. 可选：自动重启已安装的应用  

### 指定应用 / 卸载

```powershell
# 只装 Cursor
iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Hosts cursor"

# 多应用且不自动重启
iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Hosts cursor,codex -NoRestart"

# 卸载
iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Uninstall"
```

---

## ⚙️ 首次配置

打开设置面板后填写：

| 字段 | 说明 |
|:---|:---|
| **协议** | `OpenAI 兼容` 或 `Anthropic` |
| **Base URL** | 例如 `https://api.example.com/v1`（OpenAI 兼容建议以 `/v1` 结尾） |
| **API Key** | 你的密钥 |
| **Model** | 例如 `gpt-4o-mini` / `claude-...` |
| **风格** | 默认三选一，或在「自定义」下拉中新增 |

点 **存储** 后生效。配置保存在浏览器/`localStorage`（键名兼容旧版）。

> Cursor 等环境下，请求会经本地代理 `http://127.0.0.1:37841` 转发，避免 CORS 失败。安装时一般会自动拉起代理；若优化报网络错误，可在缓存目录手动执行：`node proxy.mjs`。

---

## 🧩 支持的应用

| 应用 | 状态 | 说明 |
|:---|:---|:---|
| **Cursor** | ✅ 已开放 | 注入 `workbench.html` + 更新 `product.json` checksum |
| **Codex** | ⏳ 待验证 | 安装入口暂未开放 |
| **Devin / Windsurf** | ⏳ 待验证 | 安装入口暂未开放 |
| **Antigravity** | ⏳ 待验证 | 安装入口暂未开放 |

当前运行 `node install.mjs` / 一键脚本时，只会安装到 **Cursor**。

---

## 📦 本地 / 开发者安装

若已 clone 本仓库：

```powershell
cd path\to\PromptSpark
node install.mjs
```

非交互示例：

```powershell
node install.mjs --hosts=cursor
node install.mjs --hosts=cursor --no-restart
node install.mjs --uninstall
```

构建：

```powershell
node build.mjs
# 或：构建并重装到本机 Cursor
node scripts/rebuild-cursor.mjs
```

---

## 📁 项目结构

```text
PromptSpark/
├── scripts/
│   ├── install.ps1          # 一键安装引导（irm | iex）
│   └── rebuild-cursor.mjs   # 本地构建并装到 Cursor
├── src/
│   ├── prompt-optimize.codex-source.js
│   ├── host-adapters.js     # Cursor / Devin / Antigravity 挂载
│   ├── settings-dom.js      # 设置面板（Trusted Types 安全）
│   └── theme-css.css
├── dist/
│   └── prompt-optimize.js   # 构建产物（安装注入用）
├── install.mjs              # 跨应用安装器
├── proxy.mjs                # 本地 LLM 代理（CORS）
├── build.mjs
└── README.md
```

---

## ❓ 常见问题

**Q: 执行 `irm | iex` 报错找不到 Node？**  
先安装 [Node.js LTS](https://nodejs.org/)，关闭并重新打开 PowerShell 再试。

**Q: 安装成功但看不到星星按钮？**  
请**完全退出**对应应用（托盘图标也要退出）后再打开。Cursor 修补 workbench 后必须冷启动。

**Q: 点击优化提示 Failed to fetch / CORS？**  
确认本地代理在跑：`http://127.0.0.1:37841`。可在 `%LOCALAPPDATA%\PromptSpark` 执行 `node proxy.mjs`。

**Q: 协议选 Anthropic 但模型是 gpt-xxx？**  
请改用「OpenAI 兼容」，或换成 Claude 模型。保存时可能自动纠正明显不匹配的组合。

**Q: 自定义风格存了再打开不见了？**  
请使用较新版本（≥ 1.2.4）。务必点击设置里的 **存储**；仅「新增」不会落盘。

**Q: 如何卸载？**  
```powershell
iex "& { $(irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1) } -Uninstall"
```
或本地：`node install.mjs --uninstall`

**Q: macOS / Linux？**  
当前一键脚本以 Windows 为主；欢迎 Issue / PR 补充 shell 引导脚本。

---

## 🔒 安全说明

- 安装器会修改目标**原生应用**的 `workbench.html`（并尽量更新 `product.json` checksum）  
- API Key 仅保存在本机设置存储中，不会上传到本仓库  
- 请从本仓库官方地址获取安装脚本，勿运行来源不明的拷贝  
- 使用第三方 API 时请遵守对应服务商条款  

---

## 💬 反馈

- Bug / 需求：提交 [Issues](https://github.com/xiaoyangtx996/PromptSpark/issues)  
- 欢迎 PR：改进安装体验、宿主适配、文档与动效  
- 社区讨论欢迎到 [LINUX DO](https://linux.do)（本项目认可该社区）  

---

## 📄 License

[MIT](./LICENSE) © PromptSpark contributors
