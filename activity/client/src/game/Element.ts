import type { Monstre } from "./Monstres";

export enum Element { FEU = "FEU", EAU = "EAU", TERRE = "TERRE", VENT = "VENT", NEUTRE = "NEUTRE" }

export function getCouleur(e: Element): string {
  switch (e) {
    case Element.FEU:   return "#B81601";
    case Element.EAU:   return "#0600A0";
    case Element.TERRE: return "#00A70F";
    case Element.VENT:  return "#ADD8E6";
    default:            return "#888888";
  }
}

export function appliquerEffet(e: Element, m: Monstre): void {
  switch (e) {
    case Element.FEU:
      m.burnDamagePerSec  = 2.0;
      m.burnTimeRemaining = 3.0;
      break;
    case Element.EAU:
      m.slowFactor        = 0.5;
      m.slowTimeRemaining = 2.0;
      break;
    case Element.TERRE:
      m.armorReduction    = 1.25;
      m.armorTimeRemaining= 3.0;
      break;
    case Element.VENT:
      m.recoilCases++;
      break;
  }
}
