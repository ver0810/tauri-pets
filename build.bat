@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo === MonkeyPet Tauri 打包 (Windows) ===

where node >nul 2>&1 || (echo 未找到 Node.js & pause & exit /b 1)
where cargo >nul 2>&1 || (echo 未找到 Rust https://rustup.rs/ & pause & exit /b 1)

if not exist public\assets\*.png (
  echo [错误] 未找到 public\assets，请先从 Mac 拷来 pets/assets ^(已在 public/assets^)
  pause & exit /b 1
)

echo [1/3] pnpm install
where pnpm >nul 2>&1 || npm install -g pnpm
pnpm install

echo [2/3] 生成前端
pnpm build

echo [3/3] Tauri 打包 (生成 exe/msi，需 2-5 分钟)
pnpm tauri build
if errorlevel 1 (echo 打包失败 & pause & exit /b 1)

echo.
echo === 完成 ===
echo exe: src-tauri\target\release\bundle\nsis\*.exe
echo msi: src-tauri\target\release\bundle\msi\*.msi
echo 直接将 exe 发给朋友即可，无需 Python/Node
pause
