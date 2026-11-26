<p align="center">
  <img src="./assets/brand/logo-wordmark.png" alt="PromptSpark" height="56">
</p>

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="PromptSpark：Cursor Composer 旁的提示词优化与快捷命令">
</p>

<p align="center">
  <a href="https://github.com/xiaoyangtx996/PromptSpark/stargazers"><img src="https://img.shields.io/github/stars/xiaoyangtx996/PromptSpark?style=flat-square&logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/xiaoyangtx996/PromptSpark/releases"><img src="https://img.shields.io/github/v/release/xiaoyangtx996/PromptSpark?style=flat-square&label=Release" alt="Latest release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4C8DFF.svg?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Cursor-111315.svg?style=flat-square" alt="Windows Cursor">
  <img src="https://img.shields.io/badge/install-VSIX-FFB000.svg?style=flat-square" alt="Install via VSIX">
</p>

**PromptSpark** 面向 Cursor（Windows）：在 Composer 旁加入「闪光」提示词优化/还原，以及可切换的快捷命令（左键发送、右键切换）。

> 仅支持 **Cursor · Windows**。Codex 桌面请用 [Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)。

## 能做什么

| 能力 | 说明 |
|:---|:---|
| **优化 / 还原** | 点闪光 → 用你配置的模型改写提示词；再点还原；进行中再点可取消 |
| **快捷命令** | 左键填入并自动发送；右键切换命令 |
| **风格** | 默认「简洁 / 结构化 / 编程」锁定；可新增自定义风格与 system prompt |
| **模型** | OpenAI 兼容或 Anthropic；扩展内嵌本机代理 `127.0.0.1:37841` |
| **设置** | 右键或 `Alt+点击` 闪光打开；底部「取消 / 存储」；Esc 同取消 |

快捷命令不需要 API Key；只有「优化」需要。配置经本机代理落盘，更新插件不丢。

## 安装

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="拖入 VSIX、完全重启 Cursor、在 Composer 中使用">
</p>

1. 下载 [Releases](https://github.com/xiaoyangtx996/PromptSpark/releases) 中的 `PromptSpark-*.vsix`  
   或本地打包：

```powershell
npm run pack:vsix
```

产物：`dist/PromptSpark-<version>.vsix`  
（本地打包会把仓库版本 **+1**；正式发版以 GitHub 最新 tag **+1** 为准。）

2. 将 `.vsix` **拖进 Cursor**，或：扩展 → `…` → **Install from VSIX…**
3. 若提示已写入 Composer 控件 → **完全退出并重新打开 Cursor**（不要只 Reload Window）
4. 扩展显示名：**PromptSpark**（publisher: `xiaoyangtx996`）

写入失败时：以管理员运行 Cursor，命令面板执行 `PromptSpark: 注入 Composer 控件`。

## 第一次使用

1. Composer 写草稿 → 点闪光优化 / 再点还原  
2. 左侧「继续」→ **左键发送**，**右键切换命令**  
3. 右键闪光打开设置 → 填 API（优化用）与命令内容 → **存储**

| Tab | 内容 |
|:---|:---|
| 提示词优化 | 默认风格（锁定）与自定义风格、system prompt |
| 快捷命令 | 标题（按钮文案）、内容（发送文本） |
| 模型配置 | 协议、Base URL、API Key、Model（可刷新拉取列表） |

默认风格不可删除，其 system prompt 不可改；说明在 System prompt 旁「？」悬停可见。未改动时点取消不会弹出确认。

## 仓库结构

```text
src/                 Composer UI 源码（闪光 / 继续 / 设置面板）
cursor-extension/    Cursor 扩展入口、本机代理、扩展图标
runtime/             命令行安装器用的独立代理
scripts/             打包 / 发版 / 品牌图处理 / 校验
assets/brand/        Logo（字标、图标、源图；透明底）
assets/readme/       README 插图
dist/                本地构建产物（gitignore；含 .vsix）
```

```powershell
npm run build       # UI 脚本 → dist/prompt-optimize.js
npm run pack:vsix   # 仓库版本 +1，产出 VSIX
npm run verify      # 构建 + 结构校验
npm run release     # 打包并创建/更新 GitHub Release
```

品牌图透明底：

```powershell
python scripts/matte-brand.py
# 或从源图重切：python scripts/split-logo.py
```

### 可选：命令行安装器

需要 Node 与管理员权限；会关闭 Cursor、注入 workbench 并安装扩展：

```powershell
node install.mjs --hosts=cursor
node install.mjs --uninstall --hosts=cursor
```

## 与 Codex++

| 宿主 | 仓库 |
|:---|:---|
| Cursor | **本仓库** |
| Codex 桌面 | **[Codex++](https://github.com/xiaoyangtx996/CodexPlusPlus)** |

## License

MIT
