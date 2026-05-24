import { TypesCases } from "./types";
import { getCouleur } from "./Element";
import { RareteLettre } from "./RareteLettre";
import { BonusType } from "./BonusType";
import type { GameState } from "./GameSession";
import { Phase } from "./GameSession";

const MAP_SIZE  = 700;
const HUD_H     = 50;
const CANVAS_W  = MAP_SIZE;
const CANVAS_H  = MAP_SIZE + HUD_H;

// StdDraw Y-up → canvas Y-down
function px(x: number): number { return x; }
function py(y: number): number { return HUD_H + (MAP_SIZE - y); }

const CASE_COLORS: Record<number, string> = {
  [TypesCases.Spawn]:           "#FF8C00",
  [TypesCases.Base]:            "#CC0000",
  [TypesCases.Route]:           "#A0785A",
  [TypesCases.Constructible]:   "#90EE90",
  [TypesCases.NonConstructible]:"#444444",
};

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { map, monstres, tours, player, waveIndex, bm, phase } = state;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // HUD
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px monospace";
  ctx.textBaseline = "middle";
  const bonusList = bm.getActifs().map(b => (b as string).replace("BOOST_", "")).join(", ") || "aucun";
  ctx.fillText(
    `♥ ${player.pdv} pdv  |  $ ${player.money}  |  Vague ${waveIndex}  |  Bonus: ${bonusList}`,
    10, HUD_H / 2
  );
  if (phase === Phase.BUILD) {
    ctx.fillStyle = "#AAFFAA";
    ctx.fillText("[ CONSTRUCTION ]", CANVAS_W - 160, HUD_H / 2);
  } else if (phase === Phase.WAVE) {
    ctx.fillStyle = "#FFAAAA";
    ctx.fillText("[ VAGUE EN COURS ]", CANVAS_W - 170, HUD_H / 2);
  } else {
    ctx.fillStyle = "#FF4444";
    ctx.fillText("[ FIN DE PARTIE ]", CANVAS_W - 160, HUD_H / 2);
  }

  // Map
  for (const row of map.grille) {
    for (const c of row) {
      ctx.fillStyle = CASE_COLORS[c.type] ?? "#333333";
      const half = c.taille / 2;
      ctx.fillRect(px(c.centre.x) - half, py(c.centre.y) - half, c.taille, c.taille);
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px(c.centre.x) - half, py(c.centre.y) - half, c.taille, c.taille);
    }
  }

  // Constructible indices
  ctx.font = "11px monospace";
  ctx.fillStyle = "#FFFF00";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  map.constructibles.forEach((c, i) => {
    if (!c.libre) return;
    ctx.fillText(String(i), px(c.centre.x), py(c.centre.y));
  });

  // Tours
  for (const t of tours) {
    if (!t.position) continue;
    const cx = px(t.position.x);
    const cy = py(t.position.y);
    const sz = map.tailleCase * 0.8;
    ctx.fillStyle = getCouleur(t.element);
    ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz);

    if (t.rarete === RareteLettre.RARE) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.lettre, cx, cy);
  }

  // Monstres
  for (const m of monstres) {
    const cx = px(m.position.x);
    const cy = py(m.position.y);
    const r = 10;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = getCouleur(m.element);
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Barre de vie
    const barW = 20;
    const barH = 4;
    const ratio = Math.max(0, m.pdv / m.pdvMax);
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(cx - barW / 2, cy - r - 6, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? "#00CC00" : ratio > 0.25 ? "#FFAA00" : "#FF3300";
    ctx.fillRect(cx - barW / 2, cy - r - 6, barW * ratio, barH);
  }

  ctx.textAlign = "left";
}

export { CANVAS_W, CANVAS_H };
