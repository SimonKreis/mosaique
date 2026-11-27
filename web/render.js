// Rendus : la valeur de chaque cellule (0–1) devient un cercle, un carré,
// un pixel ou un caractère. La grille est calée sur la résolution de l'écran.

import { mulberry32 } from "./fields.js";

// Dégradés spectraux documentés : viridis, plasma, magma, inferno (van der Walt
// et Smith, matplotlib 2015) et turbo (Mikhailov, Google 2019), échantillonnés.
// Cubehelix (Green, 2011) est calculé : une famille infinie de dégradés
// multicolores, du noir au blanc, tirée par la seed.
export const PALETTES = {
  cubehelix: null,
  spectre: ["#1a0b3a", "#3b4cc0", "#20b2aa", "#9be15d", "#ffd23f", "#ff6b6b"],
  turbo: ["#30123b", "#4145ab", "#4675ed", "#39a2fc", "#1bcfd4", "#24eca6", "#61fc6c", "#a4fc3b", "#d1e834", "#f3c63a", "#fe9b2d", "#f36315", "#d93806", "#b11901", "#7a0402"],
  viridis: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
  plasma: ["#0d0887", "#46039f", "#7201a8", "#9c179e", "#bd3786", "#d8576b", "#ed7953", "#fb9f3a", "#fdca26", "#f0f921"],
  magma: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#fd9668", "#feca8d", "#fcfdbf"],
  inferno: ["#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"],
  glace: ["#040817", "#0b2a6f", "#1e6fd9", "#34d1f0", "#c9f6ff", "#ffffff"],
  abysse: ["#01040a", "#03122b", "#08305a", "#0f5c86", "#3aa0c8", "#bfe9ff"],
  givre: ["#05070a", "#1b2430", "#3d5266", "#7d97ad", "#c8d8e6", "#f4f9ff"],
  polaire: ["#03030f", "#121244", "#25358a", "#2f7fc4", "#6fd3e8", "#e6fbff"],
  aurore: ["#04101a", "#0d3b66", "#1e9e8f", "#6ff0c0", "#e8ffe8"],
};
export const PALETTE_LABELS = {
  cubehelix: { fr: "Cubehelix (auto)", en: "Cubehelix (auto)" }, turbo: { fr: "Turbo", en: "Turbo" },
  viridis: { fr: "Viridis", en: "Viridis" }, plasma: { fr: "Plasma", en: "Plasma" }, magma: { fr: "Magma", en: "Magma" },
  inferno: { fr: "Inferno", en: "Inferno" },
  glace: { fr: "Glace", en: "Ice" }, abysse: { fr: "Abysse", en: "Abyss" }, givre: { fr: "Givre", en: "Frost" },
  polaire: { fr: "Polaire", en: "Polar" }, aurore: { fr: "Aurore", en: "Aurora" },
  spectre: { fr: "Spectre", en: "Spectrum" },
};
export const SPECTRAL_PALETTES = ["cubehelix", "spectre", "turbo", "viridis", "plasma", "magma", "inferno"];
export const COLD_PALETTES = ["glace", "abysse", "givre", "polaire", "aurore"];
export const RENDERERS = { cercles: { fr: "Cercles", en: "Circles" }, carres: { fr: "Carrés", en: "Squares" }, pixels: { fr: "Pixels", en: "Pixels" }, ascii: { fr: "ASCII", en: "ASCII" } };

const FONT = '"JetBrainsMono Nerd Font", "JetBrains Mono", monospace';
const LEVELS = 6; // niveaux de taille pour cercles et carrés

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// Cubehelix (Green 2011) : une hélice autour de la diagonale noir → blanc du cube RGB.
// La luminosité croît toujours ; la seed fixe la teinte de départ, le nombre de
// tours et la saturation.
export function cubehelixParams(seed) {
  const r = mulberry32((seed ^ 0x2c1b3c6d) >>> 0);
  return { start: r() * 3, rot: (r() < 0.5 ? -1 : 1) * (1 + r() * 1.5), hue: 1.5 + r(), gamma: 0.55 + r() * 0.3 };
}
function cubehelix({ start, rot, hue, gamma }) {
  const out = [];
  for (let i = 0; i < 256; i++) {
    const l = Math.pow(i / 255, gamma), phi = 2 * Math.PI * (start / 3 + rot * (i / 255)), a = (hue * l * (1 - l)) / 2;
    const c = Math.cos(phi), s = Math.sin(phi);
    out.push([l + a * (-0.14861 * c + 1.78277 * s), l + a * (-0.29227 * c - 0.90649 * s), l + a * (1.97294 * c)]
      .map((x) => Math.round(255 * Math.min(1, Math.max(0, x)))));
  }
  return out;
}

const lutCache = {};
function lut(name, seed = 0) {
  if (name === "cubehelix") {
    const key = `cubehelix:${seed}`;
    return lutCache[key] ?? (lutCache[key] = cubehelix(cubehelixParams(seed)));
  }
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
  const { renderer, palette } = opts;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { cols, rows, cellW, cellH, ox, oy } = grid;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const pal = lut(palette, opts.paletteSeed);
  const colorAt = (idx, val, dim = 1) => {
    const [r, g, b] = pal[Math.round(val * 255)];
    return `rgb(${Math.round(r * dim)},${Math.round(g * dim)},${Math.round(b * dim)})`;
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
