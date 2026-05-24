import { BonusManager } from "./BonusManager";
import { BonusType } from "./BonusType";
import { creerLettreTour } from "./LettreTourFactory";
import { LettreTour } from "./LettreTour";
import { Monstre } from "./Monstres";
import { Wave } from "./Wave";
import type { MapData, Point2D } from "./types";
import { dist } from "./types";

export enum Phase { BUILD, WAVE, OVER }

export interface Player {
  pdv:   number;
  money: number;
}

export interface GameState {
  phase:      Phase;
  player:     Player;
  monstres:   Monstre[];
  tours:      LettreTour[];
  inventaire: LettreTour[];
  waveIndex:  number;
  bm:         BonusManager;
  map:        MapData;
  cheminPx:   Point2D[];
}

const INVOCATION_COST = 10;

export class GameSession {
  private phase: Phase = Phase.BUILD;
  private player: Player = { pdv: 20, money: 100 };
  private monstres: Monstre[] = [];
  private tours: LettreTour[] = [];
  private inventaire: LettreTour[] = [];
  private waveIndex = 0;
  private bm = new BonusManager();
  private wave: Wave | null = null;
  private waveTexts: string[] = [];
  private cooldowns = new Map<LettreTour, number>();

  constructor(
    private map: MapData,
    waveTexts: string[],
  ) {
    this.waveTexts = waveTexts;
    this.cheminPx = map.chemin.map(c => c.centre);
  }

  private cheminPx: Point2D[];

  getState(): GameState {
    return {
      phase:      this.phase,
      player:     { ...this.player },
      monstres:   this.monstres,
      tours:      this.tours,
      inventaire: this.inventaire,
      waveIndex:  this.waveIndex,
      bm:         this.bm,
      map:        this.map,
      cheminPx:   this.cheminPx,
    };
  }

  invoquer(): LettreTour | null {
    if (this.player.money < INVOCATION_COST) return null;
    this.player.money -= INVOCATION_COST;
    const lt = creerLettreTour();
    this.inventaire.push(lt);
    return lt;
  }

  placerTour(invIdx: number, caseIdx: number): string {
    if (this.phase !== Phase.BUILD) return "Pas en phase de construction";
    const lt = this.inventaire[invIdx];
    if (!lt) return "Index inventaire invalide";
    const c = this.map.constructibles[caseIdx];
    if (!c) return "Index de case invalide";
    if (!c.libre) return "Case déjà occupée";

    lt.position = { ...c.centre };
    c.libre = false;
    this.tours.push(lt);
    this.inventaire.splice(invIdx, 1);
    return "ok";
  }

  activerBonus(b: BonusType): boolean {
    return this.bm.activer(b);
  }

  desactiverBonus(b: BonusType): void {
    this.bm.desactiver(b);
  }

  lancerVague(): string {
    if (this.phase === Phase.WAVE) return "Vague déjà en cours";
    if (this.waveIndex >= this.waveTexts.length) return "Plus de vagues";
    this.wave = Wave.fromText(this.waveTexts[this.waveIndex]);
    this.phase = Phase.WAVE;
    return "ok";
  }

  tick(dt: number): void {
    if (this.phase === Phase.OVER || this.phase === Phase.BUILD) return;

    // Spawn
    if (this.wave) {
      const spawned = this.wave.update(dt);
      for (const m of spawned) {
        m.initChemin(this.cheminPx);
        this.monstres.push(m);
      }
    }

    // Update monsters
    for (const m of this.monstres) m.update(dt, this.cheminPx);

    // Arrived → damage player
    const arrived = this.monstres.filter(m => m.estArrive());
    for (const m of arrived) { this.player.pdv -= 1; m.pdv = 0; }

    // Remove dead
    this.monstres = this.monstres.filter(m => !m.estMort() && !m.estArrive());

    // Tower attacks
    const tileSize = this.map.tailleCase;
    for (const t of this.tours) {
      if (!t.position) continue;
      const cd = this.cooldowns.get(t) ?? 0;
      const atkspeed = t.getStatEffective("atkspeed", this.bm);
      const interval = 1.0 / atkspeed;
      const newCd = cd - dt;
      if (newCd > 0) { this.cooldowns.set(t, newCd); continue; }

      const range = t.getStatEffective("range", this.bm) * tileSize;
      const atk   = t.getStatEffective("atk",   this.bm);

      let target: Monstre | null = null;
      let bestDist = Infinity;
      for (const m of this.monstres) {
        const d = dist(t.position, m.position);
        if (d <= range && d < bestDist) { bestDist = d; target = m; }
      }

      if (target) {
        target.pdv -= atk * target.armorReduction;
        t.appliquerEffetElement(target, this.bm);
        this.cooldowns.set(t, interval);
        if (target.estMort()) {
          this.player.money += target.reward;
          this.monstres = this.monstres.filter(m => m !== target);
        }
      } else {
        this.cooldowns.set(t, Math.max(newCd, 0));
      }
    }

    // Game over
    if (this.player.pdv <= 0) { this.phase = Phase.OVER; return; }

    // Wave ended
    if (this.wave?.estTerminee() && this.monstres.length === 0) {
      this.waveIndex++;
      this.wave = null;
      this.phase = this.waveIndex >= this.waveTexts.length ? Phase.OVER : Phase.BUILD;
    }
  }
}
