import { TypesCases } from "./types";
import { getCouleur } from "./Element";
import { RareteLettre } from "./RareteLettre";
import type { GameState } from "./GameSession";
import { Phase } from "./GameSession";

const MAP_SIZE = 700;
const HUD_H    = 50;
const CANVAS_W = MAP_SIZE;
const CANVAS_H = MAP_SIZE + HUD_H;

const CASE_COLORS: Record<number, string> = {
  [TypesCases.Spawn]:           "#FF8C00",
  [TypesCases.Base]:            "#CC0000",
  [TypesCases.Route]:           "#A0785A",
  [TypesCases.Constructible]:   "#90EE90",
  [TypesCases.NonConstructible]:"#444444",
};

// Transforms StdDraw coords → canvas pixels, scaling map to fill MAP_SIZE×MAP_SIZE
interface Transform {
  px:  (x: number) => number;
  py:  (y: number) => number;
  tw:  number;  // tile width in canvas pixels
  th:  number;  // tile height in canvas pixels
}

function makeTransform(rows: number, cols: number, tileSize: number): Transform {
  const mapStdW = cols * tileSize;
  const mapStdH = rows * tileSize;
  const minX    = 350 - (cols / 2) * tileSize;
  const maxY    = 350 + (rows / 2) * tileSize;
  const scaleX  = MAP_SIZE / mapStdW;
  const scaleY  = MAP_SIZE / mapStdH;
  return {
    px:  (x) => (x - minX) * scaleX,
    py:  (y) => HUD_H + (maxY - y) * scaleY,
    tw:  tileSize * scaleX,
    th:  tileSize * scaleY,
  };
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { map, monstres, tours, player, waveIndex, bm, phase } = state;

  const rows = map.grille.length;
  const cols = map.grille[0]?.length ?? 1;
  const t    = makeTransform(rows, cols, map.tailleCase);

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // HUD
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const bonusList = bm.getActifs().map(b => (b as string).replace("BOOST_", "")).join(", ") || "aucun";
  ctx.fillText(`♥ ${player.pdv}  |  $ ${player.money}  |  Vague ${waveIndex}  |  Bonus: ${bonusList}`, 10, HUD_H / 2);
  const phaseText = phase === Phase.BUILD ? "[ CONSTRUCTION ]" : phase === Phase.WAVE ? "[ VAGUE ]" : "[ FIN ]";
  const phaseColor = phase === Phase.BUILD ? "#AAFFAA" : phase === Phase.WAVE ? "#FFAAAA" : "#FF4444";
  ctx.fillStyle = phaseColor;
  ctx.textAlign = "right";
  ctx.fillText(phaseText, CANVAS_W - 10, HUD_H / 2);

  // Map
  for (const row of map.grille) {
    for (const c of row) {
      const cx = t.px(c.centre.x);
      const cy = t.py(c.centre.y);
      ctx.fillStyle = CASE_COLORS[c.type] ?? "#333333";
      ctx.fillRect(cx - t.tw / 2, cy - t.th / 2, t.tw, t.th);
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx - t.tw / 2, cy - t.th / 2, t.tw, t.th);
    }
  }

  // Numéros des cases constructibles
  const fontSize = Math.max(10, Math.min(t.tw, t.th) * 0.4);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = "#FFFF00";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  map.constructibles.forEach((c, i) => {
    if (!c.libre) return;
    ctx.fillText(String(i), t.px(c.centre.x), t.py(c.centre.y));
  });

  // Tours
  for (const tour of tours) {
    if (!tour.position) continue;
    const cx = t.px(tour.position.x);
    const cy = t.py(tour.position.y);
    const sw = t.tw * 0.85;
    const sh = t.th * 0.85;
    ctx.fillStyle = getCouleur(tour.element);
    ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
    if (tour.rarete === RareteLettre.RARE) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - sw / 2, cy - sh / 2, sw, sh);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.min(sw, sh) * 0.6}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tour.lettre, cx, cy);
  }

  // Monstres
  const r = Math.min(t.tw, t.th) * 0.35;
  for (const m of monstres) {
    const cx = t.px(m.position.x);
    const cy = t.py(m.position.y);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = getCouleur(m.element);
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Barre de vie
    const bw = r * 2.5;
    const bh = Math.max(3, r * 0.3);
    const ratio = Math.max(0, m.pdv / m.pdvMax);
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(cx - bw / 2, cy - r - bh - 2, bw, bh);
    ctx.fillStyle = ratio > 0.5 ? "#00CC00" : ratio > 0.25 ? "#FFAA00" : "#FF3300";
    ctx.fillRect(cx - bw / 2, cy - r - bh - 2, bw * ratio, bh);
  }

  ctx.textAlign = "left";
}

export { CANVAS_W, CANVAS_H };
