import { Element } from "./Element";
import type { Point2D } from "./types";

export class Monstre {
  pdv:                number;
  pdvMax:             number;
  speed:              number;
  reward:             number;
  readonly element:   Element;

  // Effets temporaires
  burnDamagePerSec  = 0.0;
  burnTimeRemaining = 0.0;
  slowFactor        = 1.0;
  slowTimeRemaining = 0.0;
  armorReduction    = 1.0;
  armorTimeRemaining= 0.0;
  recoilCases       = 0;

  position: Point2D = { x: 0, y: 0 };
  private cheminIdx = 0;
  private distParcourue = 0.0;

  constructor(pdv: number, speed: number, reward: number, element: Element) {
    this.pdv    = pdv;
    this.pdvMax = pdv;
    this.speed  = speed;
    this.reward = reward;
    this.element = element;
  }

  estMort():    boolean { return this.pdv <= 0; }
  estArrive(): boolean { return this.cheminIdx === -1; }

  initChemin(chemin: Point2D[]): void {
    this.cheminIdx = 0;
    if (chemin.length > 0) this.position = { ...chemin[0] };
  }

  update(dt: number, chemin: Point2D[]): void {
    // Effets temporaires
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
      this.cheminIdx = Math.max(0, this.cheminIdx - this.recoilCases);
      this.recoilCases = 0;
      this.position = { ...chemin[this.cheminIdx] };
      this.distParcourue = 0;
    }

    if (this.cheminIdx < 0 || this.cheminIdx >= chemin.length - 1) {
      this.cheminIdx = -1;
      return;
    }

    const effectiveSpeed = this.speed * this.slowFactor;
    this.distParcourue += effectiveSpeed * dt;

    const target = chemin[this.cheminIdx + 1];
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (segLen <= 0 || this.distParcourue >= segLen) {
      this.distParcourue -= segLen;
      this.cheminIdx++;
      if (this.cheminIdx >= chemin.length - 1) {
        this.cheminIdx = -1;
        this.position = { ...chemin[chemin.length - 1] };
      } else {
        this.position = { ...chemin[this.cheminIdx] };
      }
    } else {
      const t = this.distParcourue / segLen;
      const prev = chemin[this.cheminIdx];
      this.position = { x: prev.x + dx * t, y: prev.y + dy * t };
    }
  }
}

export class Boss extends Monstre {
  constructor() { super(300, 30, 50, Element.FEU); }
}

export class Minion extends Monstre {
  constructor() { super(50, 60, 5, Element.NEUTRE); }
}

export class FireGrognard extends Monstre {
  constructor() { super(80, 50, 10, Element.FEU); }
}

export class WaterBrute extends Monstre {
  constructor() { super(120, 40, 15, Element.EAU); }
}

export class EarthBrute extends Monstre {
  constructor() { super(150, 35, 20, Element.TERRE); }
}

export class WindGrognard extends Monstre {
  constructor() { super(60, 80, 10, Element.VENT); }
}

export function creerMonstre(type: string): Monstre {
  switch (type) {
    case "Boss":         return new Boss();
    case "FireGrognard": return new FireGrognard();
    case "WaterBrute":   return new WaterBrute();
    case "EarthBrute":   return new EarthBrute();
    case "WindGrognard": return new WindGrognard();
    default:             return new Minion();
  }
}
