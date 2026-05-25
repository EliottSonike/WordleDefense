import { TypesCases } from "./types";
import { getCouleur, Element } from "./Element";
import { RareteLettre } from "./RareteLettre";
import type { GameState, Projectile } from "./GameSession";
import { Phase } from "./GameSession";

const HUD_H    = 50;
const CANVAS_W = 700;
const CANVAS_H = CANVAS_W + HUD_H;

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
  [TypesCases.Spawn]:            "#C05A00",
  [TypesCases.Base]:             "#9B1B1B",
  [TypesCases.Route]:            "#7A5230",
  [TypesCases.Constructible]:    "#1A5C30",
  [TypesCases.NonConstructible]: "#171717",
};

const TILE_BORDER: Record<number, string> = {
  [TypesCases.Spawn]:            "#E07020",
  [TypesCases.Base]:             "#CC3333",
  [TypesCases.Route]:            "#9A7250",
  [TypesCases.Constructible]:    "#2A8C4A",
  [TypesCases.NonConstructible]: "#222222",
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

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { map, monstres, tours, player, waveIndex, waveCount, bm, phase, projectiles } = state;

  const rows  = map.grille.length;
  const cols  = map.grille[0]?.length ?? 1;
  const mapW  = ctx.canvas.width;
  const t     = makeTransform(rows, cols, map.tailleCase, mapW);

  const actualH = HUD_H + Math.ceil(rows * t.th);
  if (ctx.canvas.height !== actualH) ctx.canvas.height = actualH;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(0, 0, mapW, actualH);

  // ── HUD ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = "#111122";
  ctx.fillRect(0, 0, mapW, HUD_H);
  ctx.fillStyle = "#2a2a66";
  ctx.fillRect(0, HUD_H - 1, mapW, 1);

  ctx.font = "bold 14px monospace";
  ctx.textBaseline = "middle";
  const mid = HUD_H / 2;

  ctx.fillStyle = "#FF5555"; ctx.fillText("♥", 12, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.pdv}`, 26, mid);

  ctx.fillStyle = "#FFCC00"; ctx.fillText("$", 85, mid);
  ctx.fillStyle = "#FFFFFF"; ctx.fillText(` ${player.money}`, 97, mid);

  ctx.fillStyle = "#AAAADD"; ctx.fillText(`Vague ${waveIndex + 1}/${waveCount}`, 165, mid);

  const bonusText = bm.getActifs().map((b: string) => b.replace("BOOST_", "")).join(" ") || "—";
  ctx.fillStyle = "#666699"; ctx.fillText(`✦ ${bonusText}`, 285, mid);

  const phaseText  = phase === Phase.BUILD ? "[ CONSTRUCTION ]"
                   : phase === Phase.WAVE  ? "[ VAGUE ]"
                                           : "[ FIN ]";
  const phaseColor = phase === Phase.BUILD ? "#44DD88"
                   : phase === Phase.WAVE  ? "#FF6666"
                                           : "#FF3333";
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = phaseColor;
  ctx.textAlign = "right";
  ctx.fillText(phaseText, mapW - 12, mid);
  ctx.textAlign = "left";

  // ── Map tiles ──────────────────────────────────────────────────────────────
  const now = Date.now();
  for (const row of map.grille) {
    for (const c of row) {
      const cx = t.px(c.centre.x);
      const cy = t.py(c.centre.y);
      const x  = cx - t.tw / 2;
      const y  = cy - t.th / 2;

      ctx.fillStyle = TILE_COLOR[c.type] ?? "#111111";
      ctx.fillRect(x, y, t.tw, t.th);

      if (c.type === TypesCases.Constructible && c.libre) {
        const alpha = (Math.sin(now / 600) * 0.5 + 0.5) * 0.18 + 0.05;
        ctx.fillStyle = `rgba(50, 200, 100, ${alpha})`;
        ctx.fillRect(x, y, t.tw, t.th);
      }

      ctx.strokeStyle = TILE_BORDER[c.type] ?? "#1a1a1a";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(x + 0.5, y + 0.5, t.tw - 1, t.th - 1);
    }
  }

  // ── Constructible numbers ──────────────────────────────────────────────────
  const numSize = Math.max(12, Math.min(t.tw, t.th) * 0.38);
  ctx.font = `bold ${numSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  map.constructibles.forEach((c, i) => {
    if (!c.libre) return;
    const cx = t.px(c.centre.x);
    const cy = t.py(c.centre.y);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(String(i), cx + 1, cy + 1);
    ctx.fillStyle = "#EEFFCC";
    ctx.fillText(String(i), cx, cy);
  });

  // ── Tours ──────────────────────────────────────────────────────────────────
  for (const tour of tours) {
    if (!tour.position) continue;
    const cx  = t.px(tour.position.x);
    const cy  = t.py(tour.position.y);
    const sw  = t.tw * 0.80;
    const sh  = t.th * 0.80;
    const col = getCouleur(tour.element);

    ctx.fillStyle = col;
    ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);

    if (tour.rarete === RareteLettre.RARE) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - sw / 2, cy - sh / 2, sw, sh);
    } else {
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - sw / 2, cy - sh / 2, sw, sh);
    }

    const lSize = Math.min(sw, sh) * 0.55;
    ctx.font = `bold ${lSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(tour.lettre, cx, cy);
  }

  // ── Monstres ──────────────────────────────────────────────────────────────
  const r = Math.min(t.tw, t.th) * 0.30;
  for (const m of monstres) {
    const cx  = t.px(m.position.x);
    const cy  = t.py(m.position.y);
    const col = getCouleur(m.element);

    if (m.isBoss) {
      // Diamond shape for boss
      const br = r * 1.7;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = col;
      ctx.fillRect(-br / 1.4, -br / 1.4, br * 1.4, br * 1.4);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.strokeRect(-br / 1.4, -br / 1.4, br * 1.4, br * 1.4);
      ctx.restore();
      ctx.font = `bold ${r * 0.9}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("B", cx, cy);
    } else if (m.isArmored) {
      // Hexagon-ish: draw as slightly larger square with steel color
      const ar = r * 1.1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(cx - ar, cy - ar, ar * 2, ar * 2);
      ctx.fill();
      ctx.strokeStyle = "#AAAACC";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${r * 0.7}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("🛡", cx, cy);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r * (m.isRegen ? 1.05 : 1.0), 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = m.isRegen ? "#88FFCC" : "#000000";
      ctx.lineWidth = m.isRegen ? 2 : 1;
      ctx.stroke();
    }

    // Health bar
    const bw    = r * 2.6;
    const bh    = Math.max(3, r * 0.28);
    const bx    = cx - bw / 2;
    const by    = cy - r * (m.isBoss ? 2.0 : 1.4) - bh - 2;
    const ratio = Math.max(0, m.pdv / m.pdvMax);
    ctx.fillStyle = "#330000";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = ratio > 0.5 ? "#22BB44" : ratio > 0.25 ? "#EEA020" : "#EE3020";
    ctx.fillRect(bx, by, bw * ratio, bh);

    // Status effect dots
    let sx = bx;
    const sy = by - 5;
    if (m.burnTimeRemaining > 0) {
      ctx.fillStyle = "#FF6600";
      ctx.fillRect(sx, sy, 4, 4);
      sx += 6;
    }
    if (m.slowTimeRemaining > 0) {
      ctx.fillStyle = "#44AAFF";
      ctx.fillRect(sx, sy, 4, 4);
      sx += 6;
    }
    if (m.armorTimeRemaining > 0) {
      ctx.fillStyle = "#44FF44";
      ctx.fillRect(sx, sy, 4, 4);
    }
  }

  // ── Projectiles ────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 13px monospace";
  for (const p of projectiles) {
    const px = t.px(p.from.x + (p.to.x - p.from.x) * p.progress);
    const py = t.py(p.from.y + (p.to.y - p.from.y) * p.progress);
    const alpha = 1 - p.progress * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = getCouleur(p.elem);
    ctx.fillText(projSymbol(p.elem, p.isRare), px, py);
  }
  ctx.globalAlpha = 1.0;

  ctx.textAlign = "left";
}

export { CANVAS_W, CANVAS_H };
