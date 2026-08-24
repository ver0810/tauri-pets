# MonkeyPet Tauri

Node + Tauri 重构的桌面宠物（迁移自 `../pets` Python 版），解决跨平台分发问题。

## 技术栈

- 前端：Vite + TypeScript + CSS（`src/pet.ts` 移植 `desktop_pet.py` 的 `tick()`/`choose()`/`render()`）
- 后端：Tauri 2 + Rust（透明置顶窗口 + 窗口障碍 `get_obstacles`，待实现 Win32/Quartz）
- 素材：复用 `../pets/assets`（`public/assets` 66 帧组件模式）

## 快速运行

```bash
cd pets-tauri
pnpm install

# 开发（热重载，透明 overlay 覆盖全屏）
pnpm tauri dev

# 仅前端预览（浏览器，无法调 Rust）
pnpm dev
# 打开 http://localhost:1420

# 打包
pnpm tauri build
# 产物：
#   Mac: src-tauri/target/release/bundle/macos/MonkeyPet.app (11M)
#        src-tauri/target/release/bundle/dmg/MonkeyPet_0.1.0_aarch64.dmg (4.1M)
#   Win: 需在 Windows 上同样执行 pnpm tauri build → .exe / .msi
```

### 仅 Windows 朋友运行

把 `dmg` 或 `app` 发 Mac 朋友，`exe/msi` 需在 Windows 上构建后分发。推荐 GitHub Actions 自动产出双平台包（见 `.github/workflows/build.yml`）。

## 参数

通过 URL 传参（`tauri dev` 时改 `src/main.ts:parseArgs` 或直接改代码）：

```
?pets=4&char=random&margin=0
# pets 数量, char calm/funny/random, margin 额外抬高像素（叠加 GROUND_MARGIN 22）
```

打包后可通过 `tauri.conf` 的 `args` 或前端 `localStorage` 扩展。

## 操作

- 左键点猴：跳开 + 气泡
- 右键点猴/空白：菜单 → 再加一只 / 退出
- 底部抬高：`src/pet.ts:GROUD_MARGIN=22` + URL `margin`，避免被 Dock/任务栏遮挡

## 窗口障碍

`src-tauri/src/lib.rs:get_obstacles` 当前返回空（纯地面爬行），已预埋 Win/Mac 分支：
- Windows：`windows::Win32::UI::WindowsAndMessaging::EnumWindows`
- macOS：`core-graphics::window::CGWindowListCopyWindowInfo`（需屏幕录制权限）

实现后前端每 15 帧 `invoke("get_obstacles")` 更新。

## 目录

```
pets-tauri/
├── public/assets/      # 从 ../pets/assets 拷贝（3.2M）
├── src/
│   ├── pet.ts          # Pet 类 + loadSprites
│   ├── main.ts         # 启动 + 33ms tick 循环
│   └── styles.css      # 透明舞台 + 气泡
├── src-tauri/
│   ├── tauri.conf.json # transparent + alwaysOnTop + fullscreen
│   └── src/lib.rs      # greet + get_obstacles
└── dist/               # vite 产物（供 tauri 打包）
```
