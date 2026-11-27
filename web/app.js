import { FIELDS, FIELD_IDS, FIELD_WEIGHTS, generate, stats, mulberry32, pick, pickWeighted } from "./fields.js";
import { PALETTE_LABELS, SPECTRAL_PALETTES, COLD_PALETTES, RENDERERS, pitchesFor, makeGrid, draw, prepareAscii } from "./render.js";
import { lang, setLang, L, t, applyStatic } from "./i18n.js";

// Une seule liste : les champs aléatoires stationnaires et isotropes, dans
// l'ordre des préférences. Les favoris (★) pèsent plus lourd au tirage.
const PALETTES = [...SPECTRAL_PALETTES, ...COLD_PALETTES];
const PALETTE_WEIGHTS = { cubehelix: 3, spectre: 2, glace: 2 };
const weighted = (ids, weights) => ids.map((id) => [id, weights[id] ?? 1]);

const $ = (id) => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");

const state = {
  screens: [],
  screen: 0,
  // "hasard" = retiré à chaque shuffle ; sinon verrouillé.
  choice: { source: "hasard", renderer: "cercles", pitch: 24, pitchRandom: false, palette: "hasard" },
  current: null,
  history: [],
  pos: -1,
  fieldCache: new Map(),
};

const screenWH = () => { const s = state.screens[state.screen]; return [s.width, s.height]; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function toast(msg, error = false) {
  const el = $("toast"); el.textContent = msg; el.className = error ? "error" : "";
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (el.textContent = ""), 5000);
}

// ─── Rendu d'une spec ────────────────────────────────────────────────────

async function render(spec, { gate = false } = {}) {
  $("busy").hidden = false;
  await nextFrame();
  try {
    if (canvas.width !== spec.W || canvas.height !== spec.H) { canvas.width = spec.W; canvas.height = spec.H; }
    const grid = makeGrid(spec.renderer, spec.W, spec.H, spec.pitch, ctx);
    const gridAspect = (grid.cols * grid.cellW) / (grid.rows * grid.cellH);
    let res, rejected = 0;
    for (let k = 0; k < (gate ? 15 : 1); k++) {
      const key = `${spec.field}|${spec.seed + k}|${grid.cols}|${grid.rows}`;
      res = state.fieldCache.get(key);
      if (!res) {
        res = generate(spec.field, spec.seed + k, grid.cols, grid.rows, gridAspect);
        state.fieldCache.set(key, res);
        if (state.fieldCache.size > 40) state.fieldCache.delete(state.fieldCache.keys().next().value);
      }
      if (!gate || res.ok) { spec.seed += k; rejected = k; break; }
    }
    draw(ctx, grid, res.v, { renderer: spec.renderer, palette: spec.palette, paletteSeed: spec.seed });
    state.current = { spec, desc: res.desc, grid, stats: stats(res.v), rejected };
    showInfo();
    writeHash(spec);
  } catch (e) {
    console.error(e);
    toast(`${t("error")} ${e.message}`, true);
  } finally {
    $("busy").hidden = true;
  }
}

function showInfo() {
  const { spec, desc, grid, rejected } = state.current;
  $("info").textContent = [
    L(desc),
    `${L(RENDERERS[spec.renderer])} · ${L(PALETTE_LABELS[spec.palette])}`,
    `${t("grid")} ${grid.cols}×${grid.rows} · ${t("pitch")} ${spec.pitch} px`,
    `seed ${spec.seed}${rejected ? ` · ${t("rejected", rejected)}` : ""}`,
    `${state.pos + 1} / ${state.history.length}`,
  ].join("\n");
}

// ─── Shuffle et historique ───────────────────────────────────────────────

function resolveSpec(seed) {
  const c = state.choice, rc = mulberry32(seed ^ 0x5bd1e995), [W, H] = screenWH();
  const pitches = pitchesFor(W, H);
  return {
    seed, W, H,
    field: c.source === "hasard" ? pickWeighted(rc, weighted(FIELD_IDS, FIELD_WEIGHTS)) : c.source,
    renderer: c.renderer === "hasard" ? pick(rc, Object.keys(RENDERERS)) : c.renderer,
    pitch: c.pitchRandom ? pick(rc, pitches.filter((p) => p >= 10 && p <= 48)) : snapPitch(c.pitch, pitches),
    palette: c.palette === "hasard" ? pickWeighted(rc, weighted(PALETTES, PALETTE_WEIGHTS)) : c.palette,
  };
}

async function shuffle() {
  const spec = resolveSpec((Math.random() * 2 ** 31) >>> 0);
  state.history = state.history.slice(0, state.pos + 1);
  state.history.push(spec);
  if (state.history.length > 200) state.history.shift();
  state.pos = state.history.length - 1;
  await render(spec, { gate: true });
  syncControls();
}

async function go(delta) {
  const p = state.pos + delta;
  if (p < 0 || p >= state.history.length) return;
  state.pos = p;
  await render(state.history[p]);
  syncControls();
}

// Modifie la spec courante (même seed) — pour comparer rendus, densités, palettes.
async function tweak(changes) {
  if (!state.current) return shuffle();
  const spec = { ...state.current.spec, ...changes };
  state.history[state.pos] = spec;
  await render(spec);
  syncControls();
}

function snapPitch(p, list) {
  return list.reduce((best, x) => (Math.abs(x - p) < Math.abs(best - p) ? x : best), list[0]);
}

// ─── Garder / appliquer ──────────────────────────────────────────────────

async function save(kind) {
  if (!state.current) return;
  const { spec, desc, grid, stats: st } = state.current;
  const params = {
    name: `mosaique-${spec.field}-${spec.renderer}-${spec.palette}-${spec.seed}-${spec.W}x${spec.H}`,
    seed: spec.seed, source: spec.field, rendu: spec.renderer, palette: spec.palette, pas: spec.pitch,
    ecran: `${spec.W}x${spec.H}`, grille: `${grid.cols}x${grid.rows}`, description: L(desc),
    stats: { moyenne: +st.mean.toFixed(3), ecart: +st.std.toFixed(3), visible: +st.visible.toFixed(3) },
    choix: { ...state.choice },
  };
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  try {
    const r = await fetch(`/api/${kind}`, { method: "POST", body: blob, headers: { "X-Params": encodeURIComponent(JSON.stringify(params)) } });
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || r.status);
    toast(kind === "keep" ? `${t("kept")} ${res.path.split("/").pop()}` : t("applied"));
  } catch (e) { toast(`${t("failed")} ${e.message}`, true); }
}

// ─── URL (reproductibilité) ──────────────────────────────────────────────

function writeHash(spec) {
  history.replaceState(null, "", `#${new URLSearchParams({ seed: spec.seed, source: spec.field, rendu: spec.renderer, pas: spec.pitch, palette: spec.palette })}`);
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const field = h.get("source"), palette = h.get("palette");
  if (!h.get("seed") || !(field in FIELDS)) return null; // les champs archivés ne se rejouent plus
  const [W, H] = screenWH();
  return {
    seed: +h.get("seed"), field, W, H,
    renderer: h.get("rendu") in RENDERERS ? h.get("rendu") : "cercles",
    pitch: snapPitch(+h.get("pas") || 24, pitchesFor(W, H)),
    palette: PALETTES.includes(palette) ? palette : "glace",
  };
}

// ─── Contrôles ───────────────────────────────────────────────────────────

function buildControls() {
  const star = (id, weights) => ((weights[id] ?? 1) > 1 ? " ★" : "");
  $("source").innerHTML = `<option value="hasard">${t("randomPrefs")}</option>` +
    FIELD_IDS.map((id) => `<option value="${id}">${L(FIELDS[id].label)}${star(id, FIELD_WEIGHTS)}</option>`).join("");

  $("renderer").innerHTML = [["hasard", t("randomShort")], ...Object.entries(RENDERERS).map(([id, l]) => [id, L(l)])]
    .map(([id, l]) => `<button data-r="${id}">${l}</button>`).join("");

  const popt = (id) => `<option value="${id}">${L(PALETTE_LABELS[id])}${star(id, PALETTE_WEIGHTS)}</option>`;
  $("palette").innerHTML = `<option value="hasard">${t("randomPrefPalettes")}</option>` +
    `<optgroup label="${t("groupSpectral")}">${SPECTRAL_PALETTES.map(popt).join("")}</optgroup>` +
    `<optgroup label="${t("groupCold")}">${COLD_PALETTES.map(popt).join("")}</optgroup>`;

  $("lang").textContent = lang === "fr" ? "EN" : "FR";
  applyStatic();
}

function bindControls() {
  $("screen").innerHTML = state.screens.map((s, i) => `<option value="${i}">${s.name} · ${s.width}×${s.height}</option>`).join("");
  $("lang").onclick = () => {
    setLang(lang === "fr" ? "en" : "fr");
    buildControls(); syncControls();
    if (state.current) showInfo();
  };
  $("source").onchange = () => { state.choice.source = $("source").value; $("source").blur(); shuffle(); };
  $("renderer").onclick = (e) => {
    const r = e.target.dataset?.r; if (!r) return;
    state.choice.renderer = r;
    if (r === "hasard") return syncControls();
    tweak({ renderer: r });
  };
  $("pitch").oninput = () => {
    const [W, H] = screenWH(), p = pitchesFor(W, H)[+$("pitch").value];
    state.choice.pitch = p; state.choice.pitchRandom = false;
    updatePitchLabel(p);
  };
  $("pitch").onchange = () => tweak({ pitch: state.choice.pitch });
  $("pitchRandom").onchange = () => { state.choice.pitchRandom = $("pitchRandom").checked; $("pitchRandom").blur(); };
  $("palette").onchange = () => {
    const p = $("palette").value; $("palette").blur();
    state.choice.palette = p;
    if (p !== "hasard") tweak({ palette: p });
  };
  $("screen").onchange = () => {
    state.screen = +$("screen").value; $("screen").blur();
    const [W, H] = screenWH();
    tweak({ W, H, pitch: snapPitch(state.current?.spec.pitch ?? state.choice.pitch, pitchesFor(W, H)) });
  };
  $("shuffle").onclick = shuffle;
  $("prev").onclick = () => go(-1);
  $("next").onclick = () => go(1);
  $("keep").onclick = () => save("keep");
  $("apply").onclick = () => save("apply");

  addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Space") { e.preventDefault(); shuffle(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "k" || e.key === "K") save("keep");
    else if (e.key === "a" || e.key === "A") save("apply");
  });
}

function updatePitchLabel(p) {
  const [W, H] = screenWH();
  const renderer = state.current?.spec.renderer ?? "cercles";
  const g = makeGrid(renderer, W, H, p, ctx);
  $("pitchLabel").textContent = `${p} px · ${g.cols}×${g.rows}`;
}

function syncControls() {
  const c = state.choice, spec = state.current?.spec;
  $("source").value = c.source;
  for (const b of $("renderer").children) b.classList.toggle("on", b.dataset.r === c.renderer);
  const [W, H] = screenWH(), pitches = pitchesFor(W, H);
  const p = spec?.pitch ?? snapPitch(c.pitch, pitches);
  $("pitch").max = pitches.length - 1;
  $("pitch").value = pitches.indexOf(p);
  $("pitchRandom").checked = c.pitchRandom;
  updatePitchLabel(p);
  $("palette").value = c.palette;
  $("screen").value = state.screen;
}

// ─── Démarrage ───────────────────────────────────────────────────────────

async function main() {
  try { state.screens = await (await fetch("/api/screens")).json(); }
  catch { state.screens = [{ name: "default", width: 3840, height: 2160 }]; }
  state.screen = state.screens.reduce((b, s, i, a) => (s.width * s.height > a[b].width * a[b].height ? i : b), 0);
  await prepareAscii();
  buildControls();
  bindControls();
  syncControls();
  const fromHash = readHash();
  if (fromHash) {
    state.history = [fromHash]; state.pos = 0;
    await render(fromHash);
    syncControls();
  } else {
    await shuffle();
  }
}
main();
