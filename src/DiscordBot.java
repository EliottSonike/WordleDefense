import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.entities.channel.middleman.MessageChannel;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.requests.GatewayIntent;
import net.dv8tion.jda.api.utils.FileUpload;

import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class DiscordBot extends ListenerAdapter {

    // Période d'un tick interne (ms) — 20 ticks/sec → monstre Minion (speed=1) traverse la
    // carte 10×10 (700px, 29 cases de 70px) en environ 100 secondes.
    private static final int    TICK_MS       = 50;
    // Intervalle d'envoi de l'image sur Discord (sec)
    private static final int    RENDER_SEC    = 5;
    private static final double TICK_DT       = TICK_MS / 1000.0;

    private final Map<Long, GameSession>            sessions  = new ConcurrentHashMap<>();
    private final Map<Long, List<ScheduledFuture<?>>> futures = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // -------------------------------------------------------------------------

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        try (InputStream in = new FileInputStream("config.properties")) {
            props.load(in);
        }
        String token = props.getProperty("discord.token", "").trim();
        if (token.isEmpty() || token.startsWith("VOTRE_TOKEN")) {
            System.err.println("ERREUR : renseignez discord.token dans config.properties");
            System.exit(1);
        }

        JDA jda = JDABuilder.createDefault(token)
                .enableIntents(GatewayIntent.MESSAGE_CONTENT, GatewayIntent.GUILD_MESSAGES)
                .addEventListeners(new DiscordBot())
                .build();
        jda.awaitReady();
        System.out.println("Bot connecté : " + jda.getSelfUser().getAsTag());
    }

    // -------------------------------------------------------------------------

    @Override
    public void onMessageReceived(MessageReceivedEvent event) {
        if (event.getAuthor().isBot()) return;
        String raw = event.getMessage().getContentRaw().trim();
        if (!raw.startsWith("!td")) return;

        String[] parts = raw.split("\\s+", 3);
        String cmd = parts.length > 1 ? parts[1].toLowerCase() : "aide";
        String arg = parts.length > 2 ? parts[2].trim() : "";

        MessageChannel channel = event.getChannel();
        long cid = channel.getIdLong();

        switch (cmd) {
            case "aide":      cmdAide(channel);              break;
            case "commencer": cmdCommencer(channel, cid, arg); break;
            case "carte":     cmdCarte(channel, cid);        break;
            case "invoque":   cmdInvoque(channel, cid);      break;
            case "poser":     cmdPoser(channel, cid, arg);   break;
            case "bonus":     cmdBonus(channel, cid, arg);   break;
            case "info":      cmdInfo(channel, cid);         break;
            case "vague":     cmdVague(channel, cid);        break;
            case "stop":      cmdStop(channel, cid);         break;
            default:
                channel.sendMessage("Commande inconnue. Tapez `!td aide`.").queue();
        }
    }

    // -------------------------------------------------------------------------
    // Commandes

    private void cmdAide(MessageChannel channel) {
        channel.sendMessage(
            "**Tower Defense Bot — Commandes**\n" +
            "`!td commencer [1|2|3]` — Nouvelle partie (niveau 1 par défaut)\n" +
            "`!td invoque` — Tirer une lettre-tour aléatoire (coût : 10 💰)\n" +
            "`!td info` — Inventaire, or, PV, phase en cours\n" +
            "`!td poser <idx> <case>` — Poser la lettre nº<idx> sur la case nº<case>\n" +
            "`!td vague` — Lancer la prochaine vague\n" +
            "`!td carte` — Afficher la carte maintenant\n" +
            "`!td bonus <NOM>` — Activer un bonus (max 3 actifs)\n" +
            "  Bonus : `CONSONNES` `VOYELLES` `FEU` `EAU` `TERRE` `VENT` `RARES` `ATK_GLOBAL`\n" +
            "`!td stop` — Abandonner la partie\n\n" +
            "La carte se met à jour automatiquement toutes les " + RENDER_SEC + " secondes."
        ).queue();
    }

    private void cmdCommencer(MessageChannel channel, long cid, String arg) {
        stopSession(cid);
        String levelFile;
        if (arg.equals("2") || arg.equals("level2"))      levelFile = "resources/levels/level2.lvl";
        else if (arg.equals("3") || arg.equals("level3")) levelFile = "resources/levels/level3.lvl";
        else                                               levelFile = "resources/levels/level1.lvl";

        try {
            GameSession session = new GameSession(levelFile);
            sessions.put(cid, session);

            // Boucle de ticks
            ScheduledFuture<?> tickF = scheduler.scheduleAtFixedRate(() -> {
                try { session.tick(TICK_DT); }
                catch (Exception e) { e.printStackTrace(); }
            }, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);

            // Boucle de rendu
            ScheduledFuture<?> renderF = scheduler.scheduleAtFixedRate(
                () -> autoRender(channel, session, cid),
                RENDER_SEC, RENDER_SEC, TimeUnit.SECONDS
            );

            futures.put(cid, Arrays.asList(tickF, renderF));

            byte[] png = session.renderPNG();
            channel.sendFiles(FileUpload.fromData(png, "carte.png"))
                   .setContent("**Partie lancée !** " + session.getStatus() + "\nOr de départ : " + session.getPlayer().getMoney())
                   .queue();

        } catch (IOException e) {
            channel.sendMessage("Erreur de chargement du niveau : " + e.getMessage()).queue();
        }
    }

    private void autoRender(MessageChannel channel, GameSession session, long cid) {
        try {
            if (session.getPhase() == GameSession.Phase.OVER) {
                byte[] png = session.renderPNG();
                channel.sendFiles(FileUpload.fromData(png, "carte.png"))
                       .setContent("**" + session.getStatus() + "**")
                       .queue();
                stopSession(cid);
                return;
            }
            byte[] png = session.renderPNG();
            channel.sendFiles(FileUpload.fromData(png, "carte.png"))
                   .setContent(session.getStatus())
                   .queue();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void cmdCarte(MessageChannel channel, long cid) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours. `!td commencer`").queue(); return; }
        try {
            byte[] png = session.renderPNG();
            channel.sendFiles(FileUpload.fromData(png, "carte.png"))
                   .setContent(session.getStatus())
                   .queue();
        } catch (IOException e) {
            channel.sendMessage("Erreur de rendu : " + e.getMessage()).queue();
        }
    }

    private void cmdInvoque(MessageChannel channel, long cid) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours.").queue(); return; }
        LettreTour lt = session.invoquer();
        if (lt == null) {
            channel.sendMessage("Pas assez d'or ! (coût : 10, vous avez : " + session.getPlayer().getMoney() + ")").queue();
        } else {
            String rarete = lt.getRarete() == RareteLettre.RARE ? " ★ RARE" : "";
            channel.sendMessage(String.format(
                "Vous obtenez **[%c]**%s — Élément : %s | Or restant : %d\n%s",
                lt.getLettre(), rarete, lt.getElement(), session.getPlayer().getMoney(),
                buildInventaireStr(session)
            )).queue();
        }
    }

    private void cmdPoser(MessageChannel channel, long cid, String arg) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours.").queue(); return; }
        String[] parts = arg.split("\\s+");
        if (parts.length < 2) {
            channel.sendMessage("Syntaxe : `!td poser <idx_inventaire> <idx_case>`\nEx : `!td poser 0 3`\nConsultez `!td info` pour voir les indices.").queue();
            return;
        }
        try {
            int invIdx  = Integer.parseInt(parts[0]);
            int caseIdx = Integer.parseInt(parts[1]);
            String result = session.placerTour(invIdx, caseIdx);
            channel.sendMessage(result).queue();
        } catch (NumberFormatException e) {
            channel.sendMessage("Les indices doivent être des nombres entiers.").queue();
        }
    }

    private void cmdBonus(MessageChannel channel, long cid, String arg) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours.").queue(); return; }
        try {
            BonusType bt = BonusType.valueOf("BOOST_" + arg.toUpperCase().replace("-", "_"));
            boolean ok = session.activerBonus(bt);
            if (ok) channel.sendMessage("Bonus **" + bt.name() + "** activé ! Actifs : " + session.getBm().getActifs()).queue();
            else    channel.sendMessage("Bonus déjà actif ou maximum (3) atteint.").queue();
        } catch (IllegalArgumentException e) {
            channel.sendMessage(
                "Bonus inconnu : `" + arg + "`\n" +
                "Valides : `CONSONNES` `VOYELLES` `FEU` `EAU` `TERRE` `VENT` `RARES` `ATK_GLOBAL`"
            ).queue();
        }
    }

    private void cmdInfo(MessageChannel channel, long cid) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours.").queue(); return; }
        Player p = session.getPlayer();
        StringBuilder sb = new StringBuilder();
        sb.append("**État de la partie**\n");
        sb.append(String.format("❤ PV : **%d/100** | 💰 Or : **%d**\n", p.getPdv(), p.getMoney()));
        sb.append(String.format("Vague : **%d/%d** | Phase : **%s**\n", session.getWaveIdx() + 1, session.getTotalWaves(), session.getPhase()));
        sb.append("Bonus actifs : ").append(session.getBm().getActifs()).append("\n");
        sb.append("Monstres actifs : ").append(session.getActiveMonstres().size()).append("\n\n");
        sb.append(buildInventaireStr(session)).append("\n");
        int nbCases = session.getCarte().getCasesConstructibles().size();
        sb.append("\nCases constructibles libres : **").append(nbCases).append("**");
        sb.append(" (les numéros sont affichés en jaune sur la carte)");
        channel.sendMessage(sb.toString()).queue();
    }

    private void cmdVague(MessageChannel channel, long cid) {
        GameSession session = sessions.get(cid);
        if (session == null) { channel.sendMessage("Aucune partie en cours.").queue(); return; }
        if (session.getPhase() == GameSession.Phase.WAVE) {
            channel.sendMessage("Une vague est déjà en cours !").queue(); return;
        }
        if (session.getPhase() == GameSession.Phase.OVER) {
            channel.sendMessage(session.getStatus()).queue(); return;
        }
        session.startWave();
        channel.sendMessage("**Vague " + (session.getWaveIdx() + 1) + " lancée !** Défendez la base !").queue();
    }

    private void cmdStop(MessageChannel channel, long cid) {
        stopSession(cid);
        channel.sendMessage("Partie abandonnée.").queue();
    }

    // -------------------------------------------------------------------------
    // Utilitaires

    private void stopSession(long cid) {
        List<ScheduledFuture<?>> fs = futures.remove(cid);
        if (fs != null) fs.forEach(f -> f.cancel(false));
        sessions.remove(cid);
    }

    private String buildInventaireStr(GameSession session) {
        List<LettreTour> inv = session.getInventaire();
        if (inv.isEmpty()) return "**Inventaire :** (vide)";
        StringBuilder sb = new StringBuilder("**Inventaire :** ");
        for (int i = 0; i < inv.size(); i++) {
            LettreTour lt = inv.get(i);
            sb.append(i).append(":[").append(lt.getLettre()).append("]");
            if (lt.getRarete() == RareteLettre.RARE) sb.append("★");
            sb.append("(").append(lt.getElement()).append(") ");
        }
        return sb.toString().trim();
    }
}
