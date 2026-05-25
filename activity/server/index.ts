import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3001");

// Chemin racine du projet (activity/../)
const ROOT = path.resolve(__dirname, "..", "..");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// ── OAuth2 token exchange (requis par le Discord Embedded App SDK) ────────────
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
    res.json({ access_token: data.access_token });
  } catch (e) {
    console.error("Token exchange error:", e);
    res.status(500).json({ error: "token exchange failed" });
  }
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
