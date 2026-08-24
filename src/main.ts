import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { Pet, loadSprites, GROUND_MARGIN } from "./pet";

const stage = document.getElementById("stage") as HTMLDivElement;
const menu = document.getElementById("menu") as HTMLDivElement;
const menuAdd = document.getElementById("menu-add") as HTMLButtonElement;
const menuQuit = document.getElementById("menu-quit") as HTMLButtonElement;

let pets: Pet[] = [];
let obstacles: [number, number, number, number][] = [];
let groundY = 0;
let screenW = window.innerWidth;
let marginExtra = 0;

let canIgnore = false;
try {
  canIgnore = !!((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
} catch {}

function computeGroundY(): number {
  // Tauri 全屏 overlay 覆盖整个屏幕（含 Dock 区域），需扣除 Dock/任务栏高度
  // Python 版用 availableGeometry.bottom - GROUND_MARGIN，这里用 screen.avail* 模拟
  const screenH = window.screen.height;
  const availH = window.screen.availHeight;
  const availTop = (window.screen as any).availTop ?? 0;
  let dockH = screenH - availH - availTop;
  if (dockH < 0 || dockH > 200) dockH = 0; // 异常值保护
  // 全屏时 innerHeight == screenH，需扣除 dock；普通浏览器窗口则直接用 innerHeight
  const isFullscreenOverlay = Math.abs(window.innerHeight - screenH) < 5;
  if (isFullscreenOverlay && dockH > 0) {
    return window.innerHeight - dockH - GROUND_MARGIN - marginExtra;
  }
  return window.innerHeight - GROUND_MARGIN - marginExtra;
}
groundY = computeGroundY();

// parse URL params ?pets=4&char=random&margin=0
function parseArgs() {
  const sp = new URLSearchParams(location.search);
  return {
    pets: parseInt(sp.get("pets") || "4", 10),
    char: (sp.get("char") as "calm" | "funny" | "random" | null) || "random",
    margin: parseInt(sp.get("margin") || "0", 10),
  };
}

function updateMetrics() {
  groundY = computeGroundY();
  // 宽度必须用窗口内宽（stage 宽度），用 screen.availWidth 会导致 800 窗口里坐标 10 跑到屏幕外
  screenW = window.innerWidth;
}

window.addEventListener("resize", updateMetrics);

async function spawn(char?: "calm" | "funny") {
  const c = char || (Math.random() < 0.5 ? "calm" : "funny");
  const { sp, mode } = await loadSprites(c);
  const pet = new Pet(c, sp, mode, stage);
  // random initial frame to desync，保持 fall 让 tick 自行下落到 groundY
  pet.frame = Math.floor(Math.random() * 100);
  pets.push(pet);
}

// menu logic with viewport clamping
function showMenu(x: number, y: number) {
  menu.classList.remove("hidden");
  // 先显示再测尺寸，避免 hidden 时为 0
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    let nx = x;
    let ny = y;
    if (nx + rect.width + pad > window.innerWidth) nx = window.innerWidth - rect.width - pad;
    if (ny + rect.height + pad > window.innerHeight) ny = window.innerHeight - rect.height - pad;
    if (nx < pad) nx = pad;
    if (ny < pad) ny = pad;
    menu.style.left = nx + "px";
    menu.style.top = ny + "px";
  });
}
window.addEventListener("pet-contextmenu", (e: any) => {
  const { x, y } = e.detail;
  showMenu(x, y);
});

window.addEventListener("click", (e) => {
  if (!menu.contains(e.target as Node)) menu.classList.add("hidden");
});
menuAdd.addEventListener("click", () => {
  spawn();
  menu.classList.add("hidden");
});
menuQuit.addEventListener("click", async () => {
  try {
    await getCurrentWindow().close();
  } catch {
    // fallback for browser preview
    window.close();
  }
});

// Right click on stage also shows menu to add
stage.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  showMenu(e.clientX, e.clientY);
});

// Stage left click hides menu
stage.addEventListener("click", () => menu.classList.add("hidden"));

// 透明区点击穿透：悬停在宠物/菜单上才拦截，否则让点击落到桌面（Tauri）
// 需 tauri.conf: macOSPrivateApi=true + transparent:true（已在 Tauri 侧用底边条窗口规避全屏遮挡）
if (canIgnore) {
  const win: any = getCurrentWindow() as any;
  // 默认穿透，且 forward:true 保证忽略时仍能收到 mousemove 以便切回
  // @ts-ignore - forward 需 macOSPrivateApi，类型在旧定义中缺失
  win.setIgnoreCursorEvents(true, { forward: true }).catch(() => {});
  let lastIgnore = true;
  const updateIgnore = async (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const overInteractive = !!(el && (el.closest(".pet") || el.closest("#menu")));
    const shouldIgnore = !overInteractive;
    if (shouldIgnore !== lastIgnore) {
      lastIgnore = shouldIgnore;
      try {
        if (shouldIgnore) await (win as any).setIgnoreCursorEvents(true, { forward: true });
        else await win.setIgnoreCursorEvents(false);
      } catch {}
    }
  };
  stage.addEventListener("mousemove", updateIgnore);
  stage.addEventListener("mouseleave", async () => {
    if (!lastIgnore) {
      lastIgnore = true;
      // @ts-ignore
      try { await (win as any).setIgnoreCursorEvents(true, { forward: true }); } catch {}
    }
  });
  // 宠物自身进出也强制切换（更灵敏）
  stage.addEventListener("mouseover", updateIgnore);
}

// Rust obstacle fetching
async function fetchObstacles(): Promise<[number, number, number, number][]> {
  try {
    // Tauri command get_obstacles returns Vec<[i32;4]>
    const rects = await invoke<[number, number, number, number][]>("get_obstacles", {
      screenW,
      groundY,
    });
    return rects || [];
  } catch {
    return [];
  }
}

async function main() {
  const args = parseArgs();
  marginExtra = args.margin;
  updateMetrics();

  // Tauri 底边条窗口：仅覆盖底部 260px，其余桌面天然可点，避免全屏遮挡
  if (canIgnore) {
    try {
      const monitor = await currentMonitor();
      if (monitor) {
        const stripH = 260;
        // monitor.size 是 PhysicalSize，需转逻辑或直接用物理
        const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
        const width = monitor.size.width;
        const height = stripH * monitor.scaleFactor;
        // Y 需扣除 Dock 高度，monitor.workArea 可更准，但用 size - stripH 近似
        const x = monitor.position.x;
        const y = monitor.position.y + monitor.size.height - height;
        const win: any = getCurrentWindow() as any;
        // @ts-ignore - PhysicalSize/Position 类型与 Logical 混用，Tauri 会自动处理
        await win.setSize(new PhysicalSize(width, height));
        await win.setPosition(new PhysicalPosition(x, y));
        updateMetrics();
      }
    } catch {}
  }

  for (let i = 0; i < args.pets; i++) {
    const ch = args.char === "random" ? undefined : (args.char as "calm" | "funny");
    await spawn(ch);
  }

  let frame = 0;
  let rafId = 0;
  let last = performance.now();
  async function loop(now: number) {
    rafId = requestAnimationFrame(loop);
    if (document.hidden) return;
    const delta = now - last;
    if (delta < 28) return; // ~33ms -> 30fps，限帧避免 60fps 过快
    last = now;
    frame++;
    if (frame % 15 === 0) {
      try {
        obstacles = await fetchObstacles();
      } catch {}
    }
    for (const pet of pets) pet.tick(obstacles, groundY, screenW);
  }
  rafId = requestAnimationFrame(loop);
  // 暴露以便调试暂停
  (window as any).__loopRaf = rafId;

  // expose spawn for debugging / menu
  (window as any).spawn = spawn;
  (window as any).pets = pets;
}

main();

// HMR friendly: keep window transparent
document.addEventListener("DOMContentLoaded", () => {
  // ensure body transparent
  document.body.style.background = "transparent";
});
