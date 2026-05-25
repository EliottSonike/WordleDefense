import { creerMonstre, Monstre } from "./Monstres";

interface SpawnEntry { time: number; type: string }

export class Wave {
  private entries: SpawnEntry[] = [];
  private elapsed = 0.0;
  private idx     = 0;

  static fromText(text: string): Wave {
    const w = new Wave();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [t, type] = trimmed.split("|");
      const time = parseFloat(t);
      if (isNaN(time) || !type) throw new Error(`Format de vague invalide: "${trimmed}"`);
      w.entries.push({ time, type: type.trim() });
    }
    w.entries.sort((a, b) => a.time - b.time);
    return w;
  }

  update(dt: number, waveIndex = 0): Monstre[] {
    this.elapsed += dt;
    const spawned: Monstre[] = [];
    while (this.idx < this.entries.length && this.entries[this.idx].time <= this.elapsed) {
      spawned.push(creerMonstre(this.entries[this.idx].type, waveIndex));
      this.idx++;
    }
    return spawned;
  }

  estTerminee(): boolean {
    return this.idx >= this.entries.length;
  }
}
