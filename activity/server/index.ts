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

// SPA fallback
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
