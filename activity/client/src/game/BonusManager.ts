import { BonusType, getBonusDef } from "./BonusType";
import { Element } from "./Element";
import type { LettreTour } from "./LettreTour";
import { RareteLettre } from "./RareteLettre";

export class BonusManager {
  private actifs: BonusType[] = [];
  private niveaux: Map<BonusType, number> = new Map();
  private globalMult: number = 1.0;

  activer(b: BonusType): boolean {
    if (this.actifs.includes(b) || this.actifs.length >= 3) return false;
    this.actifs.push(b);
    return true;
  }

  desactiver(b: BonusType): void {
    this.actifs = this.actifs.filter(x => x !== b);
  }

  setNiveau(b: BonusType, n: number): void {
    this.niveaux.set(b, n);
  }

  setGlobalMult(m: number): void { this.globalMult = m; }

  getActifs(): BonusType[] { return [...this.actifs]; }

  getMultiplicateur(tour: LettreTour, stat: string): number {
    return this.actifs.reduce((acc, b) => {
      const def = getBonusDef(b);
      if (!this.sApplique(b, tour)) return acc;
      if (def.statCiblee !== stat && def.statCiblee !== "*") return acc;
      const niveau = this.niveaux.get(b) ?? 1;
      // +10% of base buff per level above 1
      const effectiveMult = 1 + (def.mult - 1) * (1 + (niveau - 1) * 0.1);
      return acc * effectiveMult;
    }, 1.0) * this.globalMult;
  }

  private sApplique(b: BonusType, t: LettreTour): boolean {
    const ct = getBonusDef(b).cibleType;
    switch (ct) {
      case "CONSONNES": return !t.estVoyelle();
      case "VOYELLES":  return t.estVoyelle();
      case "FEU":       return t.element === Element.FEU;
      case "EAU":       return t.element === Element.EAU;
      case "TERRE":     return t.element === Element.TERRE;
      case "VENT":      return t.element === Element.VENT;
      case "RARES":     return t.rarete === RareteLettre.RARE;
      case "ALL":       return true;
      default:          return false;
    }
  }
}
