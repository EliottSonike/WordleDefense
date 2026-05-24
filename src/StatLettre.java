import java.util.Set;

public class StatLettre {

    private final Set<String> statsFortes;
    private final double multiplicateurFort;
    private final double multiplicateurFaible;

    public StatLettre(Set<String> statsFortes, double multiplicateurFort, double multiplicateurFaible) {
        this.statsFortes = statsFortes;
        this.multiplicateurFort = multiplicateurFort;
        this.multiplicateurFaible = multiplicateurFaible;
    }

    public Set<String> getStatsFortes() {
        return statsFortes;
    }

    public double getMultiplicateur(String stat) {
        return statsFortes.contains(stat) ? multiplicateurFort : multiplicateurFaible;
    }
}
