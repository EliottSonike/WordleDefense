import { TypesCases } from "./types";
import { getCouleur } from "./Element";
import { RareteLettre } from "./RareteLettre";
import type { GameState } from "./GameSession";
import { Phase } from "./GameSession";

const MAP_SIZE = 700;
const HUD_H    = 50;
const CANVAS_W = MAP_SIZE;
const CANVAS_H = MAP_SIZE + HUD_H;

interface Transform {
  px: (x: number) => number;
  py: (y: number) => number;
  tw: number;
  th: number;
}

function makeTransform(rows: number, cols: number, tileSize: number): Transform {
  const mapStdW = cols * tileSize;
  const mapStdH = rows * tileSize;
  const minX    = 350 - (cols / 2) * tileSize;
  const maxY    = 350 + (rows / 2) * tileSize;
  const scale   = Math.min(MAP_SIZE / mapStdW, MAP_SIZE / mapStdH);
  return {
    px: (x) => (x - minX) * scale,
    py: (y) => HUD_H + (maxY - y) * scale,
    tw: tileSize * scale,
    th: tileSize * scale,
  };
}

// Base tile colors (richer palette)
const TILE_COLORS: Record<number, [string, string]> = {
  [TypesCases.Spawn]:           ["#D97706", "#92400E"],
  [TypesCases.Base]:            ["#DC2626", "#7F1D1D"],
  [TypesCases.Route]:           ["#92653A", "#5C3D1E"],
  [TypesCases.Constructible]:   ["#16A34A", "#14532D"],
  [TypesCases.NonConstructible]:["#1C1C1C", "#111111"],
};

function drawTile(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  tw: number, th: number,
  colors: [string, string],
  glowColor?: string,
  glowAlpha = 0,
): void {
  const x = cx - tw / 2;
  const y = cy - th / 2;

  // Base gradient
  const g = ctx.createLinearGradient(x, y, x, y + th);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, tw, th);

  // Top highlight sheen
  const sheen = ctx.createLinearGradient(x, y, x, y + th * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,0.12)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, tw, th);

  // Glow overlay (for constructible pulse)
  if (glowColor && glowAlpha > 0) {
    ctx.fillStyle = glowColor.replace(")", `,${glowAlpha})`).replace("rgb", "rgba");
    ctx.fillRect(x, y, tw, th);
  }

  // Border
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r},${g},${b})`;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { map, monstres, tours, player, waveIndex, bm, phase } = state;

  const rows = map.grille.length;
  const cols = map.grille[0]?.length ?? 1;
  const t    = makeTransform(rows, cols, map.tailleCase);

  const actualH = HUD_H + Math.ceil(rows * t.th);
  if (ctx.canvas.height !== actualH) ctx.canvas.height = actualH;

  // Background
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, CANVAS_W, actualH);

  // ── HUD ──────────────────────────────────────────────────────────────────
  const hudGrad = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hudGrad.addColorStop(0, "#1a1a3a");
  hudGrad.addColorStop(1, "#0d0d22");
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.strokeStyle = "#3344aa";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 0.5);
  ctx.lineTo(CANVAS_W, HUD_H - 0.5);
  ctx.stroke();

  ctx.font = "bold 15px monospace";
  ctx.textBaseline = "middle";
  const mid = HUD_H / 2;

  // HP
  ctx.fillStyle = "#FF6B6B"; ctx.fillText("♥", 10, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.pdv}`, 26, mid);
  // Money
  ctx.fillStyle = "#FFD700"; ctx.fillText("$", 90, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.money}`, 102, mid);
  // Wave
  ctx.fillStyle = "#AAAAFF"; ctx.fillText(`Vague ${waveIndex}`, 170, mid);
  // Bonus
  const bonusText = bm.getActifs().map((b: string) => b.replace("BOOST_", "")).join(" ") || "—";
  ctx.fillStyle = "#888888"; ctx.fillText(`✦ ${bonusText}`, 280, mid);

  // Phase badge
  const phaseText  = phase === Phase.BUILD ? "⚒ CONSTRUCTION" : phase === Phase.WAVE ? "⚔ VAGUE" : "✕ FIN";
  const phaseColor = phase === Phase.BUILD ? "#4ADE80" : phase === Phase.WAVE ? "#F87171" : "#FF4444";
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = phaseColor;
  ctx.textAlign = "right";
  ctx.shadowColor = phaseColor;
  ctx.shadowBlur = 8;
  ctx.fillText(phaseText, CANVAS_W - 10, mid);
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";

  // ── Map tiles ────────────────────────────────────────────────────────────
  const now = Date.now();
  for (const row of map.grille) {
    for (const c of row) {
      const cx = t.px(c.centre.x);
      const cy = t.py(c.centre.y);
      const colors = TILE_COLORS[c.type] ?? ["#333333", "#222222"];

      let glowAlpha = 0;
      if (c.type === TypesCases.Constructible && c.libre) {
        glowAlpha = (Math.sin(now / 700) * 0.5 + 0.5) * 0.35;
      }
      drawTile(ctx, cx, cy, t.tw, t.th, colors, "rgb(74,222,128)", glowAlpha);
    }
  }

  // ── Constructible slot numbers ────────────────────────────────────────────
  const fontSize = Math.max(11, Math.min(t.tw, t.th) * 0.42);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  map.constructibles.forEach((c, i) => {
    if (!c.libre) return;
    const cx = t.px(c.centre.x);
    const cy = t.py(c.centre.y);
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(String(i), cx, cy);
    ctx.shadowBlur = 0;
  });

  // ── Tours ────────────────────────────────────────────────────────────────
  for (const tour of tours) {
    if (!tour.position) continue;
    const cx = t.px(tour.position.x);
    const cy = t.py(tour.position.y);
    const sw = t.tw * 0.82;
    const sh = t.th * 0.82;
    const x  = cx - sw / 2;
    const y  = cy - sh / 2;
    const col = getCouleur(tour.element);

    // Tower body gradient
    const tg = ctx.createLinearGradient(x, y, x, y + sh);
    tg.addColorStop(0, col + "ee");
    tg.addColorStop(1, col + "99");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(x, y, sw, sh, 3);
    ctx.fill();

    // Rare gold glow
    if (tour.rarete === RareteLettre.RARE) {
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, sw, sh, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Letter
    const lSize = Math.min(sw, sh) * 0.58;
    ctx.font = `bold ${lSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(tour.lettre, cx, cy);
    ctx.shadowBlur = 0;
  }

  // ── Monstres ─────────────────────────────────────────────────────────────
  const r = Math.min(t.tw, t.th) * 0.33;
  for (const m of monstres) {
    const cx = t.px(m.position.x);
    const cy = t.py(m.position.y);
    const col = getCouleur(m.element);

    // Shadow
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.2, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const mg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    mg.addColorStop(0, col + "ff");
    mg.addColorStop(1, col + "99");
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Health bar
    const bw = r * 2.6;
    const bh = Math.max(3, r * 0.28);
    const bx = cx - bw / 2;
    const by = cy - r - bh - 3;
    const ratio = Math.max(0, m.pdv / m.pdvMax);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = "#550000";
    ctx.fillRect(bx, by, bw, bh);
    const hpColor = ratio > 0.5 ? "#22CC44" : ratio > 0.25 ? "#FFAA00" : "#FF3300";
    ctx.fillStyle = hpColor;
    ctx.fillRect(bx, by, bw * ratio, bh);
  }

  ctx.textAlign = "left";
}

export { CANVAS_W, CANVAS_H };
