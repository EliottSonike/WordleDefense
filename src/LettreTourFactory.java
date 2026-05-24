import java.util.*;

public class LettreTourFactory {

    private static final Map<Character, StatLettre> STATS  = new HashMap<>();
    private static final List<Character>            POOL   = new ArrayList<>();
    private static final Set<Character>             RARES  = new HashSet<>(Arrays.asList('H','J','K','W','X','Y','Z','Q'));
    private static final Element[]                  ELEMS  = {Element.FEU, Element.EAU, Element.TERRE, Element.VENT};
    private static final Random                     RANDOM = new Random();

    static {
        // --- COMMUNS (fort=2.0, faible=0.6) ---
        STATS.put('A', new StatLettre(set("range","atkspeed"),  2.0, 0.6));
        STATS.put('E', new StatLettre(set("atk","atkspeed"),    2.0, 0.6));
        STATS.put('I', new StatLettre(set("atkspeed","range"),  2.0, 0.6));
        STATS.put('S', new StatLettre(set("atk","pdv"),         2.0, 0.6));
        STATS.put('N', new StatLettre(set("pdv","range"),       2.0, 0.6));
        STATS.put('R', new StatLettre(set("atk","range"),       2.0, 0.6));
        STATS.put('T', new StatLettre(set("atk","atkspeed"),    2.0, 0.6));
        STATS.put('O', new StatLettre(set("pdv","atkspeed"),    2.0, 0.6));
        STATS.put('U', new StatLettre(set("range","pdv"),       2.0, 0.6));
        STATS.put('L', new StatLettre(set("atk","pdv"),         2.0, 0.6));
        STATS.put('D', new StatLettre(set("pdv","atk"),         2.0, 0.6));
        STATS.put('C', new StatLettre(set("atkspeed","atk"),    2.0, 0.6));
        STATS.put('M', new StatLettre(set("pdv"),               2.5, 0.6)); // tank pur : pdv x2.5
        STATS.put('P', new StatLettre(set("atk","range"),       2.0, 0.6));
        STATS.put('G', new StatLettre(set("pdv","atkspeed"),    2.0, 0.6));
        STATS.put('B', new StatLettre(set("pdv","atk"),         2.0, 0.6));
        STATS.put('V', new StatLettre(set("atkspeed","range"),  2.0, 0.6));
        STATS.put('F', new StatLettre(set("atk","atkspeed"),    2.0, 0.6));

        // --- RARES (fort=3.0, faible=0.3) ---
        STATS.put('H', new StatLettre(set("range","pdv"),       3.0, 0.3));
        STATS.put('J', new StatLettre(set("atk"),               4.0, 0.3)); // berserker : atk x4
        STATS.put('K', new StatLettre(set("atkspeed"),          4.0, 0.3)); // mitrailleuse : atkspeed x4
        STATS.put('W', new StatLettre(set("pdv","range"),       3.0, 0.3));
        STATS.put('X', new StatLettre(set("atk","range"),       3.0, 0.3));
        STATS.put('Y', new StatLettre(set("atkspeed","pdv"),    3.0, 0.3));
        STATS.put('Z', new StatLettre(set("atk","atkspeed"),    3.0, 0.3));
        STATS.put('Q', new StatLettre(set("range","atk"),       3.0, 0.3));

        // --- Pool de tirage : 4x chaque COMMUN, 1x chaque RARE ---
        for (char c : new char[]{'A','E','I','S','N','R','T','O','U','L','D','C','M','P','G','B','V','F'}) {
            for (int i = 0; i < 4; i++) POOL.add(c);
        }
        for (char c : new char[]{'H','J','K','W','X','Y','Z','Q'}) {
            POOL.add(c);
        }
    }

    private static Set<String> set(String... stats) {
        Set<String> s = new HashSet<>();
        Collections.addAll(s, stats);
        return s;
    }

    /** Tire une LettreTour aléatoire (lettre + élément). */
    public static LettreTour create() {
        char lettre    = POOL.get(RANDOM.nextInt(POOL.size()));
        Element element = ELEMS[RANDOM.nextInt(4)];
        RareteLettre rarete = RARES.contains(lettre) ? RareteLettre.RARE : RareteLettre.COMMUN;
        return new LettreTour(lettre, element, rarete, STATS.get(lettre));
    }
}
