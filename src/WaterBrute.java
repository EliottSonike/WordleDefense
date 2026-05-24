public class WaterBrute extends Monstres {

    public WaterBrute(Carte map) {
        this.name     = "WaterBrute";
        this.pdv      = 30;
        this.atk      = 5;
        this.atkspeed = 1;
        this.range    = 3;
        this.elem     = Element.EAU;
        this.speed    = 1;
        this.reward   = 3;
        this.map      = map;
    }
}
