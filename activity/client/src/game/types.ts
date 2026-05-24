export interface Point2D { x: number; y: number }

export function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export enum TypesCases { Spawn, Base, Route, Constructible, NonConstructible }

export interface Case {
  type:   TypesCases;
  taille: number;
  centre: Point2D;
  libre:  boolean;
}

export function caseContains(c: Case, x: number, y: number): boolean {
  const h = c.taille / 2;
  return Math.abs(c.centre.x - x) <= h && Math.abs(c.centre.y - y) <= h;
}

export interface MapData {
  grille:    Case[][];
  tailleCase: number;
  chemin:    Case[];
  constructibles: Case[];
  spawn:     Point2D;
  base:      Point2D;
}
