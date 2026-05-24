public class Minion extends Monstres {

    public Minion(Carte map) {
        this.name     = "Minion";
        this.pdv      = 10;
        this.atk      = 3;
        this.atkspeed = 0;
        this.range    = 0;
        this.elem     = Element.NEUTRE;
        this.speed    = 1;
        this.reward   = 1;
        this.map      = map;
    }
}
