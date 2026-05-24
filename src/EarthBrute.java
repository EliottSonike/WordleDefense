public class EarthBrute extends Monstres {

    public EarthBrute(Carte map) {
        this.name     = "EarthBrute";
        this.pdv      = 30;
        this.atk      = 5;
        this.atkspeed = 1;
        this.range    = 3;
        this.elem     = Element.TERRE;
        this.speed    = 1;
        this.reward   = 3;
        this.map      = map;
    }
}
