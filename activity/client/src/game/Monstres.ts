import { Element } from "./Element";
import type { Point2D } from "./types";

export class Monstre {
  pdv:              number;
  pdvMax:           number;
  speed:            number;
  reward:           number;
  readonly element: Element;
  readonly armor:   number;
  readonly regenPerSec: number;

  readonly isBoss:    boolean = false;
  readonly isArmored: boolean = false;
  readonly isRegen:   boolean = false;

  burnDamagePerSec   = 0.0;
  burnTimeRemaining  = 0.0;
  slowFactor         = 1.0;
  slowTimeRemaining  = 0.0;
  armorReduction     = 1.0;
  armorTimeRemaining = 0.0;
  recoilCases        = 0;

  position: Point2D = { x: 0, y: 0 };
  private cheminIdx     = 0;
  private distParcourue = 0.0;

  constructor(pdv: number, speed: number, reward: number, element: Element, armor = 1.0, regenPerSec = 0.0) {
    this.pdv         = pdv;
    this.pdvMax      = pdv;
    this.speed       = speed;
    this.reward      = reward;
    this.element     = element;
    this.armor       = armor;
    this.regenPerSec = regenPerSec;
  }

  scale(waveIndex: number): this {
    const hpMult = 1 + 0.20 * waveIndex;
    const spMult = 1 + 0.04 * waveIndex;
    this.pdv    = Math.round(this.pdv   * hpMult);
    this.pdvMax = Math.round(this.pdvMax * hpMult);
    this.speed  = Math.round(this.speed * spMult);
    this.reward = Math.ceil(this.reward * (1 + 0.15 * waveIndex));
    return this;
  }

  estMort():   boolean { return this.pdv <= 0; }
  estArrive(): boolean { return this.cheminIdx === -1; }

  initChemin(chemin: Point2D[]): void {
    this.cheminIdx     = 0;
    this.distParcourue = 0;
    if (chemin.length > 0) this.position = { ...chemin[0] };
  }

  update(dt: number, chemin: Point2D[]): void {
    if (this.regenPerSec > 0 && this.pdv > 0 && this.pdv < this.pdvMax) {
      this.pdv = Math.min(this.pdvMax, this.pdv + this.regenPerSec * dt);
    }

    if (this.burnTimeRemaining > 0) {
      this.pdv -= this.burnDamagePerSec * dt;
      this.burnTimeRemaining -= dt;
      if (this.burnTimeRemaining <= 0) { this.burnDamagePerSec = 0; this.burnTimeRemaining = 0; }
    }
    if (this.slowTimeRemaining > 0) {
      this.slowTimeRemaining -= dt;
      if (this.slowTimeRemaining <= 0) { this.slowFactor = 1.0; this.slowTimeRemaining = 0; }
    }
    if (this.armorTimeRemaining > 0) {
      this.armorTimeRemaining -= dt;
      if (this.armorTimeRemaining <= 0) { this.armorReduction = 1.0; this.armorTimeRemaining = 0; }
    }

    if (this.recoilCases > 0 && this.cheminIdx > 0) {
      this.cheminIdx     = Math.max(0, this.cheminIdx - this.recoilCases);
      this.distParcourue = 0;
      this.recoilCases   = 0;
      this.position      = { ...chemin[this.cheminIdx] };
    }

    if (this.cheminIdx < 0 || this.cheminIdx >= chemin.length - 1) {
      this.cheminIdx = -1;
      return;
    }

    this.distParcourue += this.speed * this.slowFactor * dt;

    // Walk through segments with stable segment length (from start point, not current pos)
    while (this.cheminIdx < chemin.length - 1) {
      const start  = chemin[this.cheminIdx];
      const target = chemin[this.cheminIdx + 1];
      const dx     = target.x - start.x;
      const dy     = target.y - start.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (segLen <= 0 || this.distParcourue >= segLen) {
        this.distParcourue = Math.max(0, this.distParcourue - segLen);
        this.cheminIdx++;
      } else {
        const t = this.distParcourue / segLen;
        this.position = { x: start.x + dx * t, y: start.y + dy * t };
        return;
      }
    }

    this.cheminIdx = -1;
    this.position  = { ...chemin[chemin.length - 1] };
  }
}

export class Boss extends Monstre {
  override readonly isBoss = true;
  constructor() { super(500, 25, 60, Element.FEU); }
}

export class Minion extends Monstre {
  constructor() { super(50, 60, 5, Element.NEUTRE); }
}

export class ArmoredMinion extends Monstre {
  override readonly isArmored = true;
  constructor() { super(140, 40, 15, Element.TERRE, 0.5); }
}

export class RegenMinion extends Monstre {
  override readonly isRegen = true;
  constructor() { super(80, 55, 10, Element.EAU, 1.0, 4.0); }
}

export class FireGrognard extends Monstre {
  constructor() { super(80, 50, 10, Element.FEU); }
}

export class WaterBrute extends Monstre {
  constructor() { super(130, 40, 18, Element.EAU); }
}

export class EarthBrute extends Monstre {
  constructor() { super(180, 32, 22, Element.TERRE, 0.8); }
}

export class WindGrognard extends Monstre {
  constructor() { super(60, 85, 10, Element.VENT); }
}

export function creerMonstre(type: string, waveIndex = 0): Monstre {
  let m: Monstre;
  switch (type.replace(/\s+/g, "")) {
    case "Boss":          m = new Boss(); break;
    case "FireGrognard":  m = new FireGrognard(); break;
    case "WaterBrute":    m = new WaterBrute(); break;
    case "EarthBrute":    m = new EarthBrute(); break;
    case "WindGrognard":  m = new WindGrognard(); break;
    case "ArmoredMinion": m = new ArmoredMinion(); break;
    case "RegenMinion":   m = new RegenMinion(); break;
    default:              m = new Minion(); break;
  }
  return waveIndex > 0 ? m.scale(waveIndex) : m;
}
