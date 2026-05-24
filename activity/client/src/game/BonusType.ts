export enum BonusType {
  BOOST_CONSONNES  = "BOOST_CONSONNES",
  BOOST_VOYELLES   = "BOOST_VOYELLES",
  BOOST_FEU        = "BOOST_FEU",
  BOOST_EAU        = "BOOST_EAU",
  BOOST_TERRE      = "BOOST_TERRE",
  BOOST_VENT       = "BOOST_VENT",
  BOOST_RARES      = "BOOST_RARES",
  BOOST_ATK_GLOBAL = "BOOST_ATK_GLOBAL",
}

interface BonusDef { cibleType: string; statCiblee: string; mult: number }

const DEFS: Record<BonusType, BonusDef> = {
  [BonusType.BOOST_CONSONNES]:  { cibleType: "CONSONNES", statCiblee: "atk",           mult: 1.5 },
  [BonusType.BOOST_VOYELLES]:   { cibleType: "VOYELLES",  statCiblee: "atkspeed",       mult: 1.5 },
  [BonusType.BOOST_FEU]:        { cibleType: "FEU",       statCiblee: "burnDuration",   mult: 2.0 },
  [BonusType.BOOST_EAU]:        { cibleType: "EAU",       statCiblee: "slowAmount",     mult: 2.0 },
  [BonusType.BOOST_TERRE]:      { cibleType: "TERRE",     statCiblee: "armorReduction", mult: 1.2 },
  [BonusType.BOOST_VENT]:       { cibleType: "VENT",      statCiblee: "recoilCases",    mult: 2.0 },
  [BonusType.BOOST_RARES]:      { cibleType: "RARES",     statCiblee: "*",              mult: 1.3 },
  [BonusType.BOOST_ATK_GLOBAL]: { cibleType: "ALL",       statCiblee: "atk",            mult: 1.2 },
};

export function getBonusDef(b: BonusType): BonusDef { return DEFS[b]; }
export const ALL_BONUS_TYPES = Object.values(BonusType);
