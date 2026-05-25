import { DiscordSDK } from "@discord/embedded-app-sdk";
import { GameSession, Phase } from "./game/GameSession";
import { getCouleur, Element } from "./game/Element";
import { RareteLettre } from "./game/RareteLettre";
import { render, CANVAS_H } from "./game/Renderer";
import { creerLettreTour, creerLettreTourFromData } from "./game/LettreTourFactory";
import type { LettreTour } from "./game/LettreTour";
import type { MapData } from "./game/types";
import { parseMap } from "./game/MapParser";
import { BonusType, ALL_BONUS_TYPES } from "./game/BonusType";

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

// ── Storage keys ──────────────────────────────────────────────────────────────

const TICKETS_KEY       = "wd_tickets";
const COLLECTION_KEY    = "wd_collection";
const BONUSES_KEY       = "wd_bonuses";
const ACTIVE_BNS_KEY    = "wd_active_bonuses";
const DECKS_KEY         = "wd_decks";
const ACTIVE_DECK_KEY   = "wd_active_deck";
const WORD_DISC_KEY     = "wd_word_discovery";
const STARTING_TICKETS  = 30;

const ALL_LETTERS  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALL_ELEMENTS = ["FEU", "EAU", "TERRE", "VENT"];

// ── Interfaces ────────────────────────────────────────────────────────────────

interface CollectionEntry { lettre: string; element: string; rarete: string; niveau: number }
interface BonusEntry      { type: string; niveau: number }
interface DeckLetter      { lettre: string; element: string }
interface DeckSlot        { name: string; letters: DeckLetter[] }
interface WordDiscovery   { words: string[]; totalPoints: number }

// ── Scrabble scoring ──────────────────────────────────────────────────────────

const SCRABBLE: Record<string, number> = {
  A:1,E:1,I:1,O:1,U:1,L:1,N:1,S:1,T:1,R:1,
  D:2,G:2,B:3,C:3,M:3,P:3,F:4,H:4,V:4,W:4,Y:4,
  K:5,J:8,X:8,Q:10,Z:10,
};
function scrabbleScore(word: string): number {
  return [...word.toUpperCase()].reduce((s, c) => s + (SCRABBLE[c] ?? 0), 0);
}
function wordPoints(score: number): number { return Math.ceil(score / 5); }
function wordBonusMult(totalPoints: number): number { return 1 + totalPoints * 0.01; }

// ── Bonus display info ────────────────────────────────────────────────────────

const BONUS_INFO: Record<string, { label: string; icon: string; desc: string; color: string; rarete: string }> = {
  BOOST_CONSONNES:  { label: "Consonnes",  icon: "C",  desc: "ATK ×1.5 pour les consonnes",       color: "#6677bb", rarete: "COMMUN" },
  BOOST_VOYELLES:   { label: "Voyelles",   icon: "V",  desc: "Vitesse ×1.5 pour les voyelles",    color: "#9966cc", rarete: "COMMUN" },
  BOOST_FEU:        { label: "Feu",        icon: "🔥", desc: "Durée brûlure ×2.0",               color: "#B81601", rarete: "COMMUN" },
  BOOST_EAU:        { label: "Eau",        icon: "💧", desc: "Durée ralentissement ×2.0",        color: "#0055cc", rarete: "COMMUN" },
  BOOST_TERRE:      { label: "Terre",      icon: "🌿", desc: "Réduction armure ×1.2",            color: "#00A70F", rarete: "COMMUN" },
  BOOST_VENT:       { label: "Vent",       icon: "💨", desc: "Cases de recul ×2.0",              color: "#88ccdd", rarete: "COMMUN" },
  BOOST_RARES:      { label: "Rares ★",    icon: "★",  desc: "Toutes stats ×1.3 (lettres rares)", color: "#cc9900", rarete: "RARE"   },
  BOOST_ATK_GLOBAL: { label: "Attaque+",   icon: "⚔",  desc: "ATK ×1.2 pour toutes les tours",   color: "#aaaaff", rarete: "COMMUN" },
};
const BONUS_POOL = [...ALL_BONUS_TYPES];

// ── Tickets ───────────────────────────────────────────────────────────────────

function getTickets(): number {
  return parseInt(localStorage.getItem(TICKETS_KEY) ?? String(STARTING_TICKETS));
}
function setTickets(n: number): void {
  localStorage.setItem(TICKETS_KEY, String(Math.max(0, n)));
}

// ── Letter collection ─────────────────────────────────────────────────────────

const ELEM_NAMES   = ["FEU", "EAU", "TERRE", "VENT", "NEUTRE"];
const RARETE_NAMES = ["COMMUN", "RARE"];

function getCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (!raw) return [];
    const col = JSON.parse(raw) as CollectionEntry[];
    for (const e of col) {
      if (typeof e.element === "number") e.element = ELEM_NAMES[e.element as unknown as number] ?? "FEU";
      if (typeof e.rarete  === "number") e.rarete  = RARETE_NAMES[e.rarete as unknown as number] ?? "COMMUN";
    }
    return col;
  } catch { return []; }
}
function saveCollection(col: CollectionEntry[]): void {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(col));
}
function entryKey(lettre: string, element: string): string { return `${lettre}-${element}`; }

function entryToLettreTour(e: CollectionEntry): LettreTour {
  const lt = creerLettreTourFromData(e.lettre, e.element as Element, e.rarete as RareteLettre);
  lt.niveau = e.niveau;
  return lt;
}

// ── Bonus collection ──────────────────────────────────────────────────────────

function getBonusCollection(): BonusEntry[] {
  try { return JSON.parse(localStorage.getItem(BONUSES_KEY) ?? "[]") as BonusEntry[]; }
  catch { return []; }
}
function saveBonusCollection(col: BonusEntry[]): void {
  localStorage.setItem(BONUSES_KEY, JSON.stringify(col));
}
function getActiveBonuses(): string[] {
  try { return JSON.parse(localStorage.getItem(ACTIVE_BNS_KEY) ?? "[]") as string[]; }
  catch { return []; }
}
function saveActiveBonuses(active: string[]): void {
  localStorage.setItem(ACTIVE_BNS_KEY, JSON.stringify(active));
}

// ── Deck slots (ordered, 5 letters max) ──────────────────────────────────────

function makeDefaultDecks(): DeckSlot[] {
  return [
    { name: "Deck 1", letters: [] },
    { name: "Deck 2", letters: [] },
    { name: "Deck 3", letters: [] },
  ];
}

function getDeckSlots(): DeckSlot[] {
  try {
    const raw = localStorage.getItem(DECKS_KEY);
    if (!raw) return makeDefaultDecks();
    const parsed = JSON.parse(raw) as Array<{
      name: string;
      selections?: Record<string, string>;
      letters?: DeckLetter[];
    }>;
    return parsed.map(d => ({
      name: d.name,
      // Migrate old Record<string,string> format to ordered array
      letters: d.letters ?? Object.entries(d.selections ?? {}).slice(0, 5).map(([lettre, element]) => ({ lettre, element })),
    }));
  } catch { return makeDefaultDecks(); }
}
function saveDeckSlots(decks: DeckSlot[]): void {
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}
function getActiveDeckIdx(): number {
  return parseInt(localStorage.getItem(ACTIVE_DECK_KEY) ?? "0");
}
function saveActiveDeckIdx(idx: number): void {
  localStorage.setItem(ACTIVE_DECK_KEY, String(idx));
}

// ── Word discovery ────────────────────────────────────────────────────────────

function getWordDiscovery(): WordDiscovery {
  try {
    return JSON.parse(localStorage.getItem(WORD_DISC_KEY) ?? '{"words":[],"totalPoints":0}') as WordDiscovery;
  } catch { return { words: [], totalPoints: 0 }; }
}
function saveWordDiscovery(d: WordDiscovery): void {
  localStorage.setItem(WORD_DISC_KEY, JSON.stringify(d));
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

// ── Ticket UI ─────────────────────────────────────────────────────────────────

function updateTicketDisplays(): void {
  const t = getTickets();
  document.getElementById("menu-ticket-count")!.textContent = String(t);
  document.getElementById("inv-ticket-count")!.textContent  = String(t);
}

// ── Shared pull result display ────────────────────────────────────────────────

type PullItem =
  | { label: string; sublabel: string; color: string; upgraded: boolean; rare: boolean; niveau: number }
  | { error: string };

function showPullResults(containerId: string, items: PullItem[]): void {
  const box = document.getElementById(containerId)!;
  box.classList.remove("hidden");
  box.innerHTML = "";
  for (const item of items) {
    const el = document.createElement("div");
    if ("error" in item) {
      el.className = "pull-item pull-error";
      el.textContent = item.error;
    } else {
      const { label, sublabel, color, upgraded, rare, niveau } = item;
      el.className = "pull-item" + (rare ? " pull-rare" : "") + (upgraded ? " pull-upgrade" : "");
      el.innerHTML = `
        <span class="pull-badge" style="background:${color}">${label}</span>
        <span>${sublabel}${rare ? " ⭐" : ""}</span>
        <span class="pull-level">${upgraded ? `⬆ Nv.${niveau}` : "Nv.1"}</span>`;
    }
    box.appendChild(el);
  }
}

// ── Letter invocation ─────────────────────────────────────────────────────────

function doPull(count: number): void {
  const tickets = getTickets();
  if (tickets < count) {
    showPullResults("pull-results", [{ error: `Pas assez de tickets (${tickets}/${count})` }]);
    return;
  }
  setTickets(tickets - count);
  updateTicketDisplays();

  const col: CollectionEntry[] = getCollection();
  const items: PullItem[] = [];

  for (let i = 0; i < count; i++) {
    const lt  = creerLettreTour();
    const key = entryKey(lt.lettre, lt.element);
    const existing = col.find(e => entryKey(e.lettre, e.element) === key);
    if (existing) {
      existing.niveau++;
      items.push({ label: lt.lettre, sublabel: lt.element, color: getCouleur(lt.element as Element), upgraded: true, rare: lt.rarete === RareteLettre.RARE, niveau: existing.niveau });
    } else {
      const entry: CollectionEntry = { lettre: lt.lettre, element: lt.element, rarete: lt.rarete, niveau: 1 };
      col.push(entry);
      items.push({ label: lt.lettre, sublabel: lt.element, color: getCouleur(lt.element as Element), upgraded: false, rare: lt.rarete === RareteLettre.RARE, niveau: 1 });
    }
  }

  saveCollection(col);
  showPullResults("pull-results", items);
}

// ── Bonus invocation ──────────────────────────────────────────────────────────

function doPullBonus(count: number): void {
  const tickets = getTickets();
  if (tickets < count) {
    showPullResults("bonus-pull-results", [{ error: `Pas assez de tickets (${tickets}/${count})` }]);
    return;
  }
  setTickets(tickets - count);
  updateTicketDisplays();

  const col: BonusEntry[] = getBonusCollection();
  const items: PullItem[] = [];

  for (let i = 0; i < count; i++) {
    const type = BONUS_POOL[Math.floor(Math.random() * BONUS_POOL.length)];
    const info = BONUS_INFO[type] ?? { label: type, icon: "?", desc: "", color: "#888", rarete: "COMMUN" };
    const existing = col.find(e => e.type === type);
    if (existing) {
      existing.niveau++;
      items.push({ label: info.icon, sublabel: info.label, color: info.color, upgraded: true, rare: info.rarete === "RARE", niveau: existing.niveau });
    } else {
      col.push({ type, niveau: 1 });
      items.push({ label: info.icon, sublabel: info.label, color: info.color, upgraded: false, rare: info.rarete === "RARE", niveau: 1 });
    }
  }

  saveBonusCollection(col);
  showPullResults("bonus-pull-results", items);
}

// ── Bonus portal (in letterbox) ───────────────────────────────────────────────

function renderBonusPortal(): void {
  const col    = getBonusCollection();
  const active = getActiveBonuses();
  const list   = document.getElementById("bonus-collection")!;
  const count  = document.getElementById("bonus-active-count")!;
  const emptyEl = document.getElementById("bonus-empty")!;
  count.textContent = `(${active.length}/3)`;
  list.innerHTML = "";
  emptyEl.classList.toggle("hidden", col.length > 0);
  if (col.length === 0) return;

  for (const entry of col) {
    const info     = BONUS_INFO[entry.type] ?? { label: entry.type, icon: "?", desc: "", color: "#888", rarete: "COMMUN" };
    const isActive = active.includes(entry.type);
    const card     = document.createElement("div");
    card.className = "bonus-card"
      + (isActive ? " active" : "")
      + (info.rarete === "RARE" ? " bonus-rare" : "");

    card.innerHTML = `
      <div class="bonus-icon" style="background:${info.color}33; border:1px solid ${info.color}66">${info.icon}</div>
      <div class="bonus-info">
        <div class="bonus-name">${info.label}</div>
        <div class="bonus-desc">${info.desc}</div>
      </div>
      <div class="niveau-badge">Nv.${entry.niveau}</div>
      ${isActive ? '<div class="bonus-active-badge">ACTIF</div>' : ""}`;

    card.addEventListener("click", () => {
      const a = getActiveBonuses();
      const idx = a.indexOf(entry.type);
      if (idx >= 0) a.splice(idx, 1);
      else if (a.length < 3) a.push(entry.type);
      saveActiveBonuses(a);
      renderBonusPortal();
    });

    list.appendChild(card);
  }
}

// ── Letterbox with ordered deck + word display ────────────────────────────────

function renderLetterbox(): void {
  const col        = getCollection();
  const decks      = getDeckSlots();
  const activeIdx  = getActiveDeckIdx();
  const deckLetters = decks[activeIdx]?.letters ?? [];
  const tabBar     = document.getElementById("deck-tab-bar")!;
  const slotsEl    = document.getElementById("word-slots-container")!;
  const wordEl     = document.getElementById("word-display")!;
  const discEl     = document.getElementById("word-discovery-info")!;
  const list       = document.getElementById("letterbox-list")!;
  const empty      = document.getElementById("letterbox-empty")!;

  // Tabs
  tabBar.innerHTML = "";
  decks.forEach((d, i) => {
    const btn = document.createElement("button");
    btn.className = "deck-tab" + (i === activeIdx ? " active" : "");
    btn.textContent = d.name;
    btn.addEventListener("click", () => { saveActiveDeckIdx(i); renderLetterbox(); });
    tabBar.appendChild(btn);
  });

  // Word slots (5 ordered positions)
  slotsEl.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const entry = deckLetters[i];
    const slot = document.createElement("div");
    if (entry) {
      slot.className = "word-slot filled";
      slot.style.setProperty("--slot-color", getCouleur(entry.element as Element));
      slot.title = "Cliquer pour retirer";
      slot.innerHTML = `<span class="slot-letter">${entry.lettre}</span><span class="slot-elem">${entry.element.slice(0,3)}</span>`;
      slot.addEventListener("click", () => {
        const ds = getDeckSlots();
        ds[getActiveDeckIdx()].letters.splice(i, 1);
        saveDeckSlots(ds);
        renderLetterbox();
      });
    } else {
      slot.className = "word-slot empty";
      slot.textContent = "_";
    }
    slotsEl.appendChild(slot);
  }

  // Word display
  const word = deckLetters.map(l => l.lettre).join("");
  const isComplete = deckLetters.length === 5;
  wordEl.innerHTML = isComplete
    ? `<span class="word-complete">${word}</span>`
    : `<span class="word-muted">${word}${"_".repeat(5 - deckLetters.length)}</span>`;

  // Word discovery info
  const disc = getWordDiscovery();
  if (disc.words.length > 0) {
    const mult = wordBonusMult(disc.totalPoints);
    discEl.textContent = `Maîtrise : ×${mult.toFixed(2)} ATK global — ${disc.words.length} mot${disc.words.length > 1 ? "s" : ""} découvert${disc.words.length > 1 ? "s" : ""}`;
  } else {
    discEl.textContent = "Formez un mot valide avec 5 lettres pour un bonus permanent.";
  }

  // Letter rows
  list.innerHTML = "";
  empty.classList.toggle("hidden", col.length > 0);

  for (const letter of ALL_LETTERS) {
    const owned = col.filter(e => e.lettre === letter);
    if (owned.length === 0) continue;

    const row = document.createElement("div");
    row.className = "letter-row";
    const lbl = document.createElement("span");
    lbl.className = "letter-row-name";
    lbl.textContent = letter;
    row.appendChild(lbl);

    for (const elem of ALL_ELEMENTS) {
      const entry    = owned.find(e => e.element === elem);
      const btn      = document.createElement("button");
      const deckIdx  = deckLetters.findIndex(l => l.lettre === letter && l.element === elem);
      const inDeck   = deckIdx >= 0;

      if (entry) {
        if (inDeck) {
          btn.className = "elem-btn owned in-deck";
          btn.style.setProperty("--elem-color", getCouleur(entry.element as Element));
          btn.innerHTML = `<span class="elem-btn-name">${elem.slice(0,3)}</span><span class="elem-btn-pos">#${deckIdx + 1}</span>`;
          if (entry.rarete === RareteLettre.RARE) btn.classList.add("elem-rare");
          btn.addEventListener("click", () => {
            const ds = getDeckSlots();
            const ai = getActiveDeckIdx();
            const idx = ds[ai].letters.findIndex(l => l.lettre === letter && l.element === elem);
            if (idx >= 0) { ds[ai].letters.splice(idx, 1); saveDeckSlots(ds); renderLetterbox(); }
          });
        } else {
          const canAdd = deckLetters.length < 5;
          btn.className = "elem-btn owned";
          btn.style.setProperty("--elem-color", getCouleur(entry.element as Element));
          btn.innerHTML = `<span class="elem-btn-name">${elem.slice(0,3)}</span><span class="elem-btn-lv">Nv.${entry.niveau}</span>`;
          if (entry.rarete === RareteLettre.RARE) btn.classList.add("elem-rare");
          btn.disabled = !canAdd;
          if (canAdd) {
            btn.addEventListener("click", () => {
              const ds = getDeckSlots();
              const ai = getActiveDeckIdx();
              if (ds[ai].letters.length < 5) {
                ds[ai].letters.push({ lettre: letter, element: elem });
                saveDeckSlots(ds);
                renderLetterbox();
              }
            });
          }
        }
      } else {
        btn.className = "elem-btn locked";
        btn.disabled  = true;
        btn.textContent = elem.slice(0,3);
      }
      row.appendChild(btn);
    }
    list.appendChild(row);
  }

  renderBonusPortal();
}

// ── In-game state ─────────────────────────────────────────────────────────────

let session: GameSession;
let placingIdx: number | null = null;
let mapData: MapData    = { grille: [], tailleCase: 70, chemin: [], constructibles: [], spawn: {x:0,y:0}, base: {x:700,y:700} };
let waveTexts: string[] = [];
let gameRunning  = false;
let gameOverShown = false;

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
  const rect   = canvas.getBoundingClientRect();
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
  else log(`Erreur: ${res}`);
});

// ── Game over ─────────────────────────────────────────────────────────────────

function showGameOver(state: ReturnType<GameSession["getState"]>): void {
  const isVictory = state.stats.wavesCleared >= state.waveCount;
  document.getElementById("game-over-title")!.textContent  = isVictory ? "🏆 Victoire !" : "💀 Défaite";
  document.getElementById("stat-waves")!.textContent   = `${state.stats.wavesCleared}/${state.waveCount}`;
  document.getElementById("stat-kills")!.textContent   = String(state.stats.killCount);
  document.getElementById("stat-tickets")!.textContent = String(state.stats.ticketsEarned);

  if (state.stats.ticketsEarned > 0) {
    setTickets(getTickets() + state.stats.ticketsEarned);
    updateTicketDisplays();
    log(`Partie terminée — +${state.stats.ticketsEarned} tickets !`);
  }

  document.getElementById("game-over")!.classList.remove("hidden");
}

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = 0;

function loop(ts: number): void {
  if (!gameRunning) return;
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  session.tick(dt);
  const state = session.getState();
  render(ctx, state);

  if (state.phase === Phase.OVER && !gameOverShown) {
    gameOverShown = true;
    gameRunning   = false;
    showGameOver(state);
    return;
  }

  requestAnimationFrame(loop);
}

async function startGame(): Promise<void> {
  const col       = getCollection();
  const decks     = getDeckSlots();
  const activeIdx = getActiveDeckIdx();
  const deckLetters = decks[activeIdx]?.letters ?? [];

  const deckEntries = deckLetters
    .map(l => col.find(e => e.lettre === l.lettre && e.element === l.element))
    .filter((e): e is CollectionEntry => e !== undefined);
  const startingLetters = (deckEntries.length > 0 ? deckEntries : col).map(entryToLettreTour);

  const bonusCol    = getBonusCollection();
  const activeIds   = getActiveBonuses();
  const activeBonuses = activeIds
    .map(id => bonusCol.find(b => b.type === id))
    .filter((b): b is BonusEntry => b !== undefined)
    .map(b => ({ type: b.type as BonusType, niveau: b.niveau }));

  // Word bonus check
  let wbMult = wordBonusMult(getWordDiscovery().totalPoints);
  if (deckLetters.length === 5) {
    const word = deckLetters.map(l => l.lettre).join("");
    try {
      const r = await fetch(`/api/check-word/${word}`);
      const data = await r.json() as { valid: boolean; score: number };
      if (data.valid) {
        const disc = getWordDiscovery();
        const isNew = !disc.words.includes(word);
        const pts = wordPoints(data.score);
        if (isNew) {
          disc.words.push(word);
          disc.totalPoints += pts;
          saveWordDiscovery(disc);
          log(`✦ Nouveau mot : ${word} (score ${data.score}, +${pts} pts de maîtrise)`);
        }
        wbMult = wordBonusMult(getWordDiscovery().totalPoints);
        log(`Maîtrise des mots : ×${wbMult.toFixed(2)} ATK global`);
      }
    } catch { /* silently skip if server unreachable */ }
  }

  session = new GameSession(mapData, waveTexts, startingLetters, activeBonuses, wbMult);

  const panelW = 220;
  const availW = Math.max(400, window.innerWidth - panelW - 2);
  canvas.width  = availW;
  canvas.height = CANVAS_H;
  canvas.style.width = availW + "px";

  document.getElementById("game-over")!.classList.add("hidden");
  gameRunning   = true;
  gameOverShown = false;

  showScreen("game");
  refreshUI();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  document.getElementById("btn-launch")!.addEventListener("click", () => {
    const res = session.lancerVague();
    if (res === "ok") { log("Vague lancée !"); refreshUI(); }
    else log(res);
  });
  document.getElementById("btn-cancel-place")!.addEventListener("click", cancelPlacing);

  document.getElementById("btn-solo")!.addEventListener("click", () => startGame().catch(console.error));

  document.getElementById("btn-back-from-game")!.addEventListener("click", () => {
    gameRunning = false;
    gameOverShown = false;
    document.getElementById("game-over")!.classList.add("hidden");
    updateTicketDisplays();
    showScreen("menu");
  });

  // Reset — double-clic (confirm() bloqué dans les iframes Discord)
  let resetClicks = 0;
  const btnReset = document.getElementById("btn-reset")!;
  btnReset.addEventListener("click", () => {
    resetClicks++;
    if (resetClicks < 2) {
      btnReset.textContent = "⚠ Cliquer encore pour confirmer";
      setTimeout(() => { resetClicks = 0; btnReset.textContent = "Réinitialiser la progression"; }, 3000);
      return;
    }
    resetClicks = 0;
    ["wd_deck", TICKETS_KEY, COLLECTION_KEY, BONUSES_KEY, ACTIVE_BNS_KEY, DECKS_KEY, ACTIVE_DECK_KEY, WORD_DISC_KEY]
      .forEach(k => localStorage.removeItem(k));
    btnReset.textContent = "Réinitialiser la progression";
    updateTicketDisplays();
  });

  // Invocation
  document.getElementById("btn-go-invocation")!.addEventListener("click", () => {
    updateTicketDisplays();
    showScreen("invocation");
  });
  document.getElementById("btn-back-invocation")!.addEventListener("click", () => {
    updateTicketDisplays();
    showScreen("menu");
  });
  document.getElementById("btn-pull-1")!.addEventListener("click",  () => doPull(1));
  document.getElementById("btn-pull-10")!.addEventListener("click", () => doPull(10));
  document.getElementById("btn-pull-bonus-1")!.addEventListener("click",  () => doPullBonus(1));
  document.getElementById("btn-pull-bonus-10")!.addEventListener("click", () => doPullBonus(10));

  // Invocation tab switching
  document.getElementById("inv-tab-letters")!.addEventListener("click", () => {
    document.getElementById("inv-section-letters")!.classList.remove("hidden");
    document.getElementById("inv-section-bonus")!.classList.add("hidden");
    document.getElementById("inv-tab-letters")!.classList.add("active");
    document.getElementById("inv-tab-bonus")!.classList.remove("active");
  });
  document.getElementById("inv-tab-bonus")!.addEventListener("click", () => {
    document.getElementById("inv-section-bonus")!.classList.remove("hidden");
    document.getElementById("inv-section-letters")!.classList.add("hidden");
    document.getElementById("inv-tab-bonus")!.classList.add("active");
    document.getElementById("inv-tab-letters")!.classList.remove("active");
  });

  // Letterbox (deck + bonus actifs)
  document.getElementById("btn-go-letterbox")!.addEventListener("click", () => {
    renderLetterbox();
    showScreen("letterbox");
  });
  document.getElementById("btn-back-letterbox")!.addEventListener("click", () => showScreen("menu"));

  // Discord
  try { await initDiscord(); }
  catch (e) { console.warn("Discord SDK non disponible", e); }

  // Load level
  const levelName = new URLSearchParams(window.location.search).get("level") ?? "level1";
  try {
    const lvlRes  = await fetch(`/api/level/${levelName}`);
    const lvlText = await lvlRes.text();
    const lines   = lvlText.split("\n").map((l: string) => l.trim()).filter(Boolean);
    mapData = await (async () => {
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
