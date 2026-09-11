<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="PromptSpark：Cursor Composer 旁的提示词优化与快捷命令">
</p>

<p align="center">
  <a href="https://github.com/xiaoyangtx996/PromptSpark/stargazers"><img src="https://img.shields.io/github/stars/xiaoyangtx996/PromptSpark?style=flat-square&logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/xiaoyangtx996/PromptSpark/issues"><img src="https://img.shields.io/github/issues/xiaoyangtx996/PromptSpark?style=flat-square&label=Issues" alt="GitHub issues"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4C8DFF.svg?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Cursor-111315.svg?style=flat-square" alt="Windows Cursor">
</p>

**PromptSpark** 给 Cursor Composer 加上两个就地控件：闪光按钮优化/还原提示词，左侧文字按钮一键发送可配置快捷命令。

> **仅支持 Cursor（Windows）。** Codex 桌面请用 [Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)（已内置同类能力）。

## 界面预览

<p align="center">
  <img src="./image/ui-preview.png" alt="PromptSpark 设置面板：提示词优化、快捷命令、模型配置" width="420">
</p>

<p align="center"><sub>三 Tab 设置：风格与 system prompt · 快捷命令 · 模型接口。页脚可打开本仓库 GitHub。</sub></p>

## 能做什么

| 能力 | 怎么用 |
|:---|:---|
| **优化 / 还原** | 点闪光 → LLM 改写；再点 → 恢复原文；进行中再点 → 取消 |
| **快捷命令** | 左键填入并发送当前命令；右键弹出菜单切换命令 |
| **风格** | 内置简洁 / 结构化 / 编程，可自定义 system prompt |
| **接口** | OpenAI 兼容或 Anthropic；经本机 `127.0.0.1:37841` 代理 |
| **设置** | 右键或 `Alt+点击` 闪光按钮 |

快捷命令不依赖 API；仅「优化」需要配置密钥。

## 怎么用

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="安装、配置、在 Composer 中使用 PromptSpark">
</p>

### 前置

- Windows · [Node.js LTS](https://nodejs.org/) · Cursor  
- OpenAI 兼容或 Anthropic API（仅优化需要）

### 一键安装

```powershell
irm https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

国内镜像：

```powershell
irm https://wget.la/https://raw.githubusercontent.com/xiaoyangtx996/PromptSpark/main/scripts/install.ps1 | iex
```

安装器会请求 UAC、短暂关闭 Cursor、注入脚本并更新 checksum，然后重启。升级：再跑同一条命令即可。

安装后：

1. 在 Composer 写草稿 → 点闪光优化 / 再点还原  
2. 左侧命令按钮 → **左键发送**，**右键切换**  
3. 右键闪光 → 设置里填 API（优化用）与命令内容  

### 首次配置

| Tab | 内容 |
|:---|:---|
| 提示词优化 | 风格与 system prompt |
| 快捷命令 | 标题（按钮文案）、内容（发送文本）；下拉新增/删除 |
| 模型配置 | 协议、Base URL、API Key、Model |

点 **存储** 生效。配置在 Cursor 本地存储；请求走本机代理。

### 手动安装 / 卸载

```powershell
node install.mjs --hosts=cursor
node install.mjs --hosts=cursor --no-restart
node install.mjs --uninstall --hosts=cursor
```

若曾往 Codex++ 写过旧脚本，`--uninstall` 会顺带清理 `%APPDATA%\Codex++\user_scripts` 残留。

## 与 Codex++ 的分工

| 宿主 | 去哪 |
|:---|:---|
| Cursor | **本仓库** |
| Codex 桌面 | **[Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)** |

本仓库不再支持其它 IDE 宿主。

## License

MIT。详见 [`LICENSE`](./LICENSE)。
