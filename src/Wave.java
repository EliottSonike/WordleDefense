import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

public class Wave {

    private final int waveNumber;
    private final List<EnemySpawn> enemySpawns;
    public double currentTime;
    private boolean completed;
    public final LinkedList<Monstres> activeMonsters;
    private final Carte carte;

    private static class EnemySpawn {
        double spawnTime;
        String enemyType;
        EnemySpawn(double spawnTime, String enemyType) {
            this.spawnTime = spawnTime;
            this.enemyType = enemyType;
        }
    }

    public Wave(int waveNumber, Carte carte) {
        this.waveNumber    = waveNumber;
        this.carte         = carte;
        this.enemySpawns   = new ArrayList<>();
        this.currentTime   = 0;
        this.completed     = false;
        this.activeMonsters = new LinkedList<>();
    }

    public void addEnemySpawn(double spawnTime, String enemyType) {
        if (spawnTime < 0) throw new IllegalArgumentException("spawnTime doit être positif.");
        enemySpawns.add(new EnemySpawn(spawnTime, enemyType));
    }

    public void loadFromData(List<String> waveData) {
        for (String line : waveData) {
            String[] parts = line.split("\\|");
            if (parts.length != 2) throw new IllegalArgumentException("Format invalide : " + line);
            addEnemySpawn(Double.parseDouble(parts[0].trim()), parts[1].trim());
        }
    }

    public List<Monstres> update(double deltaTime) {
        currentTime += deltaTime;
        List<Monstres> spawned = new ArrayList<>();

        enemySpawns.removeIf(spawn -> {
            if (spawn.spawnTime <= currentTime) {
                Monstres enemy = createEnemy(spawn.enemyType);
                if (enemy != null) {
                    Point2D spawnPos = carte.getSpawn();
                    if (spawnPos == null) return false;
                    enemy.setPosition(spawnPos);
                    enemy.setChemin(new LinkedList<>(carte.getChemin()));
                    activeMonsters.add(enemy);
                    spawned.add(enemy);
                }
                return true;
            }
            return false;
        });

        if (enemySpawns.isEmpty() && activeMonsters.stream().allMatch(m -> !m.isAlive())) {
            completed = true;
        }

        return spawned;
    }

    public boolean isCompleted() { return completed; }

    private Monstres createEnemy(String type) {
        switch (type) {
            case "Minion":         return new Minion(carte);
            case "Earth Brute":   return new EarthBrute(carte);
            case "Water Brute":   return new WaterBrute(carte);
            case "Fire Grognard": return new FireGrognard(carte);
            case "Wind Grognard": return new WindGrognard(carte);
            case "Boss":          return new Boss(carte);
            default:
                System.err.println("Type d'ennemi inconnu : " + type);
                return null;
        }
    }

    public void resetWave() {
        currentTime = 0;
        completed   = false;
        activeMonsters.clear();
    }

    public LinkedList<Monstres> getActiveMonsters() { return activeMonsters; }
    public int getWaveNumber()                       { return waveNumber; }
    public int getMonstersCount()                    { return activeMonsters.size(); }

    public boolean waveComplete() {
        return activeMonsters.stream()
            .filter(m -> m != null && m.position != null)
            .allMatch(m -> {
                Case c = carte.caseSelonCoordonees(m.position);
                return c != null && c.getType() == TypesCases.Base;
            });
    }

    public void setActiveMonsters(List<Monstres> monstres) {
        if (monstres == null) throw new IllegalArgumentException("Liste null.");
        activeMonsters.clear();
        activeMonsters.addAll(monstres);
    }
}
