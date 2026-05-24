import { Element } from "./Element";
import { RareteLettre } from "./RareteLettre";
import { StatLettre } from "./StatLettre";
import { LettreTour } from "./LettreTour";

const COMMUNS = ["A","I","S","N","R","T","O","U","L","D","C","M","P","G","B","V","F"];
const RARES   = ["H","J","K","W","X","Y","Z","Q"];
const ELEMENTS = [Element.FEU, Element.EAU, Element.TERRE, Element.VENT];

function makePool(): string[] {
  const pool: string[] = [];
  for (const l of COMMUNS) for (let i = 0; i < 4; i++) pool.push(l);
  for (const l of RARES)   pool.push(l);
  return pool;
}

const POOL = makePool(); // 17*4 + 8 = 76 entrées

const STAT_DEFS: Record<string, { statsFortes: string[]; fort: number; faible: number }> = {
  // Spéciaux
  M: { statsFortes: ["pdv"],      fort: 2.5, faible: 0.6 },
  J: { statsFortes: ["atk"],      fort: 4.0, faible: 0.3 },
  K: { statsFortes: ["atkspeed"], fort: 4.0, faible: 0.3 },
  // Rares
  H: { statsFortes: ["atk","atkspeed"], fort: 3.0, faible: 0.3 },
  W: { statsFortes: ["range"],          fort: 3.0, faible: 0.3 },
  X: { statsFortes: ["atk"],            fort: 3.0, faible: 0.3 },
  Y: { statsFortes: ["atkspeed"],       fort: 3.0, faible: 0.3 },
  Z: { statsFortes: ["pdv","atk"],      fort: 3.0, faible: 0.3 },
  Q: { statsFortes: ["range","atk"],    fort: 3.0, faible: 0.3 },
};

const DEFAULT_COMMUN = { fort: 2.0, faible: 0.6 };
const DEFAULT_RARE   = { fort: 3.0, faible: 0.3 };

function makeStatLettre(lettre: string): StatLettre {
  const def = STAT_DEFS[lettre];
  if (def) {
    return new StatLettre(new Set(def.statsFortes), def.fort, def.faible);
  }
  const isRare = RARES.includes(lettre);
  const { fort, faible } = isRare ? DEFAULT_RARE : DEFAULT_COMMUN;
  return new StatLettre(new Set(), fort, faible);
}

export function creerLettreTour(): LettreTour {
  const lettre  = POOL[Math.floor(Math.random() * POOL.length)];
  const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  const rarete  = RARES.includes(lettre) ? RareteLettre.RARE : RareteLettre.COMMUN;
  return new LettreTour(lettre, element, rarete, makeStatLettre(lettre));
}

export function creerLettreTourFromData(lettre: string, element: Element, rarete: RareteLettre): LettreTour {
  return new LettreTour(lettre, element, rarete, makeStatLettre(lettre));
}
