import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Renderer headless : dessine l'état du jeu sur une BufferedImage et
 * retourne les octets PNG. Remplace tout affichage StdDraw.
 *
 * Système de coordonnées d'origine (StdDraw) :
 *   - mapCenter = (350, 350), Y croît vers le haut
 * Conversion image (origine haut-gauche, Y croît vers le bas) :
 *   - pixelX = (int) coordX
 *   - pixelY = HUD_HEIGHT + (MAP_SIZE - (int) coordY)
 */
public class GameRenderer {

    private static final int MAP_SIZE   = 700;
    private static final int HUD_HEIGHT = 50;
    private static final int IMG_WIDTH  = MAP_SIZE;
    private static final int IMG_HEIGHT = MAP_SIZE + HUD_HEIGHT;

    // -------------------------------------------------------------------------

    public static byte[] render(Carte carte,
                                List<Monstres> monstres,
                                Player player,
                                int waveIndex,
                                BonusManager bm) throws java.io.IOException {

        BufferedImage image = new BufferedImage(IMG_WIDTH, IMG_HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        // Fond général
        g.setColor(new Color(40, 40, 40));
        g.fillRect(0, 0, IMG_WIDTH, IMG_HEIGHT);

        drawMap(g, carte);
        drawConstructibleIndices(g, carte);
        drawTowers(g, carte);

        for (Monstres m : monstres) {
            if (m.isAlive() && m.isEnChemin()) drawMonster(g, m);
        }

        drawHUD(g, player, waveIndex, bm);

        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "PNG", baos);
        return baos.toByteArray();
    }

    // -------------------------------------------------------------------------
    // Conversion coordonnées

    private static int toPixelX(double coordX) {
        return (int) coordX;
    }

    private static int toPixelY(double coordY) {
        return HUD_HEIGHT + (MAP_SIZE - (int) coordY);
    }

    // -------------------------------------------------------------------------
    // Grille

    private static void drawMap(Graphics2D g, Carte carte) {
        ArrayList<ArrayList<Case>> grid = carte.getGrille();
        int taille = carte.getTailleCase();
        int half   = taille / 2;

        for (ArrayList<Case> ligne : grid) {
            for (Case c : ligne) {
                int px = toPixelX(c.getCentre().getX());
                int py = toPixelY(c.getCentre().getY());

                g.setColor(couleurCase(c.getType()));
                g.fillRect(px - half, py - half, taille, taille);

                g.setColor(new Color(0, 0, 0, 180));
                g.drawRect(px - half, py - half, taille, taille);
            }
        }
    }

    private static Color couleurCase(TypesCases type) {
        switch (type) {
            case Spawn:            return new Color(230, 140, 30);
            case Base:             return new Color(200, 30, 30);
            case Route:            return new Color(194, 178, 127);
            case Constructible:    return new Color(160, 200, 160);
            case Non_Constructible:return new Color(20, 70, 20);
            default:               return Color.DARK_GRAY;
        }
    }

    // -------------------------------------------------------------------------
    // Indices des cases constructibles (aide au placement)

    private static void drawConstructibleIndices(Graphics2D g, Carte carte) {
        java.util.LinkedList<Case> cs = carte.getCasesConstructibles();
        g.setFont(new Font("SansSerif", Font.BOLD, 11));
        for (int i = 0; i < cs.size(); i++) {
            int px = toPixelX(cs.get(i).getCentre().getX());
            int py = toPixelY(cs.get(i).getCentre().getY());
            String label = String.valueOf(i);
            FontMetrics fm = g.getFontMetrics();
            int tx = px - fm.stringWidth(label) / 2;
            int ty = py + fm.getAscent() / 2 - 1;
            g.setColor(Color.BLACK);
            g.drawString(label, tx + 1, ty + 1);
            g.setColor(new Color(255, 230, 50));
            g.drawString(label, tx, ty);
        }
    }

    // -------------------------------------------------------------------------
    // Tours

    private static void drawTowers(Graphics2D g, Carte carte) {
        for (Tours t : carte.getTowers()) {
            if (t == null || t.getPosition() == null) continue;

            int px   = toPixelX(t.getPosition().getX());
            int py   = toPixelY(t.getPosition().getY());
            int size = 26;

            if (t instanceof LettreTour) {
                LettreTour lt = (LettreTour) t;

                // Fond couleur élément
                g.setColor(lt.getElement().getCouleur().darker());
                g.fillRect(px - size / 2, py - size / 2, size, size);

                // Bordure : dorée si RARE, noire sinon
                if (lt.getRarete() == RareteLettre.RARE) {
                    g.setColor(new Color(255, 215, 0));
                    g.setStroke(new BasicStroke(2.5f));
                } else {
                    g.setColor(Color.BLACK);
                    g.setStroke(new BasicStroke(1f));
                }
                g.drawRect(px - size / 2, py - size / 2, size, size);
                g.setStroke(new BasicStroke(1f));

                // Lettre centrée
                g.setFont(new Font("SansSerif", Font.BOLD, 14));
                g.setColor(Color.WHITE);
                FontMetrics fm = g.getFontMetrics();
                String s  = String.valueOf(lt.getLettre());
                int    tx = px - fm.stringWidth(s) / 2;
                int    ty = py + fm.getAscent() / 2 - 1;
                g.drawString(s, tx, ty);

            } else {
                // Fallback pour tours non-LettreTour
                g.setColor(t.getElem().getCouleur());
                g.fillRect(px - size / 2, py - size / 2, size, size);
                g.setColor(Color.BLACK);
                g.drawRect(px - size / 2, py - size / 2, size, size);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Monstres

    private static void drawMonster(Graphics2D g, Monstres m) {
        int px     = toPixelX(m.getPosition().getX());
        int py     = toPixelY(m.getPosition().getY());
        int radius = 8;

        // Cercle
        g.setColor(m.getElem().getCouleur());
        g.fillOval(px - radius, py - radius, radius * 2, radius * 2);
        g.setColor(Color.BLACK);
        g.drawOval(px - radius, py - radius, radius * 2, radius * 2);

        // Barre de vie
        int barW  = 16;
        int barH  = 3;
        int barX  = px - barW / 2;
        int barY  = py - radius - 5;
        double maxPdv = m.initialPdv > 0 ? m.initialPdv : 1.0;
        double ratio  = Math.max(0.0, Math.min(1.0, m.getPdv() / maxPdv));
        int    fillW  = (int)(barW * ratio);

        g.setColor(Color.DARK_GRAY);
        g.fillRect(barX, barY, barW, barH);

        Color healthColor = ratio > 0.5 ? Color.GREEN : (ratio > 0.25 ? Color.YELLOW : Color.RED);
        g.setColor(healthColor);
        g.fillRect(barX, barY, fillW, barH);
    }

    // -------------------------------------------------------------------------
    // HUD

    private static void drawHUD(Graphics2D g, Player player, int waveIndex, BonusManager bm) {
        g.setColor(Color.BLACK);
        g.fillRect(0, 0, IMG_WIDTH, HUD_HEIGHT);

        g.setColor(Color.WHITE);
        g.setFont(new Font("SansSerif", Font.PLAIN, 13));

        StringBuilder sb = new StringBuilder();
        sb.append("PV: ").append(player.getPdv());
        sb.append("  |  Or: ").append(player.getMoney());
        sb.append("  |  Vague: ").append(waveIndex);

        List<BonusType> actifs = bm.getActifs();
        if (!actifs.isEmpty()) {
            sb.append("  |  Bonus: ");
            for (int i = 0; i < actifs.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append(actifs.get(i).name());
            }
        }

        g.drawString(sb.toString(), 8, HUD_HEIGHT - 14);
    }
}
