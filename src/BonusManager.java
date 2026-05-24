import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class BonusManager {

    private final List<BonusType> actifs = new ArrayList<>();

    /** Ajoute un bonus si absent et si le maximum de 3 n'est pas atteint. */
    public boolean activer(BonusType b) {
        if (actifs.contains(b) || actifs.size() >= 3) return false;
        actifs.add(b);
        return true;
    }

    public void desactiver(BonusType b) {
        actifs.remove(b);
    }

    public List<BonusType> getActifs() {
        return Collections.unmodifiableList(actifs);
    }

    /**
     * Retourne le produit des multiplicateurs de tous les bonus actifs
     * applicables à cette tour pour la stat demandée.
     */
    public double getMultiplicateur(LettreTour tour, String stat) {
        double result = 1.0;
        for (BonusType b : actifs) {
            boolean statMatch = b.getStatCiblee().equals(stat) || b.getStatCiblee().equals("*");
            if (statMatch && sApplique(b, tour)) {
                result *= b.getMultiplicateur();
            }
        }
        return result;
    }

    private boolean sApplique(BonusType b, LettreTour tour) {
        switch (b.getCibleType()) {
            case "CONSONNES": return !tour.estVoyelle();
            case "VOYELLES":  return tour.estVoyelle();
            case "FEU":       return tour.getElement() == Element.FEU;
            case "EAU":       return tour.getElement() == Element.EAU;
            case "TERRE":     return tour.getElement() == Element.TERRE;
            case "VENT":      return tour.getElement() == Element.VENT;
            case "RARES":     return tour.getRarete() == RareteLettre.RARE;
            case "ALL":       return true;
            default:          return false;
        }
    }
}
