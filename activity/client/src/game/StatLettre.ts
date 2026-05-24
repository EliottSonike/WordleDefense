export class StatLettre {
  constructor(
    private readonly statsFortes: Set<string>,
    private readonly fort:   number,
    private readonly faible: number
  ) {}

  getMultiplicateur(stat: string): number {
    return this.statsFortes.has(stat) ? this.fort : this.faible;
  }
}
