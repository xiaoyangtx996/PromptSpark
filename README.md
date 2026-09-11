<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="PromptSpark：在 Cursor Composer 内一键优化、还原和管理提示词">
</p>

<p align="center">
  <a href="https://github.com/xiaoyangtx996/PromptSpark/stargazers"><img src="https://img.shields.io/github/stars/xiaoyangtx996/PromptSpark?style=flat-square&logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/xiaoyangtx996/PromptSpark/issues"><img src="https://img.shields.io/github/issues/xiaoyangtx996/PromptSpark?style=flat-square&label=Issues" alt="GitHub issues"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4C8DFF.svg?style=flat-square" alt="MIT License"></a>
</p>

PromptSpark 在 **Cursor** Composer 输入框旁增加一个优化按钮。写好草稿后点击一次，由你配置的 LLM 改写；再次点击即可恢复原文。右键或 `Alt + 点击` 打开设置。

> 本仓库 **只支持 Cursor（Windows）**。  
> Codex 桌面端请使用 [Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)（已内置 PromptSpark）。

## 界面预览

<p align="center">
  <img src="./image/ui-preview.png" alt="PromptSpark 设置面板，包含接口、模型和提示词风格配置" width="430">
</p>

<p align="center"><sub>设置 OpenAI 兼容或 Anthropic 接口，选择内置风格，或维护自己的 system prompt。</sub></p>

## 能做什么

- **优化与还原**：点击优化当前提示词，再次点击恢复原文。
- **继续发送**：优化按钮左侧的「继续」会写入「继续」并自动发送。
- **随时取消**：请求进行中再次点击即可停止。
- **多种风格**：内置简洁、结构化、编程三种风格，支持自定义增删。
- **接口自选**：兼容 OpenAI 风格接口和 Anthropic API。
- **本地代理**：自动使用 `127.0.0.1:37841`；由 Cursor 扩展随进程启动。
- **就地配置**：右键或 `Alt + 点击` 优化按钮，直接设置协议、Base URL、API Key、模型和风格。

## 快速开始

### 前置要求

- Windows
- [Node.js LTS](https://nodejs.org/)
- Cursor
- OpenAI 兼容或 Anthropic API

### 一键安装

在系统 PowerShell 中运行：

```powershell
irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

国内网络可使用镜像：

```powershell
irm https://wget.la/https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

安装器会请求 UAC 管理员权限，关闭 Cursor，写入外部脚本并更新 checksum，随后重新启动 Cursor。写入遇到占用时最多重试 3 次。

安装后：

1. 在 Cursor Composer 中输入提示词。
2. 点击输入框右侧的闪光按钮开始优化。
3. 再次点击恢复原文；优化过程中点击则取消请求。
4. 右键或 `Alt + 点击` 按钮，完成首次配置。

## 首次配置

| 字段 | 填写内容 |
|:---|:---|
| 协议 | `OpenAI 兼容` 或 `Anthropic` |
| Base URL | 例如 `https://api.example.com/v1` |
| API Key | 对应服务商的 API 密钥 |
| Model | 例如 `gpt-4o-mini` 或 `claude-...` |
| 风格 | 内置风格，或自定义名称和 system prompt |

点击 **存储** 后生效。配置保存在 Cursor 的本地存储中；API 请求通过本机代理转发。

## 安装与卸载

指定 Cursor 或跳过自动重启：

```powershell
node install.mjs --hosts=cursor
node install.mjs --hosts=cursor --no-restart
node install.mjs --uninstall --hosts=cursor
```

> 若曾用旧版本仓库往 Codex++ 写过脚本，`--uninstall` 会顺带清理 `%APPDATA%\Codex++\user_scripts` 中的旧 PromptSpark 残留。日常 Codex 能力请只用 Codex++。

## 与 Codex++ 的分工

| 宿主 | 去哪 |
|:---|:---|
| Cursor | **本仓库**（workbench 注入 + Cursor 扩展本地代理） |
| Codex 桌面 | **[Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)**（内置 PromptSpark，本仓库不安装） |

本仓库不再支持 Devin / Windsurf / Antigravity 等其它宿主。

## License

MIT。详见 `LICENSE`。
