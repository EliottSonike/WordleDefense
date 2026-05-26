import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

// Charge le .env manuellement (tsx ne le fait pas automatiquement)
try {
  const envPath = path.join(__dirname, "..", ".env");
  const lines   = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch { /* pas de .env, on continue avec les vars système */ }

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3001");
const ROOT = path.resolve(__dirname, "..", "..");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "..", "client", "public")));

// ── Ticket storage (JSON par Discord user ID) ─────────────────────────────────

const TICKETS_FILE = path.join(__dirname, "data", "tickets.json");

function readTickets(): Record<string, number> {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return {};
    return JSON.parse(fs.readFileSync(TICKETS_FILE, "utf8")) as Record<string, number>;
  } catch { return {}; }
}

function saveTickets(data: Record<string, number>): void {
  fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

function getPlayerTickets(userId: string): number {
  const data = readTickets();
  return data[userId] ?? 30; // 30 tickets par défaut pour les nouveaux joueurs
}

function setPlayerTickets(userId: string, amount: number): void {
  const data = readTickets();
  data[userId] = Math.max(0, amount);
  saveTickets(data);
}

// ── OAuth2 token exchange ─────────────────────────────────────────────────────

app.post("/api/token", async (req, res) => {
  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "code manquant" }); return; }

  try {
    const r = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID    ?? "",
        client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
        grant_type:    "authorization_code",
        code
      })
    });
    const data = await r.json() as { access_token?: string; error?: string };
    if (data.error) throw new Error(data.error);

    // Récupérer le user ID Discord
    let userId = "";
    let username = "";
    try {
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      const user = await userRes.json() as { id?: string; username?: string };
      userId   = user.id ?? "";
      username = user.username ?? "";
    } catch { /* silently skip, userId restera vide */ }

    res.json({ access_token: data.access_token, user_id: userId, username });
  } catch (e) {
    console.error("Token exchange error:", e);
    res.status(500).json({ error: "token exchange failed" });
  }
});

// ── Ticket API ────────────────────────────────────────────────────────────────

// GET tickets du joueur
app.get("/api/tickets/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId) { res.status(400).json({ error: "userId manquant" }); return; }
  res.json({ tickets: getPlayerTickets(userId) });
});

// Client dépense des tickets (invocation)
app.post("/api/tickets/:userId/spend", (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body as { amount: number };
  if (!userId || typeof amount !== "number" || amount <= 0 || amount > 200) {
    res.status(400).json({ error: "paramètres invalides" }); return;
  }
  const current = getPlayerTickets(userId);
  if (current < amount) { res.status(400).json({ error: "tickets insuffisants" }); return; }
  setPlayerTickets(userId, current - amount);
  res.json({ tickets: current - amount });
});

// Client gagne des tickets (fin de partie)
app.post("/api/tickets/:userId/earn", (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body as { amount: number };
  if (!userId || typeof amount !== "number" || amount <= 0 || amount > 100) {
    res.status(400).json({ error: "paramètres invalides" }); return;
  }
  const current = getPlayerTickets(userId);
  const newTotal = current + amount;
  setPlayerTickets(userId, newTotal);
  res.json({ tickets: newTotal });
});

// Bot Wordle attribue des tickets (protégé par BOT_SECRET)
app.post("/api/tickets/award", (req, res) => {
  const { secret, userId, amount, reason } = req.body as {
    secret: string; userId: string; amount: number; reason?: string;
  };

  const botSecret = process.env.BOT_SECRET;
  if (!botSecret || secret !== botSecret) {
    res.status(403).json({ error: "secret invalide" }); return;
  }
  if (!userId || typeof amount !== "number" || amount <= 0 || amount > 500) {
    res.status(400).json({ error: "paramètres invalides" }); return;
  }

  const current  = getPlayerTickets(userId);
  const newTotal = current + amount;
  setPlayerTickets(userId, newTotal);
  console.log(`[tickets] +${amount} → ${userId} (${reason ?? "—"}) → total: ${newTotal}`);
  res.json({ ok: true, newTotal });
});

// ── Données de jeu ────────────────────────────────────────────────────────────

app.get("/api/level/:name", (req, res) => {
  const file = path.join(ROOT, "resources", "levels", req.params.name + ".lvl");
  if (!fs.existsSync(file)) { res.status(404).send("niveau introuvable"); return; }
  res.type("text").send(fs.readFileSync(file, "utf8"));
});

app.get("/api/map/:name", (req, res) => {
  const file = path.join(ROOT, "resources", "maps", req.params.name + ".mtp");
  if (!fs.existsSync(file)) { res.status(404).send("carte introuvable"); return; }
  res.type("text").send(fs.readFileSync(file, "utf8"));
});

app.get("/api/wave/:name", (req, res) => {
  const file = path.join(ROOT, "resources", "waves", req.params.name + ".wve");
  if (!fs.existsSync(file)) { res.status(404).send("vague introuvable"); return; }
  res.type("text").send(fs.readFileSync(file, "utf8"));
});

// ── Dictionnaire Scrabble (5 lettres) ────────────────────────────────────────

let WORDS5: Set<string> = new Set();
const WORDS_CACHE = path.join(__dirname, "data", "words5.json");

const SCRABBLE: Record<string, number> = {
  A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
  D:2,G:2,B:3,C:3,M:3,P:3,F:4,H:4,V:4,W:4,Y:4,
  K:5,J:8,X:8,Q:10,Z:10,
};
function scrabbleScore(w: string): number {
  return [...w.toUpperCase()].reduce((s, c) => s + (SCRABBLE[c] ?? 0), 0);
}

(async () => {
  try {
    if (fs.existsSync(WORDS_CACHE)) {
      WORDS5 = new Set(JSON.parse(fs.readFileSync(WORDS_CACHE, "utf8")) as string[]);
      console.log(`Word list: ${WORDS5.size} words (cache)`);
      return;
    }
    console.log("Fetching word list…");
    const r = await fetch("https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt");
    const words = (await r.text()).split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length === 5 && /^[A-Z]{5}$/.test(w));
    WORDS5 = new Set(words);
    fs.mkdirSync(path.dirname(WORDS_CACHE), { recursive: true });
    fs.writeFileSync(WORDS_CACHE, JSON.stringify([...WORDS5]));
    console.log(`Word list: ${WORDS5.size} words (fetched & cached)`);
  } catch (e) { console.warn("Word list unavailable:", e); }
})();

app.get("/api/check-word/:word", (req, res) => {
  const w = (req.params.word ?? "").toUpperCase();
  if (!/^[A-Z]{5}$/.test(w)) { res.json({ valid: false, score: 0 }); return; }
  const valid = WORDS5.has(w);
  res.json({ valid, score: valid ? scrabbleScore(w) : 0 });
});

// SPA fallback
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
