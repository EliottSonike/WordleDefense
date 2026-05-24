import java.awt.Color;
import java.awt.Font;

/**
 * Stub headless remplaçant la lib Princeton StdDraw.
 * Toutes les méthodes sont des no-ops pour permettre la compilation des
 * classes existantes (Tours, ZoneCarte, etc.) sans ouvrir de fenêtre Swing.
 * Le rendu réel est assuré par GameRenderer.
 */
public class StdDraw {

    // Fenêtre / échelle
    public static void setCanvasSize(int width, int height)    {}
    public static void setXscale(double min, double max)       {}
    public static void setYscale(double min, double max)       {}
    public static void enableDoubleBuffering()                 {}

    // Affichage / effacement
    public static void show()                                  {}
    public static void clear()                                 {}
    public static void clear(Color color)                      {}

    // Souris / clavier
    public static boolean isMousePressed()                     { return false; }
    public static double  mouseX()                             { return 0.0; }
    public static double  mouseY()                             { return 0.0; }
    public static boolean isKeyPressed(int keycode)            { return false; }

    // Stylo
    public static void setPenColor(Color color)                {}
    public static void setPenColor(int r, int g, int b)        {}
    public static void setPenRadius(double r)                  {}
    public static void setFont(Font font)                      {}

    // Formes remplies
    public static void filledSquare(double x, double y, double r)              {}
    public static void filledSquare(float  x, float  y, float  r)              {}
    public static void filledCircle(double x, double y, double r)              {}
    public static void filledCircle(float  x, float  y, float  r)              {}
    public static void filledRectangle(double x, double y, double rw, double rh) {}
    public static void filledPolygon(double[] xs, double[] ys)                 {}

    // Formes vides
    public static void square(double x, double y, double r)                    {}
    public static void circle(double x, double y, double r)                    {}
    public static void rectangle(double x, double y, double rw, double rh)     {}
    public static void polygon(double[] xs, double[] ys)                       {}
    public static void ellipse(double x, double y, double rw, double rh)       {}

    // Lignes / points
    public static void line(double x0, double y0, double x1, double y1)        {}
    public static void point(double x, double y)                               {}

    // Texte
    public static void text(double x, double y, String s)                      {}
    public static void text(double x, double y, String s, double degrees)      {}
    public static void textLeft(double x, double y, String s)                  {}
    public static void textRight(double x, double y, String s)                 {}

    // Image
    public static void picture(double x, double y, String filename)            {}
    public static void picture(double x, double y, String filename,
                               double degrees)                                 {}
    public static void picture(double x, double y, String filename,
                               double scaledWidth, double scaledHeight)        {}
}
