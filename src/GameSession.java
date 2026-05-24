import java.io.*;
import java.util.*;

public class GameSession {

    public enum Phase { BUILD, WAVE, OVER }

    private final Carte carte;
    private final List<Wave> waves = new ArrayList<>();
    private int waveIdx = 0;
    private final Player player;
    private final BonusManager bm = new BonusManager();
    private final List<Monstres> activeMonstres = new ArrayList<>();
    private final List<LettreTour> inventaire = new ArrayList<>();
    private Phase phase = Phase.BUILD;
    private String statusMsg = "Prêt — invoquez des tours puis tapez `!td vague` pour lancer la 1ère vague.";

    private final IdentityHashMap<Tours, Double> atkCooldowns = new IdentityHashMap<>();

    public GameSession(String levelFile) throws IOException {
        try (BufferedReader br = new BufferedReader(new FileReader(levelFile))) {
            String mapLine = br.readLine().trim();
            this.carte = new Carte("resources/maps/" + mapLine + ".mtp");
            String waveLine;
            while ((waveLine = br.readLine()) != null) {
                waveLine = waveLine.trim();
                if (waveLine.isEmpty()) continue;
                Wave w = new Wave(waves.size() + 1, carte);
                loadWave("resources/waves/" + waveLine + ".wve", w);
                waves.add(w);
            }
        }
        this.player = new Player();
        player.ajouterArgent(50); // 100 or total pour commencer
    }

    private void loadWave(String path, Wave w) throws IOException {
        List<String> data = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(path))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (!line.trim().isEmpty()) data.add(line.trim());
            }
        }
        w.loadFromData(data);
    }

    public synchronized void startWave() {
        if (phase == Phase.OVER || phase == Phase.WAVE) return;
        if (waveIdx < waves.size()) {
            phase = Phase.WAVE;
            statusMsg = "Vague " + (waveIdx + 1) + "/" + waves.size() + " en cours !";
        }
    }

    public synchronized void tick(double dt) {
        if (phase == Phase.OVER || phase == Phase.BUILD) return;

        // 1. Mettre à jour les monstres existants
        for (Monstres m : new ArrayList<>(activeMonstres)) {
            m.update(dt, player);
        }

        // 2. Retirer les morts et ceux qui ont atteint la base
        activeMonstres.removeIf(m -> {
            if (!m.isAlive())    { m.onDeath(player); return true; }
            if (!m.isEnChemin()) { m.setPdv(0); return true; }
            return false;
        });

        // 3. Attaques des tours
        int tileSize = carte.getTailleCase();
        for (Tours t : carte.getTowers()) {
            if (t.getPosition() == null) continue;
            Double cd = atkCooldowns.get(t);
            if (cd != null && cd > 0) { atkCooldowns.put(t, cd - dt); continue; }

            LettreTour lt     = (t instanceof LettreTour) ? (LettreTour) t : null;
            double range      = (lt != null ? lt.getStatEffective("range", bm) : t.getRange()) * tileSize;
            double atk        = lt != null ? lt.getStatEffective("atk", bm) : t.getAtk();
            double atkspd     = lt != null ? lt.getStatEffective("atkspeed", bm) : t.getAtkspeed();
            if (atkspd <= 0) continue;

            Monstres target = closestInRange(t.getPosition(), range);
            if (target != null) {
                target.setPdv(target.getPdv() - atk * target.armorReduction);
                if (lt != null) lt.appliquerEffetElement(target, bm);
                atkCooldowns.put(t, 1.0 / atkspd);
                if (!target.isAlive()) {
                    target.onDeath(player);
                    activeMonstres.remove(target);
                }
            }
        }

        // 4. Spawn depuis la vague courante
        if (waveIdx < waves.size()) {
            Wave current = waves.get(waveIdx);
            activeMonstres.addAll(current.update(dt));

            if (current.isCompleted() && activeMonstres.isEmpty()) {
                waveIdx++;
                if (waveIdx >= waves.size()) {
                    phase = Phase.OVER;
                    statusMsg = "VICTOIRE ! Toutes les vagues ont été repoussées !";
                } else {
                    phase = Phase.BUILD;
                    statusMsg = "Vague " + waveIdx + " terminée ! Tapez `!td vague` pour lancer la vague " + (waveIdx + 1) + ".";
                }
                return;
            }
        }

        // 5. Vérification défaite
        if (player.aPerdu()) {
            phase = Phase.OVER;
            statusMsg = "DÉFAITE ! Les ennemis ont atteint la base.";
        }
    }

    private Monstres closestInRange(Point2D pos, double range) {
        Monstres closest = null;
        double minDist = Double.MAX_VALUE;
        for (Monstres m : activeMonstres) {
            if (!m.isAlive() || !m.isEnChemin() || m.getPosition() == null) continue;
            double dx = m.getPosition().getX() - pos.getX();
            double dy = m.getPosition().getY() - pos.getY();
            double dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= range && dist < minDist) { minDist = dist; closest = m; }
        }
        return closest;
    }

    public synchronized LettreTour invoquer() {
        if (player.getMoney() < 10) return null;
        player.reduireArgent(10);
        LettreTour lt = LettreTourFactory.create();
        inventaire.add(lt);
        return lt;
    }

    public synchronized String placerTour(int invIdx, int caseIdx) {
        if (invIdx < 0 || invIdx >= inventaire.size())
            return "Index d'inventaire invalide (vous avez " + inventaire.size() + " lettre(s)).";
        LinkedList<Case> cs = carte.getCasesConstructibles();
        if (caseIdx < 0 || caseIdx >= cs.size())
            return "Index de case invalide (il y a " + cs.size() + " case(s) disponible(s)).";
        LettreTour lt = inventaire.remove(invIdx);
        Case c = cs.get(caseIdx);
        lt.setPosition(c.getCentre());
        carte.addTower(lt);
        carte.retirerCaseConstructible(c);
        return String.format("Tour [%c] (%s, %s) placée en case #%d.", lt.getLettre(), lt.getElement(), lt.getRarete(), caseIdx);
    }

    public synchronized boolean activerBonus(BonusType type) {
        return bm.activer(type);
    }

    public synchronized byte[] renderPNG() throws IOException {
        return GameRenderer.render(carte, activeMonstres, player, waveIdx + 1, bm);
    }

    // Getters
    public synchronized Player       getPlayer()        { return player; }
    public synchronized BonusManager getBm()            { return bm; }
    public synchronized List<LettreTour> getInventaire(){ return new ArrayList<>(inventaire); }
    public synchronized int          getWaveIdx()       { return waveIdx; }
    public synchronized int          getTotalWaves()    { return waves.size(); }
    public synchronized Phase        getPhase()         { return phase; }
    public synchronized String       getStatus()        { return statusMsg; }
    public synchronized List<Monstres> getActiveMonstres() { return new ArrayList<>(activeMonstres); }
    public Carte getCarte()                             { return carte; }
}
