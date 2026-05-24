import { BonusType, getBonusDef } from "./BonusType";
import { Element } from "./Element";
import type { LettreTour } from "./LettreTour";
import { RareteLettre } from "./RareteLettre";

export class BonusManager {
  private actifs: BonusType[] = [];

  activer(b: BonusType): boolean {
    if (this.actifs.includes(b) || this.actifs.length >= 3) return false;
    this.actifs.push(b);
    return true;
  }

  desactiver(b: BonusType): void {
    this.actifs = this.actifs.filter(x => x !== b);
  }

  getActifs(): BonusType[] { return [...this.actifs]; }

  getMultiplicateur(tour: LettreTour, stat: string): number {
    return this.actifs.reduce((acc, b) => {
      const def = getBonusDef(b);
      if (!this.sApplique(b, tour)) return acc;
      if (def.statCiblee !== stat && def.statCiblee !== "*") return acc;
      return acc * def.mult;
    }, 1.0);
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
