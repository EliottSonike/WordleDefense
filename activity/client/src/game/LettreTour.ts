import { Element, appliquerEffet } from "./Element";
import { RareteLettre } from "./RareteLettre";
import { StatLettre } from "./StatLettre";
import type { BonusManager } from "./BonusManager";
import type { Monstre } from "./Monstres";
import type { Point2D } from "./types";

const VOYELLES = new Set(["A", "E", "I", "O", "U", "Y"]);

export class LettreTour {
  position: Point2D | null = null;
  niveau: number = 1;

  private readonly BASE_ATK      = 10.0;
  private readonly BASE_ATKSPEED = 1.0;
  private readonly BASE_RANGE    = 3.0;
  private readonly BASE_PDV      = 50.0;

  constructor(
    readonly lettre:    string,
    readonly element:   Element,
    readonly rarete:    RareteLettre,
    readonly statLettre: StatLettre,
  ) {}

  /** Clé unique d'identité : une seule entrée par combinaison lettre+élément */
  get cle(): string { return `${this.lettre}-${this.element}`; }

  estVoyelle(): boolean { return VOYELLES.has(this.lettre); }

  /** Multiplicateur de niveau : +20% par niveau au-dessus de 1 */
  private niveauMult(): number { return 1 + (this.niveau - 1) * 0.20; }

  private getBaseStat(stat: string): number {
    switch (stat) {
      case "atk":      return this.BASE_ATK;
      case "atkspeed": return this.BASE_ATKSPEED;
      case "range":    return this.BASE_RANGE;
      case "pdv":      return this.BASE_PDV;
      default:         return 1.0;
    }
  }

  getStatEffective(stat: string, bm: BonusManager): number {
    return this.getBaseStat(stat)
      * this.statLettre.getMultiplicateur(stat)
      * bm.getMultiplicateur(this, stat)
      * this.niveauMult();
  }

  appliquerEffetElement(target: Monstre, bm: BonusManager): void {
    appliquerEffet(this.element, target);
    const burnMult  = bm.getMultiplicateur(this, "burnDuration");
    const slowMult  = bm.getMultiplicateur(this, "slowAmount");
    const armorMult = bm.getMultiplicateur(this, "armorReduction");
    const recoilMult = bm.getMultiplicateur(this, "recoilCases");

    if (burnMult  !== 1.0) target.burnTimeRemaining  *= burnMult;
    if (slowMult  !== 1.0) target.slowTimeRemaining   *= slowMult;
    if (armorMult !== 1.0) target.armorTimeRemaining  *= armorMult;
    if (recoilMult > 1.0)  target.recoilCases = Math.round(target.recoilCases * recoilMult);
  }
}
