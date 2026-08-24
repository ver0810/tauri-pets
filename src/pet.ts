export const SCALE = 0.6;
export const MOVIE_H = 150;
export const GROUND_MARGIN = 56;
export const ACTIONS = ["crawl", "sit", "walk", "wave", "jump"] as const;

export const ANCHOR: Record<string, [number, number]> = {
  crawl: [85, 148],
  sit: [85, 148],
  wave: [85, 148],
  jump: [85, 148],
  hang: [85, 18],
  climb: [85, 14],
  walk: [85, 148],
};

export const BUBBLES = ["吱吱!", "🍌", "嘿嘿", "挠挠", "冲呀"];

// Preload helper
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type SpriteMap = Record<string, HTMLImageElement[]>;

// 使用构建时生成的 manifest 避免 404 探活，带缓存
import manifest from "./assets-manifest.json";

const spriteCache = new Map<string, { sp: SpriteMap; mode: string }>();

export async function loadSprites(char: "calm" | "funny"): Promise<{ sp: SpriteMap; mode: string }> {
  if (spriteCache.has(char)) return spriteCache.get(char)!;

  // component 优先：利用 manifest 精确加载
  const actions = ["crawl", "sit", "wave", "jump", "hang", "climb", "walk"] as const;
  const sp: SpriteMap = {};
  let found = false;
  for (const act of actions) {
    const key = `${char}_${act}`;
    const files = (manifest as any).component?.[key] as string[] | undefined;
    if (!files?.length) continue;
    const imgs = await Promise.all(files.map((f) => loadImage(`/assets/${f}`).catch(() => null)));
    const valid = imgs.filter(Boolean) as HTMLImageElement[];
    if (valid.length) {
      sp[act] = valid;
      found = true;
    }
  }
  if (found) {
    const res = { sp, mode: "component" };
    spriteCache.set(char, res);
    return res;
  }

  // grouped 兜底：/assets/actions/ + manifest
  const spg: SpriteMap = {};
  let gfound = false;
  for (const act of ACTIONS) {
    const files = (manifest as any).grouped?.[act] as string[] | undefined;
    if (!files?.length) continue;
    const imgs = await Promise.all(files.map((f) => loadImage(`/assets/actions/${f}`).catch(() => null)));
    const valid = imgs.filter(Boolean) as HTMLImageElement[];
    if (valid.length) {
      spg[act] = valid;
      gfound = true;
    }
  }
  if (gfound) {
    const res = { sp: spg, mode: "grouped" };
    spriteCache.set(char, res);
    return res;
  }

  const empty = { sp: {}, mode: "empty" };
  spriteCache.set(char, empty);
  return empty;
}

export type Obstacle = [number, number, number, number]; // left, top, right, bottom

export class Pet {
  el: HTMLDivElement;
  imgEl: HTMLImageElement;
  bubbleEl: HTMLDivElement;
  sp: SpriteMap;
  mode: string;
  action: string = "fall";
  dir: number = 1;
  frame: number = 0;
  vy: number = 0;
  hold: number = 60;
  wall: Obstacle | null = null;
  platform: Obstacle | null = null;
  bubble: [string, number] | null = null;
  x: number;
  y: number;

  constructor(_char: "calm" | "funny", sp: SpriteMap, mode: string, stage: HTMLElement) {
    this.sp = sp;
    this.mode = mode;
    this.x = 100 + Math.random() * 600;
    this.y = 100;
    this.el = document.createElement("div");
    this.el.className = "pet";
    this.imgEl = document.createElement("img");
    this.imgEl.draggable = false;
    this.bubbleEl = document.createElement("div");
    this.bubbleEl.className = "bubble";
    this.bubbleEl.style.display = "none";
    this.el.appendChild(this.imgEl);
    this.el.appendChild(this.bubbleEl);
    stage.appendChild(this.el);

    // events
    this.el.addEventListener("click", (e) => {
      if (e.button === 0) this.bounce();
      e.stopPropagation();
    });
    this.el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      // dispatch custom event for menu
      window.dispatchEvent(new CustomEvent("pet-contextmenu", { detail: { x: e.clientX, y: e.clientY, pet: this } }));
    });
    // also right click via auxclick
    this.el.addEventListener("auxclick", (e) => {
      if (e.button === 2) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pet-contextmenu", { detail: { x: e.clientX, y: e.clientY, pet: this } }));
      }
    });
  }

  choose() {
    if (this.mode === "grouped") {
      const pool: string[] = [];
      const weights: [string, number][] = [
        ["crawl", 4],
        ["walk", 2],
        ["sit", 2],
        ["wave", 1],
        ["jump", 1],
      ];
      for (const [name, w] of weights) {
        if (name in this.sp) for (let i = 0; i < w; i++) pool.push(name);
      }
      const a = pool[Math.floor(Math.random() * pool.length)] || "crawl";
      if (a === "jump") {
        this.action = "jump";
        this.vy = -7.5;
        this.dir = Math.random() < 0.5 ? -1 : 1;
      } else {
        this.action = a;
        if (a === "crawl" || a === "walk") this.dir = Math.random() < 0.5 ? -1 : 1;
        const len = this.sp[a]?.length || 4;
        this.hold = len * 4 * (1 + Math.floor(Math.random() * 2));
      }
      return;
    }
    if (this.mode === "movie") {
      if (Math.random() < 0.7) {
        this.action = "crawl";
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.hold = 120 + Math.floor(Math.random() * 200);
      } else {
        this.action = "jump";
        this.vy = -7.5;
        this.dir = Math.random() < 0.5 ? -1 : 1;
      }
      return;
    }
    const r = Math.random();
    if (r < 0.55) {
      this.action = "crawl";
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.hold = 80 + Math.floor(Math.random() * 180);
    } else if (r < 0.75) {
      this.action = "sit";
      this.hold = 60 + Math.floor(Math.random() * 120);
    } else if (r < 0.9) {
      this.action = "jump";
      this.vy = -7.5;
      this.dir = Math.random() < 0.5 ? -1 : 1;
    } else {
      this.action = "wave";
      this.hold = 40 + Math.floor(Math.random() * 50);
    }
    if (Math.random() < 0.25) this.bubble = [BUBBLES[Math.floor(Math.random() * BUBBLES.length)], 60];
  }

  tick(obstacles: Obstacle[], groundY: number, screenW: number) {
    const a = this.action;
    if (a === "crawl") {
      this.x += this.dir * 2.4;
      this.hold -= 1;
      for (const [left, top, right, bottom] of obstacles) {
        if (this.mode === "movie" || this.mode === "grouped") {
          if (top + 8 < this.y && this.y < bottom) {
            if (this.dir > 0 && left - this.x >= 0 && left - this.x <= 8) {
              this.dir = -1;
              break;
            }
            if (this.dir < 0 && this.x - right >= 0 && this.x - right <= 8) {
              this.dir = 1;
              break;
            }
          }
          continue;
        }
        if (top + 8 < this.y && this.y < bottom) {
          if (this.dir > 0 && left - this.x >= 0 && left - this.x <= 8) {
            this.action = "climb";
            this.wall = [left, top, right, bottom];
            this.x = left;
            break;
          }
          if (this.dir < 0 && this.x - right >= 0 && this.x - right <= 8) {
            this.action = "climb";
            this.wall = [left, top, right, bottom];
            this.x = right;
            break;
          }
        }
      }
      if (this.platform) {
        const [left, , right] = this.platform;
        if (!(left - 2 <= this.x && this.x <= right + 2)) {
          this.platform = null;
          this.action = "fall";
          this.vy = 0;
        }
      }
      if (this.hold <= 0) this.choose();
    } else if (a === "climb") {
      this.y -= 2.2;
      if (!this.wall) {
        this.action = "fall";
        this.vy = 0;
      } else {
        const [, top] = this.wall;
        if (this.y <= top) {
          this.y = top;
          this.platform = this.wall;
          this.action = Math.random() < 0.5 ? "crawl" : Math.random() < 0.5 ? "crawl" : "hang";
          // original random choice ["crawl","crawl","hang"]
          if (Math.random() < 0.33) this.action = "hang";
          else this.action = "crawl";
          this.hold = 50 + Math.floor(Math.random() * 100);
        }
      }
    } else if (a === "hang") {
      this.hold -= 1;
      if (this.hold <= 0) {
        this.action = Math.random() < 0.5 ? "fall" : "crawl";
        this.vy = 0;
        this.platform = this.wall;
      }
    } else if (a === "fall" || a === "jump") {
      const old = this.y;
      this.vy += 0.55;
      this.y += this.vy;
      this.x += this.dir * 1.2;
      if (this.vy > 0) {
        if (old <= groundY && groundY <= this.y) {
          this.y = groundY;
          this.platform = null;
          this.action = "crawl";
          this.hold = 60 + Math.floor(Math.random() * 140);
        }
        for (const rect of obstacles) {
          const [left, top, right] = rect;
          if (left - 4 <= this.x && this.x <= right + 4 && old <= top && top <= this.y) {
            this.y = top;
            this.platform = rect;
            this.action = "crawl";
            this.hold = 60 + Math.floor(Math.random() * 140);
            break;
          }
        }
      }
    } else if (a === "walk") {
      this.x += this.dir * 1.6;
      this.hold -= 1;
      if (this.hold <= 0) this.choose();
    } else {
      // sit / wave
      this.hold -= 1;
      if (this.hold <= 0) this.choose();
    }
    // 动态边距：按当前帧精灵半宽 + 8px，避免窗口小时半身出窗（原 Python 10px 仅适合单窗多实例）
    let marginX = 80;
    try {
      if (this.mode === "component") {
        const frames = (this.sp[this.action] || this.sp["sit"] || Object.values(this.sp)[0]) as HTMLImageElement[] | undefined;
        if (frames?.[0]?.naturalWidth) marginX = Math.round((frames[0].naturalWidth * SCALE) / 2) + 12;
      } else if (this.mode === "grouped" || this.mode === "movie") {
        const key = this.mode === "grouped" ? (this.action in this.sp ? this.action : Object.keys(this.sp)[0]) : "movie";
        const frames = this.sp[key];
        if (frames?.[0]?.naturalWidth) {
          const aw = Math.round((frames[0].naturalWidth * MOVIE_H) / Math.max(frames[0].naturalHeight, 1));
          marginX = Math.round(aw / 2) + 12;
        }
      }
    } catch {}
    marginX = Math.max(48, Math.min(120, marginX));
    this.x = Math.max(marginX, Math.min(screenW - marginX, this.x));
    if (this.bubble) {
      this.bubble[1] -= 1;
      if (this.bubble[1] <= 0) this.bubble = null;
    }
    this.frame += 1;
    this.render();
  }

  bounce() {
    this.action = "jump";
    this.vy = -8.0;
    this.bubble = [BUBBLES[Math.floor(Math.random() * BUBBLES.length)], 50];
  }

  render() {
    // handle grouped/movie vs component
    let img: HTMLImageElement | undefined;
    let ax = 85, ay = 148;

    if (this.mode === "grouped" || this.mode === "movie") {
      let frames: HTMLImageElement[] | undefined;
      if (this.mode === "grouped") {
        const key = this.action in this.sp ? this.action : Object.keys(this.sp)[0];
        frames = this.sp[key];
        const idx = Math.floor(this.frame / 4) % (frames?.length || 1);
        img = frames?.[idx];
      } else {
        frames = this.sp["movie"];
        const idx = Math.floor(this.frame / 3) % (frames?.length || 1);
        img = frames?.[idx];
      }
      if (!img) {
        this.el.style.display = "none";
        return;
      }
      this.el.style.display = "block";
      // fixed MOVIE_H
      const ah = MOVIE_H;
      const aw = Math.round((img.naturalWidth * MOVIE_H) / Math.max(img.naturalHeight, 1));
      // position: x - aw/2, y - ah
      const x = Math.round(this.x - aw / 2);
      const y = Math.round(this.y - ah);
      this.el.style.width = aw + "px";
      this.el.style.height = ah + "px";
      this.el.style.left = x + "px";
      this.el.style.top = y + "px";
      this.imgEl.src = img.src;
      this.imgEl.style.transform = this.dir < 0 ? "scaleX(-1)" : "none";
      // bubble
      if (this.bubble) {
        this.bubbleEl.textContent = this.bubble[0];
        this.bubbleEl.style.display = "block";
      } else this.bubbleEl.style.display = "none";
      return;
    }

    // component
    const act = this.action in ANCHOR ? this.action : "sit";
    let frames = this.sp[act] || this.sp["sit"] || Object.values(this.sp)[0];
    if (!frames || frames.length === 0) {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "block";
    const idx = Math.floor(this.frame / 5) % frames.length;
    img = frames[idx];
    if (!img) return;
    const baseW = img.naturalWidth;
    const baseH = img.naturalHeight;
    const aw = Math.round(baseW * SCALE);
    const ah = Math.round(baseH * SCALE);
    // 动态锚点：256 画布下脚底在底部中心，兼容 170 旧素材的 ANCHOR
    const fallbackAx = Math.round(baseW * 0.5);
    const fallbackAy = Math.round(baseH * 0.92);
    const anchor = ANCHOR[act];
    if (baseW === 256 && baseH === 256) {
      ax = fallbackAx; ay = fallbackAy;
    } else {
      [ax, ay] = anchor || [fallbackAx, fallbackAy];
    }
    if (this.dir < 0) ax = baseW - ax;
    const x = Math.round(this.x - ax * SCALE);
    const y = Math.round(this.y - ay * SCALE);
    this.el.style.width = aw + "px";
    this.el.style.height = ah + "px";
    this.el.style.left = x + "px";
    this.el.style.top = y + "px";
    this.imgEl.src = img.src;
    this.imgEl.style.transform = this.dir < 0 ? "scaleX(-1)" : "none";
    // bubble offset similar to python paintEvent (30,0,90,26)
    if (this.bubble) {
      this.bubbleEl.textContent = this.bubble[0];
      this.bubbleEl.style.display = "block";
      // adjust bubble position relative to pet
      this.bubbleEl.style.top = "-28px";
    } else this.bubbleEl.style.display = "none";
  }

  destroy() {
    this.el.remove();
  }
}
