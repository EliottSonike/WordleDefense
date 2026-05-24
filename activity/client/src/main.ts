import { DiscordSDK } from "@discord/embedded-app-sdk";
import { GameSession, Phase } from "./game/GameSession";
import { BonusType, ALL_BONUS_TYPES } from "./game/BonusType";
import { getCouleur } from "./game/Element";
import { RareteLettre } from "./game/RareteLettre";
import { render, CANVAS_H } from "./game/Renderer";
import { creerLettreTour } from "./game/LettreTourFactory";
import type { LettreTour } from "./game/LettreTour";
import type { MapData } from "./game/types";
import { parseMap } from "./game/MapParser";

// ── Discord SDK ───────────────────────────────────────────────────────────────

const sdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID ?? "");

async function initDiscord(): Promise<void> {
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id:     import.meta.env.VITE_DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    state:         "",
    prompt:        "none",
    scope:         ["identify", "guilds"],
  });
  const res = await fetch("/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ code }),
  });
  const { access_token } = await res.json() as { access_token: string };
  await sdk.commands.authenticate({ access_token });
}

// ── Screen helpers ────────────────────────────────────────────────────────────

type Screen = "loading" | "menu" | "invocation" | "letterbox" | "game";

function showScreen(s: Screen): void {
  (["loading","menu","invocation","letterbox","game"] as Screen[]).forEach(id => {
    const el = document.getElementById(id === "loading" ? "screen-loading"
                                      : id === "game"    ? "game-container"
                                      : `screen-${id}`)!;
    el.classList.toggle("hidden", id !== s);
  });
}

// ── Elements DOM ──────────────────────────────────────────────────────────────

const canvas     = document.getElementById("game-canvas")    as HTMLCanvasElement;
const ctx        = canvas.getContext("2d")!;
const invDiv     = document.getElementById("inventaire")!;
const towersDiv  = document.getElementById("towers-list")!;
const bonusDiv   = document.getElementById("bonus-list")!;
const bonusSel   = document.getElementById("bonus-select")   as HTMLSelectElement;
const logDiv     = document.getElementById("log-entries")!;
const panelBuild = document.getElementById("panel-build")!;
const panelPlace = document.getElementById("panel-place")!;
const placingLbl = document.getElementById("placing-letter")!;

// ── Pre-game letter collection ────────────────────────────────────────────────

let preGameLetters: LettreTour[] = [];

function renderPreGameInv(): void {
  const list  = document.getElementById("inv-preGame-list")!;
  const count = document.getElementById("inv-count")!;
  count.textContent = `(${preGameLetters.length})`;
  list.innerHTML = "";
  for (const lt of preGameLetters) {
    const el = document.createElement("div");
    el.className = "inv-item";
    el.innerHTML = `
      <div class="badge" style="background:${getCouleur(lt.element)}">${lt.lettre}</div>
      <div class="info">${lt.rarete === RareteLettre.RARE ? "⭐ RARE" : "commun"}<br/>${lt.element}</div>`;
    list.appendChild(el);
  }
}

function renderLetterbox(): void {
  const list  = document.getElementById("letterbox-list")!;
  const empty = document.getElementById("letterbox-empty")!;
  list.innerHTML = "";
  if (preGameLetters.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  for (const lt of preGameLetters) {
    const el = document.createElement("div");
    el.className = "inv-item";
    el.innerHTML = `
      <div class="badge" style="background:${getCouleur(lt.element)}">${lt.lettre}</div>
      <div class="info">${lt.rarete === RareteLettre.RARE ? "⭐ RARE" : "commun"}<br/>${lt.element}</div>`;
    list.appendChild(el);
  }
}

// ── Game state ────────────────────────────────────────────────────────────────

let session: GameSession;
let placingIdx: number | null = null;
let mapData: MapData   = { grille: [], tailleCase: 70, chemin: [], constructibles: [], spawn: {x:0,y:0}, base: {x:700,y:700} };
let waveTexts: string[] = [];

function log(msg: string): void {
  const el = document.createElement("div");
  el.className = "log-entry";
  el.textContent = msg;
  logDiv.prepend(el);
  if (logDiv.children.length > 30) logDiv.lastElementChild?.remove();
}

function renderInventaire(inventaire: LettreTour[]): void {
  invDiv.innerHTML = "";
  inventaire.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = "inv-item" + (placingIdx === i ? " selected" : "");
    item.innerHTML = `
      <div class="badge" style="background:${getCouleur(t.element)}">${t.lettre}</div>
      <div class="info">${t.rarete === RareteLettre.RARE ? "⭐ RARE" : "commun"}<br/>${t.element}</div>`;
    item.addEventListener("click", () => startPlacing(i));
    invDiv.appendChild(item);
  });
}

function renderTours(tours: LettreTour[]): void {
  towersDiv.innerHTML = "";
  for (const t of tours) {
    const el = document.createElement("div");
    el.className = "tower-item";
    el.textContent = `${t.lettre} ${t.element} ${t.rarete === RareteLettre.RARE ? "★" : ""}`;
    towersDiv.appendChild(el);
  }
}

function refreshUI(): void {
  const state = session.getState();
  renderInventaire(state.inventaire);
  renderTours(state.tours);

  // Bonus chips
  bonusDiv.innerHTML = "";
  for (const b of state.bm.getActifs()) {
    const chip = document.createElement("span");
    chip.className = "bonus-chip";
    chip.textContent = `✕ ${b.replace("BOOST_", "")}`;
    chip.addEventListener("click", () => {
      session.desactiverBonus(b as BonusType);
      refreshUI();
    });
    bonusDiv.appendChild(chip);
  }

  const inBuild = state.phase === Phase.BUILD;
  document.getElementById("btn-invoke")!.toggleAttribute("disabled", !inBuild);
  document.getElementById("btn-launch")!.toggleAttribute("disabled", !inBuild);
}

// ── Placing flow ──────────────────────────────────────────────────────────────

function startPlacing(invIdx: number): void {
  const state = session.getState();
  if (state.phase !== Phase.BUILD) return;
  placingIdx = invIdx;
  const lt = state.inventaire[invIdx];
  placingLbl.textContent = `${lt.lettre} (${lt.element})`;
  panelBuild.classList.add("hidden");
  panelPlace.classList.remove("hidden");
  renderInventaire(state.inventaire);
}

function cancelPlacing(): void {
  placingIdx = null;
  panelPlace.classList.add("hidden");
  panelBuild.classList.remove("hidden");
  refreshUI();
}

canvas.addEventListener("click", (e) => {
  if (placingIdx === null) return;
  const rect    = canvas.getBoundingClientRect();
  const scaleX  = canvas.width  / rect.width;
  const scaleY  = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top)  * scaleY;

  const state = session.getState();
  const map   = state.map;
  const rows  = map.grille.length;
  const cols  = map.grille[0]?.length ?? 1;
  const ts    = map.tailleCase;
  const scale = Math.min(canvas.width / (cols * ts), canvas.width / (rows * ts));
  const minX  = 350 - (cols / 2) * ts;
  const maxY  = 350 + (rows / 2) * ts;
  const HUD_H = 50;

  const stdX = canvasX / scale + minX;
  const stdY = maxY - (canvasY - HUD_H) / scale;

  const cIdx = state.map.constructibles.findIndex(c =>
    c.libre && Math.abs(c.centre.x - stdX) <= c.taille / 2 && Math.abs(c.centre.y - stdY) <= c.taille / 2
  );
  if (cIdx === -1) return;

  const res = session.placerTour(placingIdx, cIdx);
  if (res === "ok") { log(`Tour placée sur case ${cIdx}`); cancelPlacing(); }
  else               log(`Erreur: ${res}`);
});

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = 0;
let loopRunning = false;

function loop(ts: number): void {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  session.tick(dt);
  render(ctx, session.getState());
  if (loopRunning) requestAnimationFrame(loop);
}

function startGame(startingLetters: LettreTour[]): void {
  session = new GameSession(mapData, waveTexts, startingLetters);

  const panelW = 220;
  const availW = Math.max(400, window.innerWidth - panelW - 2);
  canvas.width  = availW;
  canvas.height = CANVAS_H;
  canvas.style.width = availW + "px";

  showScreen("game");
  refreshUI();
  loopRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Bonus selector
  for (const b of ALL_BONUS_TYPES) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b.replace("BOOST_", "");
    bonusSel.appendChild(opt);
  }

  // In-game buttons
  document.getElementById("btn-invoke")!.addEventListener("click", () => {
    const lt = session.invoquer();
    if (lt) { log(`Invoqué: ${lt.lettre} ${lt.element}`); refreshUI(); }
    else      log("Pas assez d'argent (10$)");
  });
  document.getElementById("btn-launch")!.addEventListener("click", () => {
    const res = session.lancerVague();
    if (res === "ok") { log("Vague lancée !"); refreshUI(); }
    else log(res);
  });
  document.getElementById("btn-cancel-place")!.addEventListener("click", cancelPlacing);
  document.getElementById("btn-activate-bonus")!.addEventListener("click", () => {
    const val = bonusSel.value as BonusType;
    if (!val) return;
    const ok = session.activerBonus(val);
    if (ok) { log(`Bonus activé: ${val}`); refreshUI(); }
    else     log("Bonus déjà actif ou max 3 atteint");
  });

  // Menu buttons
  document.getElementById("btn-solo")!.addEventListener("click", () => startGame([]));
  document.getElementById("btn-go-invocation")!.addEventListener("click", () => {
    renderPreGameInv();
    showScreen("invocation");
  });
  document.getElementById("btn-back-invocation")!.addEventListener("click", () => showScreen("menu"));
  document.getElementById("btn-go-letterbox")!.addEventListener("click", () => {
    renderLetterbox();
    showScreen("letterbox");
  });
  document.getElementById("btn-back-letterbox")!.addEventListener("click", () => showScreen("menu"));

  // Invocation pre-game
  document.getElementById("btn-pull")!.addEventListener("click", () => {
    const lt = creerLettreTour();
    preGameLetters.push(lt);
    renderPreGameInv();
    const res = document.getElementById("pull-result")!;
    res.classList.remove("hidden");
    const star = lt.rarete === RareteLettre.RARE ? " ⭐ RARE" : "";
    res.textContent = `✦ ${lt.lettre} — ${lt.element}${star}`;
  });
  document.getElementById("btn-start-with-inv")!.addEventListener("click", () => startGame([...preGameLetters]));

  // Discord
  try { await initDiscord(); }
  catch (e) { console.warn("Discord SDK non disponible", e); }

  // Load level data (always level1 for now)
  const levelName = new URLSearchParams(window.location.search).get("level") ?? "level1";
  try {
    const lvlRes  = await fetch(`/api/level/${levelName}`);
    const lvlText = await lvlRes.text();
    const lines   = lvlText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const mapName   = lines[0];
    const waveNames = lines.slice(1);
    mapData   = await (async () => { const r = await fetch(`/api/map/${mapName}`); return parseMap(await r.text()); })();
    waveTexts = await Promise.all(waveNames.map(async (wn: string) => { const r = await fetch(`/api/wave/${wn}`); return r.text(); }));
  } catch (e) {
    console.error("Erreur chargement niveau:", e);
  }

  showScreen("menu");
}

main().catch(console.error);
