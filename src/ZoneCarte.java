import java.io.*;

public class ZoneCarte {

    public int calculerTailleCases(String nomFichier) throws IOException {
        int h = 0, w = 0;
        try (BufferedReader br = new BufferedReader(new FileReader(nomFichier))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (h == 0) w = line.length();
                h++;
            }
        }
        return 700 / Math.max(h, w);
    }
}
