import { DiscordSDK } from "@discord/embedded-app-sdk";
import { GameSession, Phase } from "./game/GameSession";
import { BonusManager } from "./game/BonusManager";
import { BonusType, ALL_BONUS_TYPES } from "./game/BonusType";
import { getCouleur } from "./game/Element";
import { RareteLettre } from "./game/RareteLettre";
import { render, CANVAS_W, CANVAS_H } from "./game/Renderer";
import type { LettreTour } from "./game/LettreTour";
import type { MapData } from "./game/types";
import { parseMap } from "./game/MapParser";

// ── Discord SDK init ──────────────────────────────────────────────────────────

const sdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID ?? "");

async function initDiscord(): Promise<void> {
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    state:         "",
    prompt:        "none",
    scope:         ["identify", "guilds"],
  });

  const res   = await fetch("/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ code }),
  });
  const { access_token } = await res.json() as { access_token: string };
  await sdk.commands.authenticate({ access_token });
}

// ── Map loading ───────────────────────────────────────────────────────────────

async function loadMap(name: string): Promise<MapData> {
  const res  = await fetch(`/api/map/${name}`);
  const text = await res.text();
  return parseMap(text);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const canvas     = document.getElementById("game-canvas") as HTMLCanvasElement;
const ctx        = canvas.getContext("2d")!;
const loading    = document.getElementById("loading")!;
const gameDiv    = document.getElementById("game-container")!;

const invDiv     = document.getElementById("inventaire")!;
const towersDiv  = document.getElementById("towers-list")!;
const bonusDiv   = document.getElementById("bonus-list")!;
const bonusSel   = document.getElementById("bonus-select") as HTMLSelectElement;
const logDiv     = document.getElementById("log-entries")!;
const panelBuild = document.getElementById("panel-build")!;
const panelPlace = document.getElementById("panel-place")!;
const placingLbl = document.getElementById("placing-letter")!;

let session: GameSession;
let placingIdx: number | null = null;

function log(msg: string): void {
  const el = document.createElement("div");
  el.className = "log-entry";
  el.textContent = msg;
  logDiv.prepend(el);
  if (logDiv.children.length > 30) logDiv.lastElementChild?.remove();
}

function elementColor(t: LettreTour): string {
  return getCouleur(t.element);
}

function renderInventaire(inventaire: LettreTour[]): void {
  invDiv.innerHTML = "";
  inventaire.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = "inv-item" + (placingIdx === i ? " selected" : "");
    item.innerHTML = `
      <div class="badge" style="background:${elementColor(t)}">${t.lettre}</div>
      <div class="info">
        ${t.rarete === RareteLettre.RARE ? "⭐ RARE" : "commun"}<br/>
        ${t.element}
      </div>`;
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

function renderBonus(bm: BonusManager): void {
  bonusDiv.innerHTML = "";
  for (const b of bm.getActifs()) {
    const chip = document.createElement("span");
    chip.className = "bonus-chip";
    chip.textContent = `✕ ${b.replace("BOOST_", "")}`;
    chip.addEventListener("click", () => {
      session.desactiverBonus(b);
      refreshUI();
      log(`Bonus désactivé: ${b}`);
    });
    bonusDiv.appendChild(chip);
  }
}

function refreshUI(): void {
  const state = session.getState();
  renderInventaire(state.inventaire);
  renderTours(state.tours);
  renderBonus(state.bm);

  const inBuild = state.phase === Phase.BUILD;
  document.getElementById("btn-invoke")!.toggleAttribute("disabled", !inBuild);
  document.getElementById("btn-launch")!.toggleAttribute("disabled", state.phase !== Phase.BUILD);
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
  const HUD_H   = 50;
  const MAP_SIZE = 700;
  // Convert canvas pixels → StdDraw coords
  const stdX = canvasX;
  const stdY = MAP_SIZE - (canvasY - HUD_H);

  const state = session.getState();
  const cIdx  = state.map.constructibles.findIndex(c =>
    c.libre && Math.abs(c.centre.x - stdX) <= c.taille / 2 && Math.abs(c.centre.y - stdY) <= c.taille / 2
  );
  if (cIdx === -1) return;

  const res = session.placerTour(placingIdx, cIdx);
  if (res === "ok") {
    log(`Tour placée sur case ${cIdx}`);
    cancelPlacing();
  } else {
    log(`Erreur: ${res}`);
  }
});

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = 0;

function loop(ts: number): void {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  session.tick(dt);
  render(ctx, session.getState());
  requestAnimationFrame(loop);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Populate bonus selector
  for (const b of ALL_BONUS_TYPES) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b.replace("BOOST_", "");
    bonusSel.appendChild(opt);
  }

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

  try {
    await initDiscord();
  } catch (e) {
    console.warn("Discord SDK non disponible (mode dev?)", e);
  }

  // Load map & waves (default level "level1")
  const levelName = new URLSearchParams(window.location.search).get("level") ?? "level1";
  let map: MapData;
  let waveTexts: string[];
  try {
    const lvlRes  = await fetch(`/api/level/${levelName}`);
    const lvlText = await lvlRes.text();
    const lines   = lvlText.split("\n").map(l => l.trim()).filter(Boolean);
    const mapName   = lines[0];
    const waveNames = lines.slice(1);
    map       = await loadMap(mapName);
    waveTexts = await Promise.all(waveNames.map(async wn => {
      const r = await fetch(`/api/wave/${wn}`);
      return r.text();
    }));
  } catch (e) {
    log(`Erreur chargement niveau: ${e}`);
    map       = { grille: [], tailleCase: 70, chemin: [], constructibles: [], spawn: {x:0,y:0}, base: {x:700,y:700} };
    waveTexts = [];
  }

  session = new GameSession(map, waveTexts);

  loading.classList.add("hidden");
  gameDiv.classList.remove("hidden");

  // Fill available width without CSS scaling (no blur)
  const panelW = 220;
  const availW = Math.max(400, window.innerWidth - panelW - 2);
  canvas.width  = availW;
  canvas.height = CANVAS_H;
  canvas.style.width  = availW + "px";

  refreshUI();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

main().catch(console.error);
