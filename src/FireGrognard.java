public class FireGrognard extends Monstres {

    public FireGrognard(Carte map) {
        this.name     = "FireGrognard";
        this.pdv      = 1;
        this.atk      = 7;
        this.atkspeed = 2;
        this.range    = 3;
        this.elem     = Element.FEU;
        this.speed    = 2;
        this.reward   = 1;
        this.map      = map;
    }
}
