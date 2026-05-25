import { Element, appliquerEffet } from "./Element";
import { RareteLettre } from "./RareteLettre";
import { StatLettre } from "./StatLettre";
import type { BonusManager } from "./BonusManager";
import type { Monstre } from "./Monstres";
import type { Point2D } from "./types";

const VOYELLES = new Set(["A", "E", "I", "O", "U", "Y"]);

const UPG_COSTS = [50, 100]; // coût pour passer au niveau 1 puis 2 (max 2 upgrades par stat)

export class LettreTour {
  position: Point2D | null = null;
  niveau: number = 1;
  gameUpgrades: Map<string, number> = new Map(); // stat → nb d'upgrades en cours de partie (0-2)

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

  get cle(): string { return `${this.lettre}-${this.element}`; }

  estVoyelle(): boolean { return VOYELLES.has(this.lettre); }

  private niveauMult(): number { return 1 + (this.niveau - 1) * 0.20; }

  getBaseStat(stat: string): number {
    switch (stat) {
      case "atk":      return this.BASE_ATK;
      case "atkspeed": return this.BASE_ATKSPEED;
      case "range":    return this.BASE_RANGE;
      case "pdv":      return this.BASE_PDV;
      default:         return 1.0;
    }
  }

  getStatEffective(stat: string, bm: BonusManager): number {
    const upgrades = this.gameUpgrades.get(stat) ?? 0;
    const upgMult  = stat === "atk"      ? 1 + upgrades * 0.25
                   : stat === "atkspeed" ? 1 + upgrades * 0.20
                   : 1.0;
    return this.getBaseStat(stat)
      * this.statLettre.getMultiplicateur(stat)
      * bm.getMultiplicateur(this, stat)
      * this.niveauMult()
      * upgMult;
  }

  upgradeATKCost(): number | null {
    const tier = this.gameUpgrades.get("atk") ?? 0;
    return UPG_COSTS[tier] ?? null;
  }

  upgradeSpeedCost(): number | null {
    const tier = this.gameUpgrades.get("atkspeed") ?? 0;
    return UPG_COSTS[tier] ?? null;
  }

  appliquerEffetElement(target: Monstre, bm: BonusManager): void {
    appliquerEffet(this.element, target);
    const burnMult   = bm.getMultiplicateur(this, "burnDuration");
    const slowMult   = bm.getMultiplicateur(this, "slowAmount");
    const armorMult  = bm.getMultiplicateur(this, "armorReduction");
    const recoilMult = bm.getMultiplicateur(this, "recoilCases");

    if (burnMult   !== 1.0) target.burnTimeRemaining  *= burnMult;
    if (slowMult   !== 1.0) target.slowTimeRemaining   *= slowMult;
    if (armorMult  !== 1.0) target.armorTimeRemaining  *= armorMult;
    if (recoilMult >  1.0)  target.recoilCases = Math.round(target.recoilCases * recoilMult);
  }
}
