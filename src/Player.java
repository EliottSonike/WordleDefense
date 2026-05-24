public class Player {

    private int pdv   = 100;
    private int money = 50;

    public boolean aPerdu()    { return pdv <= 0; }

    public void recompense(Monstres m) {
        if (m.estTué()) money += m.reward;
    }

    public void ajouterArgent(int montant) { money += montant; }
    public void reduireArgent(int montant) { if (montant <= money) money -= montant; }

    public int  getPdv()   { return pdv; }
    public void setPdv(int pdv) { this.pdv = Math.max(0, pdv); }
    public int  getMoney() { return money; }
}
