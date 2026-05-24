import java.util.LinkedList;

public class Monstres extends Entites {

    protected Carte  map;
    protected double speed;
    protected int    reward;
    protected boolean enChemin = true;
    protected LinkedList<Case> chemin;
    protected int currentCaseIndex;

    public double burnDamagePerSec  = 0.0;
    public double burnTimeRemaining = 0.0;
    public double slowFactor        = 1.0;
    public double slowTimeRemaining = 0.0;
    public double armorReduction    = 1.0;
    public double armorTimeRemaining= 0.0;
    public int    recoilCases       = 0;
    public double initialPdv        = 1.0;

    public Monstres() {
        this.chemin = new LinkedList<>();
        this.currentCaseIndex = 0;
    }

    public LinkedList<Case> getChemin() { return chemin; }

    public void update(double deltaTimeSec, Player player) {
        Point2D pos = this.position;
        double dist = this.speed * slowFactor;

        while (dist > 0 && !chemin.isEmpty()) {
            Case   next      = chemin.peek();
            Point2D nextPos  = next.getCentre();
            double  toNext   = pos.distance(nextPos);

            if (dist >= toNext) {
                dist -= toNext;
                pos   = nextPos;
                chemin.poll();
                if (next.getType() == TypesCases.Base) {
                    player.setPdv(player.getPdv() - (int) this.atk);
                    this.enChemin = false;
                    this.position = pos;
                    return;
                }
            } else {
                double ratio = dist / toNext;
                pos = new Point2D(
                    pos.getX() + ratio * (nextPos.getX() - pos.getX()),
                    pos.getY() + ratio * (nextPos.getY() - pos.getY())
                );
                dist = 0;
            }
        }
        this.position = pos;

        if (burnTimeRemaining > 0) {
            pdv -= burnDamagePerSec * deltaTimeSec;
            burnTimeRemaining -= deltaTimeSec;
            if (burnTimeRemaining <= 0) { burnTimeRemaining = 0; burnDamagePerSec = 0; }
            if (pdv < 0) pdv = 0;
        }
        if (slowTimeRemaining > 0) {
            slowTimeRemaining -= deltaTimeSec;
            if (slowTimeRemaining <= 0) { slowTimeRemaining = 0; slowFactor = 1.0; }
        }
        if (armorTimeRemaining > 0) {
            armorTimeRemaining -= deltaTimeSec;
            if (armorTimeRemaining <= 0) { armorTimeRemaining = 0; armorReduction = 1.0; }
        }
        if (recoilCases > 0) {
            applyRecoil(recoilCases);
            recoilCases = 0;
        }
    }

    private void applyRecoil(int cases) {
        if (map == null || chemin.isEmpty()) return;
        LinkedList<Case> fullPath = map.getChemin();
        Case first = chemin.peek();
        int idx = fullPath.indexOf(first);
        if (idx <= 0) return;
        int start = Math.max(0, idx - cases);
        for (int i = idx - 1; i >= start; i--) chemin.addFirst(fullPath.get(i));
    }

    public boolean isAlive()     { return pdv > 0; }
    public boolean isEnChemin()  { return enChemin; }
    public Carte   getMap()      { return map; }

    public void setChemin(LinkedList<Case> chemin) {
        if (chemin == null || chemin.isEmpty()) {
            System.err.println("Chemin vide pour " + name);
            return;
        }
        this.chemin = chemin;
        this.currentCaseIndex = 0;
        this.position = chemin.get(0).getCentre();
        this.initialPdv = this.pdv;
    }

    public void onDeath(Player player) {
        if (isAlive()) return;
        player.recompense(this);
    }

    public void render() {}
}
