import { TypesCases } from "./types";
import type { Case, MapData, Point2D } from "./types";

// Replicates Java Carte.chargerGrille() coordinate math
// centre.x = 350 + (col + 0.5 - cols/2) * tileSize
// centre.y = 350 - (row + 0.5 - rows/2) * tileSize  (Y-up StdDraw space)

function charType(c: string): TypesCases {
  switch (c) {
    case "S": return TypesCases.Spawn;
    case "B": return TypesCases.Base;
    case "R": return TypesCases.Route;
    case "C": return TypesCases.Constructible;
    default:  return TypesCases.NonConstructible;
  }
}

export function parseMap(text: string): MapData {
  const lines = text.split("\n").map(l => l.replace(/\r/, "")).filter(l => l.length > 0);
  const rows  = lines.length;
  const cols  = Math.max(...lines.map(l => l.length));
  const tileSize = Math.floor(700 / Math.max(rows, cols));

  const grille: Case[][] = [];
  const chemin: Case[]   = [];
  const constructibles: Case[] = [];
  let spawn: Point2D = { x: 0, y: 0 };
  let base:  Point2D = { x: 700, y: 700 };

  for (let row = 0; row < rows; row++) {
    const rowArr: Case[] = [];
    for (let col = 0; col < lines[row].length; col++) {
      const type = charType(lines[row][col]);
      const cx = 350 + (col + 0.5 - cols / 2) * tileSize;
      const cy = 350 - (row + 0.5 - rows / 2) * tileSize;
      const c: Case = { type, taille: tileSize, centre: { x: cx, y: cy }, libre: true };
      rowArr.push(c);
      if (type === TypesCases.Constructible) constructibles.push(c);
      if (type === TypesCases.Spawn) spawn = { x: cx, y: cy };
      if (type === TypesCases.Base)  base  = { x: cx, y: cy };
    }
    grille.push(rowArr);
  }

  // Trace path from Spawn to Base (same BFS as Java prochaineCase)
  const spawnCase = grille.flat().find(c => c.type === TypesCases.Spawn)!;
  const baseCase  = grille.flat().find(c => c.type === TypesCases.Base)!;

  if (spawnCase && baseCase) {
    const visited = new Set<Case>();
    let current: Case | null = spawnCase;
    chemin.push(spawnCase);
    visited.add(spawnCase);

    while (current && current !== baseCase) {
      const pos = findPos(grille, current);
      if (!pos) break;
      const [r, c] = pos;
      const neighbours = [
        grille[r - 1]?.[c],
        grille[r]?.[c + 1],
        grille[r + 1]?.[c],
        grille[r]?.[c - 1],
      ];
      const next = neighbours.find(
        n => n && !visited.has(n) && (n.type === TypesCases.Route || n.type === TypesCases.Base)
      ) ?? null;
      if (!next) break;
      visited.add(next);
      chemin.push(next);
      current = next;
    }
  }

  return { grille, tailleCase: tileSize, chemin, constructibles, spawn, base };
}

function findPos(grille: Case[][], target: Case): [number, number] | null {
  for (let r = 0; r < grille.length; r++)
    for (let c = 0; c < grille[r].length; c++)
      if (grille[r][c] === target) return [r, c];
  return null;
}
