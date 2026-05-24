import java.awt.Color;

/**
 * Remplacement de l'ancienne classe Element par un enum.
 * Chaque constante porte sa couleur et son effet appliqué sur un monstre touché.
 * getCouleur() est maintenu pour compatibilité avec Tours.drawVisuel().
 */
public enum Element {

    FEU {
        @Override public Color getCouleur() { return new Color(184, 22, 1); }
        @Override public void appliquerEffet(Monstres cible) {
            cible.burnDamagePerSec  = 2.0;
            cible.burnTimeRemaining = 3.0;
        }
    },
    EAU {
        @Override public Color getCouleur() { return new Color(6, 0, 160); }
        @Override public void appliquerEffet(Monstres cible) {
            cible.slowFactor       = 0.5;
            cible.slowTimeRemaining = 2.0;
        }
    },
    TERRE {
        @Override public Color getCouleur() { return new Color(0, 167, 15); }
        @Override public void appliquerEffet(Monstres cible) {
            cible.armorReduction      = 1.25;
            cible.armorTimeRemaining  = 3.0;
        }
    },
    VENT {
        @Override public Color getCouleur() { return new Color(173, 216, 230); }
        @Override public void appliquerEffet(Monstres cible) {
            cible.recoilCases++;
        }
    },
    NEUTRE {
        @Override public Color getCouleur() { return Color.GRAY; }
        @Override public void appliquerEffet(Monstres cible) {}
    };

    public abstract Color getCouleur();
    public abstract void appliquerEffet(Monstres cible);
}
