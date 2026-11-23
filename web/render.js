// Rendus : la valeur de chaque cellule (0–1) devient un cercle, un carré,
// un pixel ou un caractère. La grille est calée sur la résolution de l'écran.

// Palettes froides d'abord (les préférées), puis les autres.
export const PALETTES = {
  glace: ["#040817", "#0b2a6f", "#1e6fd9", "#34d1f0", "#c9f6ff", "#ffffff"],
  abysse: ["#01040a", "#03122b", "#08305a", "#0f5c86", "#3aa0c8", "#bfe9ff"],
  givre: ["#05070a", "#1b2430", "#3d5266", "#7d97ad", "#c8d8e6", "#f4f9ff"],
  polaire: ["#03030f", "#121244", "#25358a", "#2f7fc4", "#6fd3e8", "#e6fbff"],
  aurore: ["#04101a", "#0d3b66", "#1e9e8f", "#6ff0c0", "#e8ffe8"],
  braise: ["#0a0410", "#3b0f4f", "#9c2a5b", "#f0703a", "#ffd27a", "#fff4d6"],
  nebuleuse: ["#07041a", "#2a1a6e", "#6a2fb0", "#d04fd0", "#ff9ee0", "#fff0fa"],
  phosphore: ["#021006", "#064d1a", "#12a33a", "#4dff7a", "#d6ffe0"],
  lune: ["#101010", "#3a3a3a", "#8a8a8a", "#d0d0d0", "#ffffff"],
  spectre: ["#1a0b3a", "#3b4cc0", "#20b2aa", "#9be15d", "#ffd23f", "#ff6b6b"],
};
export const PALETTE_LABELS = {
  glace: { fr: "Glace", en: "Ice" }, abysse: { fr: "Abysse", en: "Abyss" }, givre: { fr: "Givre", en: "Frost" },
  polaire: { fr: "Polaire", en: "Polar" }, aurore: { fr: "Aurore", en: "Aurora" }, braise: { fr: "Braise", en: "Ember" },
  nebuleuse: { fr: "Nébuleuse", en: "Nebula" }, phosphore: { fr: "Phosphore", en: "Phosphor" }, lune: { fr: "Lune", en: "Moon" },
  spectre: { fr: "Spectre", en: "Spectrum" }, image: { fr: "Couleurs de l'image", en: "Image colours" },
};
export const COLD_PALETTES = ["glace", "abysse", "givre", "polaire", "aurore"];
export const RENDERERS = { cercles: { fr: "Cercles", en: "Circles" }, carres: { fr: "Carrés", en: "Squares" }, pixels: { fr: "Pixels", en: "Pixels" }, ascii: { fr: "ASCII", en: "ASCII" } };

const FONT = '"JetBrainsMono Nerd Font", "JetBrains Mono", monospace';
const LEVELS = 6; // niveaux de taille pour cercles et carrés

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

const lutCache = {};
function lut(name) {
  if (lutCache[name]) return lutCache[name];
  const stops = PALETTES[name].map(hexToRgb), out = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
    const c = stops[k].map((a, ch) => Math.round(a + (stops[k + 1][ch] - a) * f));
    out.push(c);
  }
  return (lutCache[name] = out);
}

// Diviseurs du PGCD de la résolution : la grille tombe juste, sans cellule coupée.
export function pitchesFor(W, H) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a), g = gcd(W, H), out = [];
  for (let d = 6; d <= 96; d++) if (g % d === 0) out.push(d);
  return out.length ? out : [8, 12, 16, 24, 32, 48];
}

let advanceCache = {};
export function makeGrid(renderer, W, H, pitch, ctx) {
  if (renderer === "ascii") {
    const fontSize = pitch;
    if (!advanceCache[fontSize]) { ctx.font = `${fontSize}px ${FONT}`; advanceCache[fontSize] = ctx.measureText("M").width; }
    const cellW = advanceCache[fontSize], cellH = pitch;
    const cols = Math.floor(W / cellW), rows = Math.floor(H / cellH);
    return { cols, rows, cellW, cellH, ox: (W - cols * cellW) / 2, oy: (H - rows * cellH) / 2, fontSize };
  }
  const cols = Math.floor(W / pitch), rows = Math.floor(H / pitch);
  return { cols, rows, cellW: pitch, cellH: pitch, ox: (W - cols * pitch) / 2, oy: (H - rows * pitch) / 2 };
}

// Rampe ASCII : caractères triés selon leur surface d'encre réelle dans la police.
let ramp = null;
const ASCII_LEVELS = 14;
export async function prepareAscii() {
  try { await document.fonts.load(`48px ${FONT}`); } catch {}
  const size = 48, c = document.createElement("canvas"), x = c.getContext("2d", { willReadFrequently: true });
  x.font = `${size}px ${FONT}`;
  const cw = Math.ceil(x.measureText("M").width), ch = size;
  c.width = cw; c.height = ch;
  const chars = [];
  for (let code = 33; code < 127; code++) {
    const s = String.fromCharCode(code);
    // Symboles seulement : une rampe sans lettres reste lisible comme texture.
    if ("`_'\",".includes(s) || /[A-Za-z0-9]/.test(s)) continue;
    x.clearRect(0, 0, cw, ch); x.font = `${size}px ${FONT}`; x.fillStyle = "#fff";
    x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, cw / 2, ch / 2);
    const d = x.getImageData(0, 0, cw, ch).data;
    let ink = 0; for (let i = 3; i < d.length; i += 4) ink += d[i];
    chars.push([s, ink]);
  }
  const max = Math.max(...chars.map((c) => c[1]));
  ramp = [" "];
  for (let l = 1; l < ASCII_LEVELS; l++) {
    const target = (l / (ASCII_LEVELS - 1)) * max;
    let best = chars[0];
    for (const c of chars) if (Math.abs(c[1] - target) < Math.abs(best[1] - target)) best = c;
    ramp.push(best[0]);
  }
  return ramp;
}

export function draw(ctx, grid, v, opts) {
  const { renderer, palette, colors } = opts;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { cols, rows, cellW, cellH, ox, oy } = grid;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const pal = palette === "image" && colors ? null : lut(palette === "image" ? "lune" : palette);
  const boost = renderer !== "pixels";
  const colorAt = (idx, val, dim = 1) => {
    let r, g, b;
    if (pal) [r, g, b] = pal[Math.round(val * 255)];
    else {
      r = colors[idx * 3]; g = colors[idx * 3 + 1]; b = colors[idx * 3 + 2];
      // La taille porte déjà la luminosité : on éclaircit la teinte pour ne pas l'assombrir deux fois.
      if (boost) { const f = Math.min(2.5, 235 / Math.max(r, g, b, 1)); r *= f; g *= f; b *= f; }
    }
    return `rgb(${Math.min(255, Math.round(r * dim))},${Math.min(255, Math.round(g * dim))},${Math.min(255, Math.round(b * dim))})`;
  };

  if (renderer === "ascii") {
    ctx.font = `${grid.fontSize}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const idx = j * cols + i, val = v[idx];
      const level = Math.min(ASCII_LEVELS - 1, Math.floor(val * ASCII_LEVELS));
      if (level === 0) continue;
      ctx.fillStyle = colorAt(idx, val);
      ctx.fillText(ramp[level], ox + (i + 0.5) * cellW, oy + (j + 0.5) * cellH);
    }
    return;
  }

  if (renderer === "pixels") {
    const steps = 8;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const idx = j * cols + i, val = Math.round(v[idx] * (steps - 1)) / (steps - 1);
      if (val === 0 && pal) continue;
      ctx.fillStyle = colorAt(idx, val);
      ctx.fillRect(ox + i * cellW, oy + j * cellH, cellW, cellH);
    }
    return;
  }

  const p = cellW;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const idx = j * cols + i, val = v[idx];
    const q = Math.min(LEVELS - 1, Math.floor(val * LEVELS));
    const cx = ox + (i + 0.5) * p, cy = oy + (j + 0.5) * p;
    // Niveau 0 : un point minuscule et atténué, pour que la grille reste lisible.
    const size = q === 0 ? 0.07 : 0.14 + (0.84 * q) / (LEVELS - 1); // fraction du pas
    ctx.fillStyle = colorAt(idx, val, q === 0 ? 0.7 : 1);
    if (renderer === "carres") {
      const s = size * p * 0.92;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, (size * p) / 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Échantillonne une image (tableau ou image perso) sur la grille, en remplissage centré.
export function sampleImage(img, cols, rows, gridAspect) {
  const c = document.createElement("canvas"); c.width = cols; c.height = rows;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  const ia = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ia > gridAspect) { sw = sh * gridAspect; sx = (img.naturalWidth - sw) / 2; }
  else { sh = sw / gridAspect; sy = (img.naturalHeight - sh) / 2; }
  // Réduction progressive pour éviter le crénelage des grandes images.
  let src = img, w = sw, h = sh, cx = sx, cy = sy;
  while (w / 2 > cols * 2) {
    const t = document.createElement("canvas"); t.width = Math.round(w / 2); t.height = Math.round(h / 2);
    const tx = t.getContext("2d"); tx.imageSmoothingQuality = "high";
    tx.drawImage(src, cx, cy, w, h, 0, 0, t.width, t.height);
    src = t; w = t.width; h = t.height; cx = 0; cy = 0;
  }
  x.drawImage(src, cx, cy, w, h, 0, 0, cols, rows);
  const d = x.getImageData(0, 0, cols, rows).data;
  const v = new Float32Array(cols * rows), colors = new Uint8ClampedArray(cols * rows * 3);
  for (let i = 0; i < cols * rows; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    v[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return { v, colors };
}
