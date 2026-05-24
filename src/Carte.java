import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedList;

public class Carte extends ZoneCarte {

    private final String fichier;
    private final int tailleCase;
    private final ArrayList<ArrayList<Case>> grille;
    private final LinkedList<Case> casesConstructibles;
    private final LinkedList<Case> chemin;
    private final LinkedList<Tours> tours;

    private final double largeur = 350.0;
    private final double hauteur = 350.0;
    private final Point2D mapCenter = new Point2D(largeur, hauteur);

    public Carte(String fichier) throws IOException {
        this.fichier   = fichier;
        this.tailleCase = calculerTailleCases(fichier);
        this.grille    = chargerGrille();
        this.casesConstructibles = initCasesConstructibles();
        this.chemin    = initChemin();
        this.tours     = new LinkedList<>();
    }

    private ArrayList<ArrayList<Case>> chargerGrille() throws IOException {
        ArrayList<ArrayList<Case>> g = new ArrayList<>();
        int y = 0;
        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(fichier))) {
            String ligne;
            while ((ligne = reader.readLine()) != null) {
                ArrayList<Case> row = new ArrayList<>();
                int x = 0;
                for (char c : ligne.toCharArray()) {
                    double offsetX = x * tailleCase - (ligne.length() * tailleCase) / 2.0 + 35.0;
                    double offsetY = y * tailleCase - (ligne.length() * tailleCase) / 2.0 + 35.0;
                    Point2D centre = new Point2D(mapCenter.getX() + offsetX, mapCenter.getY() - offsetY);
                    row.add(new Case(typeCase(c), tailleCase, centre));
                    x++;
                }
                g.add(row);
                y++;
            }
        }
        return g;
    }

    private TypesCases typeCase(char c) {
        switch (c) {
            case 'S': return TypesCases.Spawn;
            case 'B': return TypesCases.Base;
            case 'R': return TypesCases.Route;
            case 'C': return TypesCases.Constructible;
            default:  return TypesCases.Non_Constructible;
        }
    }

    // --- Chemin ---

    public LinkedList<Case> initChemin() {
        LinkedList<Case> path = new LinkedList<>();
        Case courant = getCaseSpawn();
        path.add(courant);
        while (!path.contains(getCaseBase())) {
            courant = prochaineCase(courant, path);
            if (courant == null) break;
            path.add(courant);
        }
        return path;
    }

    private Case prochaineCase(Case c, LinkedList<Case> visitees) {
        Point2D pos = positionDansLaCarte(c);
        if (pos == null) return null;
        int i = (int) pos.getX(), j = (int) pos.getY();
        Case[] voisins = {
            caseSelonIndices(i - 1, j), caseSelonIndices(i, j + 1),
            caseSelonIndices(i + 1, j), caseSelonIndices(i, j - 1)
        };
        for (Case v : voisins) {
            if (v != null && (v.getType() == TypesCases.Route || v.getType() == TypesCases.Base)
                    && !visitees.contains(v)) return v;
        }
        return null;
    }

    // --- Cases constructibles ---

    private LinkedList<Case> initCasesConstructibles() {
        LinkedList<Case> list = new LinkedList<>();
        for (ArrayList<Case> row : grille)
            for (Case c : row)
                if (c.getType() == TypesCases.Constructible) list.add(c);
        return list;
    }

    public void retirerCaseConstructible(Case c) {
        c.setLibreFalse();
        casesConstructibles.remove(c);
    }

    public void ajouterCaseConstructible(Case c) {
        c.setLibreTrue();
        casesConstructibles.add(c);
    }

    // --- Tours ---

    public void addTower(Tours t)   { tours.add(t); }
    public LinkedList<Tours> getTowers() { return tours; }

    // --- Lookup ---

    public Case caseSelonCoordonees(Point2D co) {
        for (ArrayList<Case> row : grille)
            for (Case c : row)
                if (c.getCentre().equals(co)) return c;
        return null;
    }

    public Case caseSelonIndices(double i, double j) {
        int ri = (int) i, ci = (int) j;
        if (ri < 0 || ci < 0 || ri >= grille.size() || ci >= grille.get(ri).size()) return null;
        return grille.get(ri).get(ci);
    }

    public Point2D positionDansLaCarte(Case c) {
        for (int i = 0; i < grille.size(); i++) {
            int j = grille.get(i).indexOf(c);
            if (j >= 0) return new Point2D(i, j);
        }
        return null;
    }

    public Case getCaseConstructible(double x, double y) {
        for (Case c : casesConstructibles)
            if (c.contains(x, y)) return c;
        return null;
    }

    public Case getCaseSpawn() {
        for (ArrayList<Case> row : grille)
            for (Case c : row)
                if (c.getType() == TypesCases.Spawn) return c;
        return null;
    }

    public Case getCaseBase() {
        for (ArrayList<Case> row : grille)
            for (Case c : row)
                if (c.getType() == TypesCases.Base) return c;
        return null;
    }

    public Case getElement(int i, int j) { return grille.get(i).get(j); }

    // --- Getters ---

    public String getFichier()                        { return fichier; }
    public int getTailleCase()                        { return tailleCase; }
    public ArrayList<ArrayList<Case>> getGrille()    { return grille; }
    public LinkedList<Case> getChemin()              { return chemin; }
    public LinkedList<Case> getCasesConstructibles() { return casesConstructibles; }

    public Point2D getSpawn() {
        Case s = getCaseSpawn();
        return s != null ? s.getCentre() : new Point2D(-1, -1);
    }

    public Point2D getBase() {
        Case b = getCaseBase();
        return b != null ? b.getCentre() : new Point2D(-1, -1);
    }

    public Case getTile(double row, double col) { return caseSelonIndices(row, col); }

    public void placerTour(Tours t, Point2D xy) {
        Case c = caseSelonCoordonees(xy);
        if (c != null && casesConstructibles.contains(c)) {
            t.drawVisuel(c.getCentre(), c.getTaille() / 3.0);
            retirerCaseConstructible(c);
        }
    }
}
