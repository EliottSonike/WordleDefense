public class LettreTour extends Tours {

    private static final double BASE_PDV      = 50.0;
    private static final double BASE_ATK      = 10.0;
    private static final double BASE_ATKSPEED = 1.0;
    private static final double BASE_RANGE    = 3.0;

    private final char         lettre;
    private final Element      element;
    private final RareteLettre rarete;
    private final StatLettre   statLettre;

    public LettreTour(char lettre, Element element, RareteLettre rarete, StatLettre statLettre) {
        this.lettre    = lettre;
        this.element   = element;
        this.rarete    = rarete;
        this.statLettre = statLettre;
        // champs hérités de Entites / Tours
        this.name     = String.valueOf(lettre);
        this.elem     = element;
        this.cost     = 0;
        this.pdv      = BASE_PDV;
        this.atk      = BASE_ATK;
        this.atkspeed = BASE_ATKSPEED;
        this.range    = BASE_RANGE;
    }

    /** Retourne true si la lettre est une voyelle (A E I O U Y). */
    public boolean estVoyelle() {
        char u = Character.toUpperCase(lettre);
        return u == 'A' || u == 'E' || u == 'I' || u == 'O' || u == 'U' || u == 'Y';
    }

    private double getBaseStat(String statName) {
        switch (statName) {
            case "atk":      return BASE_ATK;
            case "atkspeed": return BASE_ATKSPEED;
            case "range":    return BASE_RANGE;
            case "pdv":      return BASE_PDV;
            default:         return 1.0;
        }
    }

    /**
     * Stat effective = base × multiplicateur lettre × multiplicateur bonus.
     */
    public double getStatEffective(String statName, BonusManager bm) {
        return getBaseStat(statName)
             * statLettre.getMultiplicateur(statName)
             * bm.getMultiplicateur(this, statName);
    }

    /**
     * Applique l'effet élémentaire sur la cible, puis ajuste les paramètres
     * d'effet selon les bonus actifs.
     */
    public void appliquerEffetElement(Monstres cible, BonusManager bm) {
        element.appliquerEffet(cible);
        switch (element) {
            case FEU:
                double burnMult = bm.getMultiplicateur(this, "burnDuration");
                cible.burnTimeRemaining *= burnMult;
                break;
            case EAU:
                double slowMult = bm.getMultiplicateur(this, "slowAmount");
                if (slowMult > 1.0) cible.slowFactor = 0.5 / slowMult;
                break;
            case TERRE:
                double armorMult = bm.getMultiplicateur(this, "armorReduction");
                cible.armorReduction *= armorMult;
                break;
            case VENT:
                double recoilMult = bm.getMultiplicateur(this, "recoilCases");
                if (recoilMult > 1.0) cible.recoilCases = (int)(cible.recoilCases * recoilMult);
                break;
            default:
                break;
        }
    }

    /**
     * No-op : empêche l'appel StdDraw de Tours.drawVisuel().
     * Le rendu réel est délégué à GameRenderer.
     */
    @Override
    protected void drawVisuel(Point2D p, double taille) {}

    // --- Getters ---
    public char         getLettre()    { return lettre; }
    public Element      getElement()   { return element; }
    public RareteLettre getRarete()    { return rarete; }
    public StatLettre   getStatLettre(){ return statLettre; }
}
