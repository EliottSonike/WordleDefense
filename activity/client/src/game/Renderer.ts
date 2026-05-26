import { TypesCases } from "./types";
import { getCouleur, Element } from "./Element";
import { RareteLettre } from "./RareteLettre";
import type { GameState } from "./GameSession";
import { Phase } from "./GameSession";

const HUD_H    = 50;
const CANVAS_W = 700;
const CANVAS_H = CANVAS_W + HUD_H;

// ── Zombie sprite ─────────────────────────────────────────────────────────────
// Image: 1000×558 — 3 rows of ~186px each (IDLE / WALKING / FALLING)
// WALKING row starts at y≈186. 6 frames across ~950px = ~158px each.
const WALK_COORDS: [number, number, number, number][] = [
  [36,  190, 153, 148],
  [193, 190, 153, 148],
  [350, 190, 153, 148],
  [507, 190, 153, 148],
  [664, 190, 153, 148],
  [820, 190, 153, 148],
];

let zombieFrames: HTMLCanvasElement[] = [];

// Tracks last x position per monster to determine facing direction
const monsterPrevX = new WeakMap<object, number>();

function loadZombieSprite(): void {
  const img = new Image();
  img.onload = () => {
    zombieFrames = WALK_COORDS.map(([sx, sy, sw, sh]) => {
      const c = document.createElement("canvas");
      c.width = sw; c.height = sh;
      const cx = c.getContext("2d")!;
      cx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const id   = cx.getImageData(0, 0, sw, sh);
      const data = id.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness > 220) {
          data[i+3] = 0;
        } else if (brightness > 180) {
          data[i+3] = Math.round(255 * (1 - (brightness - 180) / 40));
        }
      }
      cx.putImageData(id, 0, 0);
      return c;
    });
  };
  img.src = "/sprites/zombie.jpg";
}

loadZombieSprite();

interface Transform {
  px: (x: number) => number;
  py: (y: number) => number;
  tw: number;
  th: number;
}

function makeTransform(rows: number, cols: number, tileSize: number, mapW: number): Transform {
  const mapStdW = cols * tileSize;
  const mapStdH = rows * tileSize;
  const minX    = 350 - (cols / 2) * tileSize;
  const maxY    = 350 + (rows / 2) * tileSize;
  const scale   = Math.min(mapW / mapStdW, mapW / mapStdH);
  return {
    px: (x) => (x - minX) * scale,
    py: (y) => HUD_H + (maxY - y) * scale,
    tw: tileSize * scale,
    th: tileSize * scale,
  };
}

const TILE_COLOR: Record<number, string> = {
  [TypesCases.Spawn]:            "#6b3000",
  [TypesCases.Base]:             "#5a0e0e",
  [TypesCases.Route]:            "#3d2910",
  [TypesCases.Constructible]:    "#0b2e16",
  [TypesCases.NonConstructible]: "#0a0a12",
};

const TILE_BORDER: Record<number, string> = {
  [TypesCases.Spawn]:            "#aa5020",
  [TypesCases.Base]:             "#bb2222",
  [TypesCases.Route]:            "#6a4520",
  [TypesCases.Constructible]:    "#145a28",
  [TypesCases.NonConstructible]: "#131318",
};

function projSymbol(elem: Element, isRare: boolean): string {
  if (isRare) return "✦";
  switch (elem) {
    case Element.FEU:   return "!";
    case Element.EAU:   return "~";
    case Element.TERRE: return "#";
    case Element.VENT:  return "-";
    default:            return ".";
  }
}

// Rounded rectangle path helper (manual fallback for older canvas)
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y,       x + w, y + rad,     rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h,   x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x,   y + h,     x,   y + h - rad,   rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x,   y,         x + rad, y,          rad);
  ctx.closePath();
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { map, monstres, tours, player, waveIndex, waveCount, bm, phase, projectiles, levelIndex } = state;

  const rows  = map.grille.length;
  const cols  = map.grille[0]?.length ?? 1;
  const mapW  = ctx.canvas.width;
  const t     = makeTransform(rows, cols, map.tailleCase, mapW);

  const actualH = HUD_H + Math.ceil(rows * t.th);
  if (ctx.canvas.height !== actualH) ctx.canvas.height = actualH;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#080812";
  ctx.fillRect(0, 0, mapW, actualH);

  // ── HUD ────────────────────────────────────────────────────────────────────
  const hudGrad = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hudGrad.addColorStop(0, "#111128");
  hudGrad.addColorStop(1, "#0c0c1e");
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, mapW, HUD_H);

  const sepGrad = ctx.createLinearGradient(0, 0, mapW, 0);
  sepGrad.addColorStop(0,   "transparent");
  sepGrad.addColorStop(0.2, "#3333aa");
  sepGrad.addColorStop(0.5, "#5555cc");
  sepGrad.addColorStop(0.8, "#3333aa");
  sepGrad.addColorStop(1,   "transparent");
  ctx.fillStyle = sepGrad;
  ctx.fillRect(0, HUD_H - 1, mapW, 1);

  ctx.textBaseline = "middle";
  const mid = HUD_H / 2;

  // HP pill
  rr(ctx, 8, mid - 10, 64, 20, 5);
  ctx.fillStyle = "rgba(220,50,50,0.18)";
  ctx.fill();
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#FF5555"; ctx.fillText("♥", 14, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.pdv}`, 28, mid);

  // Money pill
  rr(ctx, 80, mid - 10, 72, 20, 5);
  ctx.fillStyle = "rgba(220,180,0,0.15)";
  ctx.fill();
  ctx.fillStyle = "#FFCC00"; ctx.fillText("$", 86, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.money}`, 98, mid);

  ctx.fillStyle = "#7788bb";
  ctx.fillText(`Nv.${levelIndex + 1}  Vague ${waveIndex + 1}/${waveCount}`, 162, mid);

  const bonusText = bm.getActifs().map((b: string) => b.replace("BOOST_", "")).join(" ") || "—";
  ctx.fillStyle = "#44446a"; ctx.fillText(`✦ ${bonusText}`, 290, mid);

  const phaseText  = phase === Phase.BUILD ? "[ CONSTRUCTION ]"
                   : phase === Phase.WAVE  ? "[ VAGUE ]"
                                           : "[ FIN ]";
  const phaseColor = phase === Phase.BUILD ? "#44DD88"
                   : phase === Phase.WAVE  ? "#FF6666"
                                           : "#FF3333";
  const phaseBg    = phase === Phase.BUILD ? "rgba(40,180,80,0.15)" : "rgba(220,60,60,0.15)";

  ctx.font = "bold 12px monospace";
  const phaseW = ctx.measureText(phaseText).width + 20;
  rr(ctx, mapW - phaseW - 8, mid - 10, phaseW, 20, 5);
  ctx.fillStyle = phaseBg;
  ctx.fill();
  ctx.fillStyle = phaseColor;
  ctx.textAlign = "right";
  ctx.fillText(phaseText, mapW - 14, mid);
  ctx.textAlign = "left";

  // ── Map tiles ──────────────────────────────────────────────────────────────
  const now = Date.now();

  for (const row of map.grille) {
    for (const c of row) {
      const cx = t.px(c.centre.x);
      const cy = t.py(c.centre.y);
      const x  = cx - t.tw / 2;
      const y  = cy - t.th / 2;
      const r  = Math.max(1, Math.min(t.tw, t.th) * 0.14);

      rr(ctx, x, y, t.tw, t.th, r);
      ctx.fillStyle = TILE_COLOR[c.type] ?? "#0a0a12";
      ctx.fill();

      if (c.type === TypesCases.Constructible && c.libre) {
        const alpha = (Math.sin(now / 600) * 0.5 + 0.5) * 0.14 + 0.04;
        rr(ctx, x, y, t.tw, t.th, r);
        ctx.fillStyle = `rgba(50,200,100,${alpha})`;
        ctx.fill();
      }

      rr(ctx, x + 0.5, y + 0.5, t.tw - 1, t.th - 1, r);
      ctx.strokeStyle = TILE_BORDER[c.type] ?? "#131318";
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Spawn pulsing marker
      if (c.type === TypesCases.Spawn) {
        const pulse = Math.sin(now / 500) * 0.5 + 0.5;
        rr(ctx, x + 2, y + 2, t.tw - 4, t.th - 4, r);
        ctx.strokeStyle = `rgba(220,110,30,${0.4 + pulse * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `bold ${Math.max(8, t.tw * 0.32)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255,140,60,${0.45 + pulse * 0.35})`;
        ctx.fillText("S", cx, cy);
      }

      // Base pulsing marker
      if (c.type === TypesCases.Base) {
        const pulse = Math.sin(now / 600 + 1) * 0.5 + 0.5;
        rr(ctx, x + 2, y + 2, t.tw - 4, t.th - 4, r);
        ctx.strokeStyle = `rgba(220,50,50,${0.4 + pulse * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `bold ${Math.max(8, t.tw * 0.32)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255,80,80,${0.45 + pulse * 0.35})`;
        ctx.fillText("B", cx, cy);
      }
    }
  }

  // ── Constructible numbers ──────────────────────────────────────────────────
  const numSize = Math.max(9, Math.min(t.tw, t.th) * 0.30);
  ctx.font = `bold ${numSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  map.constructibles.forEach((c, i) => {
    if (!c.libre) return;
    const cx = t.px(c.centre.x);
    const cy = t.py(c.centre.y);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(String(i), cx + 1, cy + 1);
    ctx.fillStyle = "#BBDD88";
    ctx.fillText(String(i), cx, cy);
  });

  // ── Tours ──────────────────────────────────────────────────────────────────
  for (const tour of tours) {
    if (!tour.position) continue;
    const cx  = t.px(tour.position.x);
    const cy  = t.py(tour.position.y);
    const r   = Math.min(t.tw, t.th) * 0.38;
    const col = getCouleur(tour.element);

    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = tour.rarete === RareteLettre.RARE ? 16 : 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    if (tour.rarete === RareteLettre.RARE) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = `bold ${r * 1.05}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(tour.lettre, cx, cy);
  }

  // ── Monstres ──────────────────────────────────────────────────────────────
  const mr = Math.min(t.tw, t.th) * 0.30;
  for (const m of monstres) {
    const cx  = t.px(m.position.x);
    const cy  = t.py(m.position.y);
    const col = getCouleur(m.element);

    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = m.isBoss ? 18 : 8;

    if (m.isBoss) {
      const br = mr * 1.7;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-br / 1.4, -br / 1.4, br * 1.4, br * 1.4);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.strokeRect(-br / 1.4, -br / 1.4, br * 1.4, br * 1.4);
      ctx.restore();
      ctx.font = `bold ${mr * 0.9}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("B", cx, cy);
    } else if (m.isArmored) {
      const ar = mr * 1.1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(cx - ar, cy - ar, ar * 2, ar * 2);
      ctx.fill();
      ctx.strokeStyle = "#AAAACC";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${mr * 0.7}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("🛡", cx, cy);
    } else if (zombieFrames.length === 6) {
      const frame     = zombieFrames[Math.floor(Date.now() / 120) % 6];
      const sh        = mr * 2.8;
      const sw        = sh * (frame.width / frame.height);
      const dx        = cx - sw / 2;
      const dy        = cy - sh * 0.82;
      const prevX     = monsterPrevX.get(m) ?? m.position.x;
      monsterPrevX.set(m, m.position.x);
      const facingRight = m.position.x >= prevX;
      ctx.restore();
      ctx.save();
      if (m.isRegen) { ctx.shadowColor = "#88FFCC"; ctx.shadowBlur = 8; }
      if (!facingRight) {
        ctx.translate(2 * cx, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(frame, dx, dy, sw, sh);
      if (m.isRegen) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle   = "#88FFCC";
        ctx.beginPath();
        ctx.arc(facingRight ? cx : 2 * cx - cx, cy, mr, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // Fallback circle while sprite loads
      ctx.beginPath();
      ctx.arc(cx, cy, mr * (m.isRegen ? 1.05 : 1.0), 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = m.isRegen ? "#88FFCC" : "rgba(0,0,0,0.4)";
      ctx.lineWidth = m.isRegen ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // Health bar
    const bw    = mr * 2.6;
    const bh    = Math.max(3, mr * 0.28);
    const bx    = cx - bw / 2;
    const by    = cy - mr * (m.isBoss ? 2.0 : 1.4) - bh - 2;
    const ratio = Math.max(0, m.pdv / m.pdvMax);
    ctx.fillStyle = "#1a0000";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = ratio > 0.5 ? "#22BB44" : ratio > 0.25 ? "#EEA020" : "#EE3020";
    ctx.fillRect(bx, by, bw * ratio, bh);

    // Status dots
    let sx = bx;
    const sy = by - 5;
    if (m.burnTimeRemaining > 0)  { ctx.fillStyle = "#FF6600"; ctx.fillRect(sx, sy, 4, 4); sx += 6; }
    if (m.slowTimeRemaining > 0)  { ctx.fillStyle = "#44AAFF"; ctx.fillRect(sx, sy, 4, 4); sx += 6; }
    if (m.armorTimeRemaining > 0) { ctx.fillStyle = "#44FF44"; ctx.fillRect(sx, sy, 4, 4); }
  }

  // ── Projectiles ────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 14px monospace";
  for (const p of projectiles) {
    const px  = t.px(p.from.x + (p.to.x - p.from.x) * p.progress);
    const py  = t.py(p.from.y + (p.to.y - p.from.y) * p.progress);
    const col = getCouleur(p.elem);
    ctx.save();
    ctx.globalAlpha = 1 - p.progress * 0.4;
    ctx.shadowColor = col;
    ctx.shadowBlur  = p.isRare ? 10 : 5;
    ctx.fillStyle   = col;
    ctx.fillText(projSymbol(p.elem, p.isRare), px, py);
    ctx.restore();
  }

  ctx.textAlign = "left";
}

export { CANVAS_W, CANVAS_H };
