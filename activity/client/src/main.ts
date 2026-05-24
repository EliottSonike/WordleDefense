import { DiscordSDK } from "@discord/embedded-app-sdk";
import { GameSession, Phase } from "./game/GameSession";
import { getCouleur } from "./game/Element";
import { RareteLettre } from "./game/RareteLettre";
import { render, CANVAS_H } from "./game/Renderer";
import { creerLettreTour, creerLettreTourFromData } from "./game/LettreTourFactory";
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

// ── Tickets (persistants) ─────────────────────────────────────────────────────

const TICKETS_KEY    = "wd_tickets";
const COLLECTION_KEY  = "wd_collection";
const DECK_KEY        = "wd_deck";
const STARTING_TICKETS = 30;

const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALL_ELEMENTS = ["FEU", "EAU", "TERRE", "VENT"];

function getTickets(): number {
  return parseInt(localStorage.getItem(TICKETS_KEY) ?? String(STARTING_TICKETS));
}
function setTickets(n: number): void {
  localStorage.setItem(TICKETS_KEY, String(Math.max(0, n)));
}

// Collection persistante : une entrée par clé (lettre+élément), avec niveau
interface CollectionEntry {
  lettre:  string;
  element: string;
  rarete:  string;
  niveau:  number;
}

function entryKey(lettre: string, element: string): string { return `${lettre}-${element}`; }

function getCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CollectionEntry[];
  } catch { return []; }
}
function saveCollection(col: CollectionEntry[]): void {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(col));
}
// Deck : lettre → élément sélectionné (une seule variante par lettre en jeu)
function getDeck(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DECK_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveDeck(deck: Record<string, string>): void {
  localStorage.setItem(DECK_KEY, JSON.stringify(deck));
}

function entryToLettreTour(e: CollectionEntry): LettreTour {
  const lt = creerLettreTourFromData(
    e.lettre,
    e.element as import("./game/Element").Element,
    e.rarete  as import("./game/RareteLettre").RareteLettre,
  );
  lt.niveau = e.niveau;
  return lt;
}

// ── Screen helpers ────────────────────────────────────────────────────────────

type Screen = "loading" | "menu" | "invocation" | "letterbox" | "game";

function showScreen(s: Screen): void {
  const ids: Record<Screen, string> = {
    loading:    "screen-loading",
    menu:       "screen-menu",
    invocation: "screen-invocation",
    letterbox:  "screen-letterbox",
    game:       "game-container",
  };
  for (const [key, id] of Object.entries(ids)) {
    document.getElementById(id)!.classList.toggle("hidden", key !== s);
  }
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const canvas     = document.getElementById("game-canvas")    as HTMLCanvasElement;
const ctx        = canvas.getContext("2d")!;
const invDiv     = document.getElementById("inventaire")!;
const towersDiv  = document.getElementById("towers-list")!;
const logDiv     = document.getElementById("log-entries")!;
const panelBuild = document.getElementById("panel-build")!;
const panelPlace = document.getElementById("panel-place")!;
const placingLbl = document.getElementById("placing-letter")!;

// ── Ticket / collection UI ────────────────────────────────────────────────────

function updateTicketDisplays(): void {
  const t = getTickets();
  document.getElementById("menu-ticket-count")!.textContent = String(t);
  document.getElementById("inv-ticket-count")!.textContent  = String(t);
}

/** Rendu A→Z compact pour l'écran invocation (lecture seule) */
function renderCollection(): void {
  const col   = getCollection();
  const list  = document.getElementById("inv-preGame-list")!;
  const count = document.getElementById("inv-count")!;
  count.textContent = `(${col.length})`;
  list.innerHTML = "";
  // grouper par lettre
  for (const letter of ALL_LETTERS) {
    const variants = col.filter(e => e.lettre === letter);
    if (variants.length === 0) continue;
    const row = document.createElement("div");
    row.className = "letter-row";
    const lbl = document.createElement("span");
    lbl.className = "letter-row-name";
    lbl.textContent = letter;
    row.appendChild(lbl);
    for (const e of variants) {
      const chip = document.createElement("span");
      chip.className = "elem-chip";
      chip.style.background = getCouleur(e.element as import("./game/Element").Element);
      chip.textContent = `${e.element.slice(0,3)} Nv.${e.niveau}`;
      if (e.rarete === RareteLettre.RARE) chip.classList.add("elem-rare");
      row.appendChild(chip);
    }
    list.appendChild(row);
  }
}

/** Rendu A→Z avec sélection d'élément (deck builder) */
function renderLetterbox(): void {
  const col   = getCollection();
  const list  = document.getElementById("letterbox-list")!;
  const empty = document.getElementById("letterbox-empty")!;
  const deck  = getDeck();
  list.innerHTML = "";
  empty.classList.toggle("hidden", col.length > 0);

  for (const letter of ALL_LETTERS) {
    const row = document.createElement("div");
    row.className = "letter-row";

    const lbl = document.createElement("span");
    lbl.className = "letter-row-name";
    lbl.textContent = letter;
    row.appendChild(lbl);

    for (const elem of ALL_ELEMENTS) {
      const entry = col.find(e => e.lettre === letter && e.element === elem);
      const btn   = document.createElement("button");
      const selected = deck[letter] === elem;

      if (entry) {
        btn.className = "elem-btn owned" + (selected ? " selected" : "");
        btn.style.setProperty("--elem-color", getCouleur(entry.element as import("./game/Element").Element));
        btn.innerHTML = `<span class="elem-btn-name">${elem.slice(0,3)}</span><span class="elem-btn-lv">Nv.${entry.niveau}</span>`;
        if (entry.rarete === RareteLettre.RARE) btn.classList.add("elem-rare");
        btn.addEventListener("click", () => {
          const d = getDeck();
          if (d[letter] === elem) delete d[letter]; // désélectionner
          else d[letter] = elem;
          saveDeck(d);
          renderLetterbox();
        });
      } else {
        btn.className = "elem-btn locked";
        btn.disabled = true;
        btn.textContent = elem.slice(0,3);
      }
      row.appendChild(btn);
    }
    list.appendChild(row);
  }
}

function makeInvItem(lt: LettreTour): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "inv-item";
  el.innerHTML = `
    <div class="badge" style="background:${getCouleur(lt.element)}">${lt.lettre}</div>
    <div class="info">${lt.rarete === RareteLettre.RARE ? "⭐ RARE" : "commun"}<br/>${lt.element}</div>
    <div class="niveau-badge">Nv.${lt.niveau}</div>`;
  return el;
}

function doPull(count: number): void {
  const tickets = getTickets();
  if (tickets < count) {
    showPullResults([{ error: `Pas assez de tickets (${tickets}/${count})` }]);
    return;
  }
  setTickets(tickets - count);
  updateTicketDisplays();

  const col = getCollection();
  const results: { entry: CollectionEntry; upgraded: boolean }[] = [];

  for (let i = 0; i < count; i++) {
    const lt  = creerLettreTour();
    const key = entryKey(lt.lettre, lt.element);
    const existing = col.find(e => entryKey(e.lettre, e.element) === key);
    if (existing) {
      existing.niveau++;
      results.push({ entry: existing, upgraded: true });
    } else {
      const entry: CollectionEntry = { lettre: lt.lettre, element: lt.element, rarete: lt.rarete, niveau: 1 };
      col.push(entry);
      results.push({ entry, upgraded: false });
    }
  }

  saveCollection(col);
  renderCollection();
  showPullResults(results.map(r => ({ entry: r.entry, upgraded: r.upgraded })));
}

function showPullResults(items: ({ entry: CollectionEntry; upgraded: boolean } | { error: string })[]): void {
  const box = document.getElementById("pull-results")!;
  box.classList.remove("hidden");
  box.innerHTML = "";
  for (const item of items) {
    const el = document.createElement("div");
    if ("error" in item) {
      el.className = "pull-item pull-error";
      el.textContent = item.error;
    } else {
      const { entry, upgraded } = item;
      const rare = entry.rarete === RareteLettre.RARE;
      el.className = "pull-item" + (rare ? " pull-rare" : "") + (upgraded ? " pull-upgrade" : "");
      const color = getCouleur(entry.element as import("./game/Element").Element);
      el.innerHTML = `
        <span class="pull-badge" style="background:${color}">${entry.lettre}</span>
        <span>${entry.element}${rare ? " ⭐" : ""}</span>
        <span class="pull-level">${upgraded ? `⬆ Nv.${entry.niveau}` : "Nv.1"}</span>`;
    }
    box.appendChild(el);
  }
}

// ── In-game state ─────────────────────────────────────────────────────────────

let session: GameSession;
let placingIdx: number | null = null;
let mapData: MapData    = { grille: [], tailleCase: 70, chemin: [], constructibles: [], spawn: {x:0,y:0}, base: {x:700,y:700} };
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

function refreshUI(): void {
  const state = session.getState();
  renderInventaire(state.inventaire);

  towersDiv.innerHTML = "";
  for (const t of state.tours) {
    const el = document.createElement("div");
    el.className = "tower-item";
    el.textContent = `${t.lettre} ${t.element}${t.rarete === RareteLettre.RARE ? " ★" : ""}`;
    towersDiv.appendChild(el);
  }

  const inBuild = state.phase === Phase.BUILD;
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
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
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

  const stdX = canvasX / scale + minX;
  const stdY = maxY - (canvasY - 50) / scale;

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

function loop(ts: number): void {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  session.tick(dt);
  render(ctx, session.getState());
  requestAnimationFrame(loop);
}

function startGame(): void {
  const col   = getCollection();
  const deck  = getDeck();
  // Lettres du deck sélectionné (une variante par lettre), sinon toutes
  const deckEntries = Object.entries(deck)
    .map(([lettre, element]) => col.find(e => e.lettre === lettre && e.element === element))
    .filter((e): e is CollectionEntry => e !== undefined);
  const startingLetters = (deckEntries.length > 0 ? deckEntries : col).map(entryToLettreTour);
  session = new GameSession(mapData, waveTexts, startingLetters);

  const panelW = 220;
  const availW = Math.max(400, window.innerWidth - panelW - 2);
  canvas.width  = availW;
  canvas.height = CANVAS_H;
  canvas.style.width = availW + "px";

  showScreen("game");
  refreshUI();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // In-game buttons
  document.getElementById("btn-launch")!.addEventListener("click", () => {
    const res = session.lancerVague();
    if (res === "ok") { log("Vague lancée !"); refreshUI(); }
    else log(res);
  });
  document.getElementById("btn-cancel-place")!.addEventListener("click", cancelPlacing);

  // Menu navigation
  document.getElementById("btn-solo")!.addEventListener("click", startGame);
  document.getElementById("btn-reset")!.addEventListener("click", () => {
    if (!confirm("Réinitialiser toute la progression (tickets + collection) ?")) return;
    localStorage.removeItem(TICKETS_KEY);
    localStorage.removeItem(COLLECTION_KEY);
    localStorage.removeItem(DECK_KEY);
    updateTicketDisplays();
  });
  document.getElementById("btn-go-invocation")!.addEventListener("click", () => {
    updateTicketDisplays();
    renderCollection();
    showScreen("invocation");
  });
  document.getElementById("btn-back-invocation")!.addEventListener("click", () => {
    updateTicketDisplays();
    showScreen("menu");
  });
  document.getElementById("btn-go-letterbox")!.addEventListener("click", () => {
    renderLetterbox();
    showScreen("letterbox");
  });
  document.getElementById("btn-back-letterbox")!.addEventListener("click", () => showScreen("menu"));

  // Invocation pulls
  document.getElementById("btn-pull-1")!.addEventListener("click", () => doPull(1));
  document.getElementById("btn-pull-10")!.addEventListener("click", () => doPull(10));

  // Discord
  try { await initDiscord(); }
  catch (e) { console.warn("Discord SDK non disponible", e); }

  // Load level
  const levelName = new URLSearchParams(window.location.search).get("level") ?? "level1";
  try {
    const lvlRes  = await fetch(`/api/level/${levelName}`);
    const lvlText = await lvlRes.text();
    const lines   = lvlText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    mapData   = await (async () => {
      const r = await fetch(`/api/map/${lines[0]}`);
      return parseMap(await r.text());
    })();
    waveTexts = await Promise.all(lines.slice(1).map(async (wn: string) => {
      const r = await fetch(`/api/wave/${wn}`);
      return r.text();
    }));
  } catch (e) {
    console.error("Erreur chargement niveau:", e);
  }

  updateTicketDisplays();
  showScreen("menu");
}

main().catch(console.error);
