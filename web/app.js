import { FIELDS, FIELD_IDS, ALLOVER_IDS, generate, stats, normalize, mulberry32, pick, pickWeighted } from "./fields.js";
import { PALETTES, PALETTE_LABELS, COLD_PALETTES, RENDERERS, pitchesFor, makeGrid, draw, sampleImage, prepareAscii } from "./render.js";
import { lang, setLang, L, t, applyStatic } from "./i18n.js";

// Préférences : froid et all-over. Encre et Glace, les favoris, pèsent double au tirage.
const FAVORITE = { field: "encre", palette: "glace" };
const weighted = (ids, fav) => ids.map((id) => [id, id === fav ? 2 : 1]);

const $ = (id) => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const isImageSource = (f) => f === "tableau" || f === "image";

const state = {
  screens: [],
  screen: 0,
  // Choix de l'utilisateur : "hasard" = retiré à chaque shuffle ; sinon verrouillé.
  choice: { source: "allover", renderer: "cercles", pitch: 24, pitchRandom: false, palette: "froides" },
  spec: null,
  current: null,
  history: [],
  pos: -1,
  userImage: null,
  userImageName: "",
  fieldCache: new Map(),
  artCache: new Map(),
};

const screenWH = () => { const s = state.screens[state.screen]; return [s.width, s.height]; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function toast(msg, error = false) {
  const t = $("toast"); t.textContent = msg; t.className = error ? "error" : "";
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.textContent = ""), 5000);
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function getArtwork(seed) {
  if (state.artCache.has(seed)) return state.artCache.get(seed);
  const r = await fetch(`/api/artwork?seed=${seed}`), art = await r.json();
  if (art.error) throw new Error(art.error);
  art.img = await loadImage(art.image);
  delete art.image;
  state.artCache.set(seed, art);
  return art;
}

// ─── Rendu d'une spec ────────────────────────────────────────────────────

async function render(spec, { gate = false } = {}) {
  $("busy").hidden = false;
  await nextFrame();
  try {
    if (canvas.width !== spec.W || canvas.height !== spec.H) { canvas.width = spec.W; canvas.height = spec.H; }
    const grid = makeGrid(spec.renderer, spec.W, spec.H, spec.pitch, ctx);
    const gridAspect = (grid.cols * grid.cellW) / (grid.rows * grid.cellH);
    let v, colors = null, desc, rejected = 0;

    if (isImageSource(spec.field)) {
      let img;
      if (spec.field === "tableau") {
        const art = await getArtwork(spec.seed);
        img = art.img;
        spec.art = { id: art.id, title: art.title, artist: art.artist, date: art.date };
        desc = `${t("paintingDesc")} · ${art.title}\n${art.artist}`;
      } else {
        if (!state.userImage) { $("file").click(); return; }
        img = state.userImage;
        desc = `${t("imageDesc")} · ${state.userImageName}`;
      }
      ({ v, colors } = sampleImage(img, grid.cols, grid.rows, gridAspect));
      normalize(v, false, 1);
    } else {
      let seed = spec.seed, res;
      for (let k = 0; k < (gate ? 15 : 1); k++) {
        const key = `${spec.field}|${seed + k}|${grid.cols}|${grid.rows}`;
        res = state.fieldCache.get(key);
        if (!res) {
          res = generate(spec.field, seed + k, grid.cols, grid.rows, gridAspect);
          state.fieldCache.set(key, res);
          if (state.fieldCache.size > 40) state.fieldCache.delete(state.fieldCache.keys().next().value);
        }
        if (!gate || res.ok) { spec.seed = seed + k; rejected = k; break; }
      }
      v = res.v; desc = res.desc;
    }

    draw(ctx, grid, v, { renderer: spec.renderer, palette: spec.palette, colors });
    state.current = { spec, desc, grid, stats: stats(v), rejected };
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
  const lines = [
    L(desc),
    `${L(RENDERERS[spec.renderer])} · ${L(PALETTE_LABELS[spec.palette])}`,
    `${t("grid")} ${grid.cols}×${grid.rows} · ${t("pitch")} ${spec.pitch} px`,
    `seed ${spec.seed}${rejected ? ` · ${t("rejected", rejected)}` : ""}`,
    `${state.pos + 1} / ${state.history.length}`,
  ];
  $("info").textContent = lines.join("\n");
}

// ─── Shuffle et historique ───────────────────────────────────────────────

function resolveSpec(seed) {
  const c = state.choice, rc = mulberry32(seed ^ 0x5bd1e995), [W, H] = screenWH();
  const field = c.source === "allover" ? pickWeighted(rc, weighted(ALLOVER_IDS, FAVORITE.field))
    : c.source === "hasard" ? pick(rc, FIELD_IDS) : c.source;
  const renderer = c.renderer === "hasard" ? pick(rc, Object.keys(RENDERERS)) : c.renderer;
  const pitches = pitchesFor(W, H);
  const pitch = c.pitchRandom ? pick(rc, pitches.filter((p) => p >= 10 && p <= 48)) : snapPitch(c.pitch, pitches);
  let palette = c.palette;
  if (palette === "froides") palette = pickWeighted(rc, weighted(COLD_PALETTES, FAVORITE.palette));
  if (palette === "hasard") palette = isImageSource(field) && rc() < 0.5 ? "image" : pick(rc, Object.keys(PALETTES));
  if (palette === "image" && !isImageSource(field)) palette = pick(rc, Object.keys(PALETTES));
  return { seed, field, renderer, pitch, palette, W, H };
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
  if (spec.palette === "image" && !isImageSource(spec.field)) spec.palette = "lune";
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
  const tag = spec.field === "tableau" ? `tableau${spec.art?.id ?? ""}` : spec.field;
  const name = `mosaique-${tag}-${spec.renderer}-${spec.palette}-${spec.seed}-${spec.W}x${spec.H}`;
  const params = {
    name, seed: spec.seed, source: spec.field, rendu: spec.renderer, palette: spec.palette, pas: spec.pitch,
    ecran: `${spec.W}x${spec.H}`, grille: `${grid.cols}x${grid.rows}`, description: L(desc).replace("\n", " — "),
    stats: { moyenne: +st.mean.toFixed(3), ecart: +st.std.toFixed(3), visible: +st.visible.toFixed(3) },
    choix: { ...state.choice }, oeuvre: spec.art ?? null, image: spec.field === "image" ? state.userImageName : null,
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
  if (spec.field === "image") return;
  history.replaceState(null, "", `#${new URLSearchParams({ seed: spec.seed, source: spec.field, rendu: spec.renderer, pas: spec.pitch, palette: spec.palette })}`);
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.get("seed")) return null;
  const [W, H] = screenWH(), field = h.get("source");
  if (!(field in FIELDS) && field !== "tableau") return null;
  return { seed: +h.get("seed"), field, renderer: h.get("rendu") || "cercles", pitch: snapPitch(+h.get("pas") || 24, pitchesFor(W, H)), palette: h.get("palette") || "glace", W, H };
}

// ─── Contrôles ───────────────────────────────────────────────────────────

function buildControls() {
  const src = $("source");
  const star = (id, fav) => (id === fav ? " ★" : "");
  const opt = (id) => `<option value="${id}">${L(FIELDS[id].label)}${star(id, FAVORITE.field)}</option>`;
  src.innerHTML =
    `<optgroup label="${t("groupPrefSources")}"><option value="allover">${t("randomAllover")}</option>${ALLOVER_IDS.map(opt).join("")}</optgroup>` +
    `<optgroup label="${t("groupOther")}"><option value="hasard">${t("randomAllFields")}</option>${FIELD_IDS.filter((id) => !FIELDS[id].allOver).map(opt).join("")}</optgroup>` +
    `<optgroup label="${t("groupImages")}"><option value="tableau">${t("painting")}</option><option value="image">${t("myImage")}</option></optgroup>`;

  const seg = $("renderer");
  seg.innerHTML = [["hasard", t("randomShort")], ...Object.entries(RENDERERS).map(([id, l]) => [id, L(l)])].map(([id, l]) => `<button data-r="${id}">${l}</button>`).join("");

  const popt = (id) => `<option value="${id}">${L(PALETTE_LABELS[id])}${star(id, FAVORITE.palette)}</option>`;
  $("palette").innerHTML =
    `<optgroup label="${t("groupPrefPalettes")}"><option value="froides">${t("randomCold")}</option>${COLD_PALETTES.map(popt).join("")}</optgroup>` +
    `<optgroup label="${t("groupOther")}"><option value="hasard">${t("randomAll")}</option>${Object.keys(PALETTE_LABELS).filter((id) => !COLD_PALETTES.includes(id)).map(popt).join("")}</optgroup>`;

  $("lang").textContent = lang === "fr" ? "EN" : "FR";
  applyStatic();
}

function bindControls() {
  const src = $("source"), seg = $("renderer");
  $("lang").onclick = () => {
    setLang(lang === "fr" ? "en" : "fr");
    buildControls(); syncControls();
    if (state.current) showInfo();
  };

  $("screen").innerHTML = state.screens.map((s, i) => `<option value="${i}">${s.name} · ${s.width}×${s.height}</option>`).join("");

  src.onchange = () => {
    src.blur();
    if (src.value === "image" && !state.userImage) return $("file").click();
    state.choice.source = src.value;
    shuffle();
  };
  seg.onclick = (e) => {
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
    if (p !== "hasard" && p !== "froides") tweak({ palette: p });
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
  $("file").onchange = () => { const f = $("file").files[0]; if (f) useUserImage(f); $("file").value = ""; };

  addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Space") { e.preventDefault(); shuffle(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "k" || e.key === "K") save("keep");
    else if (e.key === "a" || e.key === "A") save("apply");
  });

  const drop = $("drop");
  addEventListener("dragover", (e) => { e.preventDefault(); drop.hidden = false; });
  addEventListener("dragleave", (e) => { if (!e.relatedTarget) drop.hidden = true; });
  addEventListener("drop", (e) => {
    e.preventDefault(); drop.hidden = true;
    const f = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (f) useUserImage(f);
  });
}

async function useUserImage(file) {
  try {
    state.userImage = await loadImage(URL.createObjectURL(file));
    state.userImageName = file.name;
    state.choice.source = "image";
    await shuffle();
  } catch { toast(t("badImage"), true); }
}

function updatePitchLabel(p) {
  const [W, H] = screenWH();
  const renderer = state.current?.spec.renderer ?? "cercles";
  const g = makeGrid(renderer === "hasard" ? "cercles" : renderer, W, H, p, ctx);
  $("pitchLabel").textContent = `${p} px · ${g.cols}×${g.rows}`;
}

function syncControls() {
  const c = state.choice, spec = state.current?.spec;
  $("source").value = c.source;
  for (const b of $("renderer").children) b.classList.toggle("on", b.dataset.r === c.renderer || (c.renderer === "hasard" && b.dataset.r === "hasard"));
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
  catch { state.screens = [{ name: "défaut", width: 3840, height: 2160 }]; }
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
