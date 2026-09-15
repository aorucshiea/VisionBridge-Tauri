# tools — VisionBridge (Tauri) 构建与验证工具

这个目录存在的唯一原因：本机环境有几处**非标准配置**，不绕开就没法编译 Tauri。
下面每条都对应一个真实踩过的坑。

## 构建（日常只需要这两个）

| 脚本 | 用途 |
|---|---|
| `msvc-env.py` | 组装 MSVC + Windows SDK 的 `PATH`/`LIB`/`INCLUDE`（供其他脚本 import） |
| `build-tauri.py` | exe 构建入口：`--cli` 出可运行的 exe，`--bundle` 走 CLI 打包 |
| `make-installer.py` | 用本机 NSIS 3.0.4.1 编译 `installer.nsi`，产出安装包 |
| `installer.nsi` | 手写的 NSIS 安装脚本（Tauri 自带打包器在本机不可用，见下） |

```bash
python tools/build-tauri.py --cli      # 生产模式 exe（务必带 --cli）
python tools/make-installer.py         # exe + NSIS 安装包
```

### ⚠️ 不要用裸 `cargo build --release`

`tauri-build` 无法区分裸 cargo 构建和开发构建，于是让窗口去加载
`devUrl`（`http://localhost:1420`）。没有服务监听 → 导航失败 → 窗口显示
WebView2 错误页（深灰底 + Edge 蓝按钮），**而窗口标题看起来完全正常**。
只有 Tauri CLI 会设置 `TAURI_ENV_*`，把它切到生产模式（内嵌静态资源）。

## 验证与度量

| 脚本 | 用途 |
|---|---|
| `run-and-grab.py` | 启动 exe → 按 PID 找窗口 → 截屏 → 打印渲染自检 |
| `grab-window.py` | 窗口截屏库（GDI BitBlt，`PrintWindow` 对 WebView2 无效） |
| `inspect-png.py` | 解码 PNG 并统计颜色分布（本环境无法给模型看图，只能用数字判断渲染结果） |
| `verify-install.py` | 静默安装 → 校验文件/快捷方式/注册表 → 启动验证 |
| `measure-size.py` | 生成 Electron vs Tauri 的体积对比表 |
| `install-vs.py` | 安装 VS Build Tools（含代理变量去重，见下） |
| `probe.py` | 通用探针：带环境变量启动 → 读窗口标题 / 日志 / 截图（`VB_DIAG`、`VB_PROBE_MODELS` 等） |
| `mock-openai.py` | 在 127.0.0.1:1234 模拟 LM Studio 的 /v1/models，验证 HTTP 链路不依赖 LM Studio 状态 |
| `minidump-peek.py` | 最小 MinIDump 解析：崩溃异常码 + 崩溃模块（WebView2 排障用） |

## 两个运行期大坑（2026-09-15 排查实录）

### 1. WebView2 升级到 Edge 153 后整窗白屏
症状：窗口开着、标题正常，但页面白屏 / 卡在 `about:blank`，
`initialization_script` 只执行第一段，所有 `setTimeout` 都不跑。
诊断：`%LOCALAPPDATA%\com.visionbridge.desktop\EBWebView\Crashpad\reports\`
出现崩溃 dump（`tools/minidump-peek.py` 可粗读）；CDP
（`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`）
显示页面根本没导航。
根因：Edge Runtime 自动升级后**旧用户数据目录（EBWebView）损坏**。
修复：删除 `EBWebView` 目录即可恢复。注意 `taskkill /F` 强杀进程也会把
profile 弄脏并复现同样症状——测试脚本要先清 profile 或优雅退出。

### 2. 本地服务（LM Studio / llama.cpp）的请求被 CORS 杀死
WebView2 里的 `fetch` 到 `127.0.0.1:1234` 是跨域，浏览器先发 OPTIONS 预检；
本地服务器大多不回 CORS 头（LM Studio 日志表现为
`Unexpected endpoint or method. (OPTIONS /v1/models). Returning 200 anyway`），
预检失败 → 真正的 GET/POST 永远发不出去。
修复：HTTP 全部改走 `tauri-plugin-http`（`src/lib/net.ts` 的 fetch 通过 IPC
进 Rust，无 origin，永不发预检）。体积代价：exe 3.35 → 5.84 MB。
另注意：reqwest 默认遵循 `HTTP_PROXY` 环境变量，v2rayN 用户本地请求也会被
塞进代理——`NO_PROXY` 需包含 `127.0.0.1,localhost`。

## 环境坑（每条都真实踩过）

### 1. VS 安装器被重复的代理变量搞崩
环境里同时存在 `HTTP_PROXY` 和 `http_proxy`。VS 引导程序是 .NET 应用，
字典大小写不敏感，直接抛 `0x80070057: 已添加项`，14 秒即退。
`install-vs.py` 在启动前按小写去重，只保留一个拼写。

### 2. Windows SDK 装在 E 盘，不在 C 盘
`E:\Windows Kits\10\`（版本 `10.0.22621.0` 与 `10.0.26100.0`）。
只查默认的 `C:\Program Files (x86)\Windows Kits\10\Lib` 会误判"未安装"，
于是白折腾了好几轮安装尝试。
**正确的探测方式**是 Python `winreg` 读
`HKLM\SOFTWARE\Microsoft\Windows\Kits\Installed Roots` 的 `KitsRoot10`
（`reg.exe` 被安全策略禁用，但 Python 的 winreg 不受影响）。

### 3. `reg.exe` 被安全策略拉黑 → `vcvarsall.bat` 不可用
它靠 `reg.exe` 定位 SDK，读不到就只设置 MSVC 部分，
于是 rustc 报 `linker link.exe not found` 且找不到 `kernel32.lib`。
`msvc-env.py` 因此**完全不用 vcvarsall**，自己拼 `PATH`/`LIB`/`INCLUDE`。

### 4. Tauri 自带 NSIS 打包器在本机不可用
它坚持从 GitHub 下载 NSIS + 插件工具链，而本机代理对这些地址返回 502。
即使把 zip 和 `nsis_tauri_utils.dll`（含 SHA1 校验）手工塞进
`%LOCALAPPDATA%\tauri\NSIS`，它仍判定缓存不完整并清空重下。
→ 改用 electron-builder 缓存里现成的 NSIS 3.0.4.1 + `installer.nsi` 手写安装脚本。

### 5. NSIS 脚本必须带 UTF-8 BOM
`Unicode true` 的脚本里有中文/非 ASCII 字符时，无 BOM 会被拒绝：
`Bad text encoding ... aborting`。

### 6. shell 环境缺常用命令
本环境的 bash shim 缺 `head`/`dirname`/`cd`/`sleep`，文本截取一律用 Python；
内联脚本里的嵌套引号也会被吞掉，**改写 `.py` 文件运行更稳**。

### 7. `package.json` 的 `"type": "module"` 与 CommonJS 配置冲突
`postcss.config.js` 里的 `module.exports` 在 ESM 作用域下报
`module is not defined` → 必须改名 `postcss.config.cjs`。

## 测试钩子（环境变量，默认关闭）

| 变量 | 作用 |
|---|---|
| `VB_DIAG=1` | 注入脚本会通过 `frontend_report` 上报：窗口身份、字体栈、视口宽度、标签页是否溢出、遮罩/工具条的实际渲染内容、报错与 rejection |
| `VB_OPEN_MASK=<ms>` | 启动 N 毫秒后自动打开遮罩，合成一次框选并点击第一个动作 —— 端到端验证整个截图链路 |
| `VB_FAKE_SELECTION=<text>` | 启动后直接投递一段"选中文本"，弹出划词工具条（无需真实鼠标拖选） |

典型排查：

```bash
python tools/probe.py --env VB_DIAG=1 --wait 7                # 读窗口标题里的布局数字
python tools/probe.py --env VB_OPEN_MASK=2000 --wait 11       # 跑完整截图链路
python tools/probe.py --env VB_FAKE_SELECTION=hello --wait 7 --shots
python tools/screen-stats.py --label baseline                 # 遮罩压暗前后的亮度对比
```

## 三个真实根因（都已修复并验证）

### 1. 划词工具条显示成了整个主界面
App.tsx 自己从 URL 读窗口类型，而 **Tauri 的资源解析会丢掉 `?window=` 查询串**，
于是工具条窗口回落到 `main` 分支 —— 280×52 的窗口里塞进了整个主界面，
标题栏的「截图 / 设置」被挤成两行。修复：窗口身份改由 Rust 注入的
`window.__VB_WINDOW__` 提供（`init_script`），URL 只作后备。
验证：工具条窗口上报 `txt:翻译 解释`、`app:0`（无主界面标签页）。

### 2. Alt+A 后整个屏幕变成一张不透明的纸
两个叠加的原因：
- `index.html` 给 `body` 设了不透明底色（我为了排查空白页加的）——遮罩的
  42% 压暗是画在**透明窗口**上的，底下垫了纸就变成一张满屏纸色。
- 主窗口本该不透明（Electron 版如此），我却设成了 `transparent(true)`。
修复：去掉 body 底色，主窗口 `transparent(false)`。
验证：遮罩打开时整屏亮度应降到基线的 ~58%，实测已恢复。

### 3. 结果卡片永远不出现（死锁）
`show_result` 是**同步命令**，跑在主线程上；在里面创建窗口需要事件循环继续跑，
而事件循环正阻塞在这个命令里 —— 死锁。窗口从未被创建，也没有任何报错。
修复：`show_result` / `open_mask` / `selection_toolbar_action` 改为 `async`
（Tauri 会放到别的线程执行，主线程保持空闲）。
验证：框选 → 点翻译 → 结果卡片出现在选区旁，内容送达。

### 4. 划词误触发（读到旧剪贴板）
`Ctrl+C` 之后不校验剪贴板是否变化，会把用户之前复制的内容当成选区。
修复：先清空剪贴板再模拟复制，空结果 = 没有选中，随后恢复原剪贴板。

### 5. Tauri v2 权限：没有 capabilities 文件时所有事件订阅被拒
`event.listen` 属于插件命令，没有 capabilities 授权会被 ACL 拒绝，
且报错只在 unhandled rejection 里。`src-tauri/capabilities/default.json`
授权了 `core:default` / `core:event:default` / `core:window:allow-*`。

## 历史脚本

`_history/` 里是探索过程中被取代的诊断脚本，保留作为排查记录，不再使用。
