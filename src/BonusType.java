public enum BonusType {
    BOOST_CONSONNES("CONSONNES", "atk",            1.5),
    BOOST_VOYELLES ("VOYELLES",  "atkspeed",        1.5),
    BOOST_FEU      ("FEU",       "burnDuration",    2.0),
    BOOST_EAU      ("EAU",       "slowAmount",      2.0),
    BOOST_TERRE    ("TERRE",     "armorReduction",  1.2),  // 1.25 * 1.2 = 1.5 effective
    BOOST_VENT     ("VENT",      "recoilCases",     2.0),
    BOOST_RARES    ("RARES",     "*",               1.3),  // "*" = toutes stats
    BOOST_ATK_GLOBAL("ALL",      "atk",             1.2);

    private final String cibleType;
    private final String statCiblee;
    private final double multiplicateur;

    BonusType(String cibleType, String statCiblee, double multiplicateur) {
        this.cibleType = cibleType;
        this.statCiblee = statCiblee;
        this.multiplicateur = multiplicateur;
    }

    public String getCibleType()     { return cibleType; }
    public String getStatCiblee()    { return statCiblee; }
    public double getMultiplicateur(){ return multiplicateur; }
}
