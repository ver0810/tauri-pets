@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo === MonkeyPet (Tauri) 启动器 ===

:: 优先直接运行已打包的 exe
if exist src-tauri\target\release\bundle\nsis\MonkeyPet_*.exe (
  for %%f in (src-tauri\target\release\bundle\nsis\MonkeyPet_*.exe) do (echo 找到已打包: %%f & start "" "%%f" & exit /b 0)
)
if exist src-tauri\target\release\bundle\msi\MonkeyPet_*.msi (
  echo 请先安装 msi 再运行
  pause & exit /b 0
)
if exist src-tauri\target\release\pets-tauri.exe (
  start "" src-tauri\target\release\pets-tauri.exe & exit /b 0
)

:: 未打包则尝试开发运行
where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请安装 Node 18+ https://nodejs.org/
  pause & exit /b 1
)
where cargo >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Rust，请安装 https://rustup.rs/
  pause & exit /b 1
)

echo [1/2] 安装前端依赖...
where pnpm >nul 2>&1
if errorlevel 1 npm install -g pnpm
pnpm install --silent

echo [2/2] 启动开发窗口 (首次编译需 1-2 分钟)...
pnpm tauri dev
if errorlevel 1 (
  echo 启动失败，尝试构建: pnpm tauri build
  pause
)
