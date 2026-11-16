<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="PromptSpark：Cursor Composer 旁的提示词优化与快捷命令">
</p>

<p align="center">
  <a href="https://github.com/xiaoyangtx996/PromptSpark/stargazers"><img src="https://img.shields.io/github/stars/xiaoyangtx996/PromptSpark?style=flat-square&logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/xiaoyangtx996/PromptSpark/issues"><img src="https://img.shields.io/github/issues/xiaoyangtx996/PromptSpark?style=flat-square&label=Issues" alt="GitHub issues"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4C8DFF.svg?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Cursor-111315.svg?style=flat-square" alt="Windows Cursor">
  <img src="https://img.shields.io/badge/install-VSIX-FFB000.svg?style=flat-square" alt="Install via VSIX">
</p>

**PromptSpark** 是 Cursor（Windows）扩展：在 Composer 输入栏旁加入「闪光」优化/还原提示词，以及可配置的「继续」快捷命令（左键发送、右键切换）。

> 仅支持 **Cursor · Windows**。Codex 桌面请用 [Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)。

## 界面

<p align="center">
  <img src="./assets/readme/ui-preview.png" alt="PromptSpark 设置：提示词优化、快捷命令、模型配置" width="480">
</p>

<p align="center"><sub>三 Tab：风格与 system prompt · 快捷命令 · 模型接口</sub></p>

## 能做什么

| 能力 | 操作 |
|:---|:---|
| **优化 / 还原** | 点闪光 → LLM 改写；再点还原；进行中再点取消 |
| **快捷命令** | 左键填入并发送；右键切换命令 |
| **风格** | 简洁 / 结构化 / 编程，可自定义 system prompt |
| **模型** | OpenAI 兼容或 Anthropic；扩展内启动本机代理 `127.0.0.1:37841` |
| **设置** | 右键或 `Alt+点击` 闪光 |

快捷命令不需要 API；只有「优化」需要密钥。

## 怎么用

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="拖入 VSIX、完全重启 Cursor、在 Composer 中使用">
</p>

### 安装（拖 VSIX）

1. 下载 [Release](https://github.com/xiaoyangtx996/PromptSpark/releases) 里的 `PromptSpark-*.vsix`，或本地打包：

```powershell
npm run pack:vsix
```

产物：`dist/PromptSpark-<version>.vsix`

2. 把 `.vsix` **拖进 Cursor**，或：Extensions → `…` → **Install from VSIX…**
3. 若提示已写入 Composer 控件 → **完全退出并重新打开 Cursor**（不要只 Reload Window）
4. 扩展显示名为 **PromptSpark**

写入失败时：以管理员运行 Cursor，命令面板执行 `PromptSpark: 注入 Composer 控件`。

### 第一次

1. Composer 写草稿 → 点闪光优化 / 再点还原  
2. 左侧「继续」→ **左键发送**，**右键切换命令**  
3. 右键闪光 → 填 API（优化用）与快捷命令内容 → **存储**

| Tab | 内容 |
|:---|:---|
| 提示词优化 | 风格与 system prompt |
| 快捷命令 | 标题（按钮文案）、内容（发送文本） |
| 模型配置 | 协议、Base URL、API Key、Model（可点刷新拉模型列表） |

### 可选：命令行安装器

需要 Node 与管理员权限；会关闭 Cursor、注入 workbench 并安装扩展：

```powershell
node install.mjs --hosts=cursor
node install.mjs --uninstall --hosts=cursor
```

## 仓库结构

```text
src/                  Composer UI 脚本源码（闪光 / 继续 / 设置）
cursor-extension/     Cursor 扩展入口、本机代理、扩展图标
runtime/              命令行安装器用的独立代理进程
scripts/              build 校验、pack:vsix、图标渲染、安装脚本
assets/readme/        README 插图
assets/brand/         品牌 Logo（SVG/PNG）
dist/                 本地构建产物（已 gitignore；含 .vsix）
```

```powershell
npm run build       # 打 UI 脚本 → dist/prompt-optimize.js
npm run pack:vsix   # 产出可拖装的 dist/PromptSpark-<version>.vsix
npm run verify      # 构建 + 结构校验
```

## 与 Codex++ 

| 宿主 | 去哪 |
|:---|:---|
| Cursor | **本仓库** |
| Codex 桌面 | **[Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)** |

## License

MIT · [`LICENSE`](./LICENSE)
