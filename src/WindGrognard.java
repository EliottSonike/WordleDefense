public class WindGrognard extends Monstres {

    public WindGrognard(Carte map) {
        this.name     = "WindGrognard";
        this.pdv      = 1;
        this.atk      = 7;
        this.atkspeed = 2;
        this.range    = 5;
        this.elem     = Element.VENT;
        this.speed    = 2;
        this.reward   = 1;
        this.map      = map;
    }
}
