// Mosaïque — sources de champ.
//
// Règle unique du projet : chaque champ est un CHAMP ALÉATOIRE STATIONNAIRE,
// ISOTROPE ET ERGODIQUE (mélangeant). Sa loi ne dépend ni de la position ni de
// l'orientation, et deux régions éloignées sont statistiquement indépendantes.
// Le critère s'applique au modèle mathématique (en espace continu) ; la grille
// de calcul n'en est qu'une approximation. Voir docs/METHODE.md.
//
// Chaque champ produit une grille de valeurs brutes ; generate() la ramène à la
// grille d'affichage puis la normalise dans [0, 1].
// Coordonnées physiques : x ∈ [-aspect, aspect], y ∈ [-1, 1] (y vers le bas).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rnd = (rng, a, b) => a + (b - a) * rng();
export const rndInt = (rng, a, b) => Math.floor(rnd(rng, a, b + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
// items : [[valeur, poids], …]
export function pickWeighted(rng, items) {
  let r = rng() * items.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of items) if ((r -= w) < 0) return v;
  return items[items.length - 1][0];
}
const TAU = Math.PI * 2;

// Grille de simulation plafonnée, aux proportions de la grille d'affichage.
function simSize(cols, rows, maxW) {
  const w = Math.min(cols * 2, maxW);
  return [w, Math.max(2, Math.round((w * rows) / cols))];
}

function analytic(cols, rows, aspect, ss, fn) {
  const w = cols * ss, h = rows * ss, data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = ((j + 0.5) / h) * 2 - 1;
    for (let i = 0; i < w; i++) data[j * w + i] = fn((((i + 0.5) / w) * 2 - 1) * aspect, y);
  }
  return { w, h, data };
}

// ─── Brique commune : champ gaussien stationnaire et isotrope ────────────
// Modèle des ondes aléatoires (Longuet-Higgins 1957 ; Berry 1977) : somme
// d'ondes planes de directions et de phases uniformes. Les nombres d'onde sont
// tirés en log-uniforme sur chaque octave (spectre continu, donc ergodique) et
// l'amplitude suit une loi de puissance : densité spectrale P(k) ∝ k^−(2H+2).
// H est l'exposant de Hurst ; H = 1 correspond au fBm classique (gain 1/2 par octave).
function randomField(rng, { k0, octaves, H, perOctave = 14 }) {
  const n = octaves * perOctave, kx = new Float64Array(n), ky = new Float64Array(n), ph = new Float64Array(n), amp = new Float64Array(n);
  let sum2 = 0;
  for (let i = 0; i < n; i++) {
    const k = k0 * Math.pow(2, Math.floor(i / perOctave) + rng()), th = rng() * TAU;
    kx[i] = Math.cos(th) * k; ky[i] = Math.sin(th) * k; ph[i] = rng() * TAU;
    amp[i] = Math.pow(k / k0, -H); sum2 += amp[i] * amp[i];
  }
  const norm = Math.sqrt(2 / sum2); // variance 1
  for (let i = 0; i < n; i++) amp[i] *= norm;
  const f = (x, y) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += amp[i] * Math.cos(kx[i] * x + ky[i] * y + ph[i]);
    return s;
  };
  f.grad = (x, y) => {
    let gx = 0, gy = 0;
    for (let i = 0; i < n; i++) { const s = -amp[i] * Math.sin(kx[i] * x + ky[i] * y + ph[i]); gx += s * kx[i]; gy += s * ky[i]; }
    return [gx, gy];
  };
  // Écart-type de la dérivée seconde : sert à calibrer la focalisation des caustiques.
  f.curvatureRms = Math.sqrt(Array.from(amp).reduce((s, a, i) => s + (a * a * (kx[i] ** 2 + ky[i] ** 2) ** 2) / 2, 0));
  return f;
}

// Octaves entre une longueur d'onde de la hauteur de l'écran et ~2,5 cellules.
const octavesFor = (rows, kRatio = 1) => Math.max(2, Math.floor(Math.log2(rows / 2.5 / kRatio)));

function hash2(i, j, seed) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ─── Champs, dans l'ordre des préférences ────────────────────────────────

// Encre : déformation de domaine (Quilez) appliquée à des champs gaussiens
// isotropes ; une composition de champs stationnaires isotropes indépendants
// reste stationnaire et isotrope.
const encre = {
  label: { fr: "Encre", en: "Ink" },
  gen(rng, { cols, rows, aspect }) {
    const sc = rnd(rng, 0.8, 2.2), warp = rnd(rng, 1.5, 4.5), ridge = rng() < 0.4;
    const opt = { k0: (Math.PI / 2) * sc, octaves: 5, H: 1, perOctave: 10 };
    const [p, q1, q2, r1, r2] = Array.from({ length: 5 }, () => randomField(rng, opt));
    const A = 0.35; // amplitude comparable au fBm de Perlin (≈ ±0,6)
    const out = analytic(cols, rows, aspect, 1, (x, y) => {
      const qx = A * q1(x, y), qy = A * q2(x, y);
      const rx = A * r1(x + warp * qx, y + warp * qy), ry = A * r2(x + warp * qx + 5.2, y + warp * qy + 1.3);
      const v = A * p(x + warp * rx, y + warp * ry);
      return ridge ? 1 - Math.abs(v) * 2.2 : v;
    });
    return { ...out, zeroFloor: false, gamma: rnd(rng, 1.3, 2.4), desc: { fr: `Encre · déformation ${warp.toFixed(1)}${ridge ? " · crêtes" : ""}`, en: `Ink · warp ${warp.toFixed(1)}${ridge ? " · ridges" : ""}` } };
  },
};

// Flux : convolution intégrale linéaire (LIC) d'un bruit blanc le long du
// rotationnel d'un champ gaussien isotrope (écoulement sans divergence).
const flux = {
  label: { fr: "Flux", en: "Flow" },
  gen(rng, { cols, rows, aspect }) {
    const [w, h] = simSize(cols, rows, 480), k = w / 320;
    const sc = rnd(rng, 0.6, 1.6), L = Math.round(rnd(rng, 18, 40) * k), dens = rnd(rng, 0.06, 0.18);
    const field = randomField(rng, { k0: (Math.PI / 2) * sc, octaves: 4, H: 1, perOctave: 10 });
    const psi = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      psi[j * w + i] = field((((i + 0.5) / w) * 2 - 1) * aspect, ((j + 0.5) / h) * 2 - 1);
    const vx = new Float32Array(w * h), vy = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dy = psi[Math.min(h - 1, j + 1) * w + i] - psi[Math.max(0, j - 1) * w + i];
      const dx = psi[j * w + Math.min(w - 1, i + 1)] - psi[j * w + Math.max(0, i - 1)];
      const m = Math.hypot(dx, dy) || 1;
      vx[j * w + i] = dy / m; vy[j * w + i] = -dx / m; // perpendiculaire au gradient
    }
    const tex = new Float32Array(w * h);
    for (let i = 0; i < tex.length; i++) tex[i] = rng() < dens ? 1 : 0;
    const data = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let sum = tex[j * w + i], cnt = 1;
      for (const dir of [1, -1]) {
        let x = i + 0.5, y = j + 0.5;
        for (let s = 0; s < L; s++) {
          const idx = Math.floor(y) * w + Math.floor(x);
          x += vx[idx] * dir * 0.8; y += vy[idx] * dir * 0.8;
          if (x < 0 || x >= w || y < 0 || y >= h) break;
          sum += tex[Math.floor(y) * w + Math.floor(x)]; cnt++;
        }
      }
      data[j * w + i] = sum / cnt;
    }
    return { w, h, data, zeroFloor: false, gamma: rnd(rng, 0.9, 1.5), desc: { fr: `Flux · échelle ${sc.toFixed(2)} · traînées ${L}`, en: `Flow · scale ${sc.toFixed(2)} · trails ${L}` } };
  },
};

// Fractal 1/f : le champ gaussien isotrope lui-même (synthèse spectrale, Voss
// 1985). H est tiré pour que les lignes de niveau aient une dimension fractale
// D = 2 − H entre 1,3 et 1,5, la plage préférée mesurée par Spehar et al. (2003).
const fractal = {
  label: { fr: "Fractal 1/f", en: "1/f fractal" },
  gen(rng, { cols, rows, aspect }) {
    const D = rnd(rng, 1.3, 1.5), H = 2 - D;
    // Plus grande structure : une demi-hauteur d'écran, pour que l'écran contienne de nombreuses réalisations.
    const field = randomField(rng, { k0: TAU, octaves: octavesFor(rows, 2), H, perOctave: 14 });
    const out = analytic(cols, rows, aspect, 1, field);
    return { ...out, zeroFloor: false, gamma: rnd(rng, 1.3, 2.0), desc: { fr: `Fractal 1/f · dimension des contours ${D.toFixed(2)}`, en: `1/f fractal · contour dimension ${D.toFixed(2)}` } };
  },
};

// Caustiques : lumière réfractée par une mer aléatoire gaussienne isotrope
// (Longuet-Higgins 1957) ; les caustiques apparaissent quand la focalisation
// q = s · courbure rms approche 1 (Berry et Upstill 1980).
const caustiques = {
  label: { fr: "Caustiques", en: "Caustics" },
  gen(rng, { cols, rows, aspect }) {
    const [w, h] = simSize(cols, rows, 400);
    const sea = randomField(rng, { k0: TAU / rnd(rng, 0.5, 1.0), octaves: 3, H: 1, perOctave: 24 });
    const q = rnd(rng, 0.7, 1.4), s = q / sea.curvatureRms, data = new Float32Array(w * h);
    const ppc = 2, margin = 0.15, PW = Math.round(w * ppc * (1 + 2 * margin)), PH = Math.round(h * ppc * (1 + 2 * margin));
    for (let pj = 0; pj < PH; pj++) {
      const y = ((pj + 0.5) / PH * (1 + 2 * margin) - margin) * 2 - 1;
      for (let pi = 0; pi < PW; pi++) {
        const x = (((pi + 0.5) / PW * (1 + 2 * margin) - margin) * 2 - 1) * aspect;
        const [gx, gy] = sea.grad(x, y);
        const px = Math.floor((((x - s * gx) / aspect + 1) / 2) * w), py = Math.floor(((y - s * gy + 1) / 2) * h);
        if (px >= 0 && px < w && py >= 0 && py < h) data[py * w + px]++;
      }
    }
    for (let i = 0; i < data.length; i++) data[i] = Math.log1p(data[i]);
    return { w, h, data, zeroFloor: false, gamma: rnd(rng, 1.0, 1.5), desc: { fr: `Caustiques · focalisation ${q.toFixed(2)}`, en: `Caustics · focusing ${q.toFixed(2)}` } };
  },
};

// Turing : réaction-diffusion de Gray-Scott (Pearson 1993). Les équations sont
// invariantes par translation et rotation ; l'état initial est aléatoire et uniforme.
const turing = {
  label: { fr: "Turing", en: "Turing" },
  gen(rng, { aspect }) {
    const presets = [["mitose", 0.0367, 0.0649], ["corail", 0.0545, 0.062], ["vers", 0.078, 0.061],
      ["labyrinthe", 0.029, 0.057], ["taches", 0.035, 0.065], ["empreintes", 0.037, 0.06], ["ondulations", 0.026, 0.051]];
    const [name, F0, k0] = pick(rng, presets);
    const F = F0 + rnd(rng, -0.0015, 0.0015), K = k0 + rnd(rng, -0.0008, 0.0008);
    const h = rndInt(rng, 80, 130), w = Math.round(h * aspect), N = w * h;
    let U = new Float32Array(N).fill(1), V = new Float32Array(N);
    let U2 = new Float32Array(N), V2 = new Float32Array(N);
    const seeds = Math.max(6, Math.round(N / rnd(rng, 250, 900)));
    for (let s = 0; s < seeds; s++) {
      const cx = rndInt(rng, 0, w - 1), cy = rndInt(rng, 0, h - 1), r = rndInt(rng, 1, 3);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const idx = ((cy + dy + h) % h) * w + ((cx + dx + w) % w);
        U[idx] = 0.5; V[idx] = 0.25 + rng() * 0.05;
      }
    }
    const Du = 0.16, Dv = 0.08, iters = 4000;
    for (let it = 0; it < iters; it++) {
      for (let y = 0; y < h; y++) {
        const yu = ((y + h - 1) % h) * w, yd = ((y + 1) % h) * w, yc = y * w;
        for (let x = 0; x < w; x++) {
          const xl = (x + w - 1) % w, xr = (x + 1) % w, i = yc + x;
          const u = U[i], v = V[i], uvv = u * v * v;
          const lu = U[yu + x] + U[yd + x] + U[yc + xl] + U[yc + xr] - 4 * u;
          const lv = V[yu + x] + V[yd + x] + V[yc + xl] + V[yc + xr] - 4 * v;
          U2[i] = u + Du * lu - uvv + F * (1 - u);
          V2[i] = v + Dv * lv + uvv - (F + K) * v;
        }
      }
      [U, U2] = [U2, U]; [V, V2] = [V2, V];
    }
    return { w, h, data: V, zeroFloor: false, gamma: 1, desc: { fr: `Turing · ${name} · F ${F.toFixed(4)} k ${K.toFixed(4)}`, en: `Turing · ${{ mitose: "mitosis", corail: "coral", vers: "worms", labyrinthe: "maze", taches: "spots", empreintes: "fingerprints", ondulations: "ripples" }[name]} · F ${F.toFixed(4)} k ${K.toFixed(4)}` } };
  },
};


// Craquelure : bords de la mosaïque de Poisson–Voronoï (germes d'un processus
// de Poisson homogène), à deux échelles superposées ; distance F2 − F1 (Worley 1996).
const craquelure = {
  label: { fr: "Craquelure", en: "Crackle" },
  gen(rng, { cols, rows, aspect }) {
    const S1 = rnd(rng, 0.1, 0.28), S2 = S1 * rnd(rng, 0.22, 0.4), w1 = rnd(rng, 0.03, 0.07), w2 = rnd(rng, 0.04, 0.09);
    const seed1 = rndInt(rng, 1, 1e9), seed2 = rndInt(rng, 1, 1e9);
    const cache = new Map();
    // Germes d'une case S×S : nombre tiré selon une loi de Poisson de moyenne 1 (algorithme de Knuth).
    const seedsIn = (i, j, S, seed) => {
      const key = `${seed}:${i}:${j}`;
      let pts = cache.get(key);
      if (!pts) {
        const r = mulberry32((Math.floor(hash2(i, j, seed) * 4294967296)) >>> 0);
        let n = 0;
        for (let p = r(); p > Math.exp(-1); p *= r()) n++;
        pts = Array.from({ length: n }, () => [(i + r()) * S, (j + r()) * S]);
        cache.set(key, pts);
      }
      return pts;
    };
    const edge = (x, y, S, seed) => {
      const ix = Math.floor(x / S), iy = Math.floor(y / S);
      let f1 = 1e9, f2 = 1e9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        for (const [px, py] of seedsIn(ix + dx, iy + dy, S, seed)) {
          const d = Math.hypot(x - px, y - py);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      return f2 - f1;
    };
    const out = analytic(cols, rows, aspect, 2, (x, y) =>
      Math.exp(-edge(x, y, S1, seed1) / (S1 * w1)) + 0.55 * Math.exp(-edge(x, y, S2, seed2) / (S2 * w2)));
    return { ...out, zeroFloor: true, gamma: 0.9, desc: { fr: `Craquelure · cellules ${S1.toFixed(2)} / ${S2.toFixed(2)}`, en: `Crackle · cells ${S1.toFixed(2)} / ${S2.toFixed(2)}` } };
  },
};

// Physarum (Jones 2010) : agents à règles invariantes par rotation, répartis
// uniformément, qui suivent et renforcent leurs propres traces.
const physarum = {
  label: { fr: "Physarum", en: "Physarum" },
  gen(rng, { cols, rows }) {
    const [w, h] = simSize(cols, rows, 320), k = w / 320;
    const N = Math.round(w * h * rnd(rng, 0.3, 0.6));
    const SA = rnd(rng, 0.25, 0.5), RA = SA * rnd(rng, 1.5, 2.2), SO = rnd(rng, 5, 9) * k, decay = rnd(rng, 0.85, 0.92);
    const ax = new Float32Array(N), ay = new Float32Array(N), aa = new Float32Array(N);
    for (let i = 0; i < N; i++) { ax[i] = rng() * w; ay[i] = rng() * h; aa[i] = rng() * TAU; }
    let T = new Float32Array(w * h), T2 = new Float32Array(w * h);
    const at = (x, y) => T[((Math.floor(y) % h + h) % h) * w + ((Math.floor(x) % w + w) % w)];
    const steps = 120;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < N; i++) {
        let a = aa[i];
        const x = ax[i], y = ay[i];
        const F = at(x + Math.cos(a) * SO, y + Math.sin(a) * SO);
        const L = at(x + Math.cos(a + SA) * SO, y + Math.sin(a + SA) * SO);
        const R = at(x + Math.cos(a - SA) * SO, y + Math.sin(a - SA) * SO);
        if (F >= L && F >= R) { /* tout droit */ }
        else if (F < L && F < R) a += rng() < 0.5 ? RA : -RA;
        else if (L > R) a += RA; else a -= RA;
        const nx = (x + Math.cos(a) + w) % w, ny = (y + Math.sin(a) + h) % h;
        ax[i] = nx; ay[i] = ny; aa[i] = a;
        T[Math.floor(ny) * w + Math.floor(nx)] += 1;
      }
      for (let y = 0; y < h; y++) {
        const yu = ((y + h - 1) % h) * w, yc = y * w, yd = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const xl = (x + w - 1) % w, xr = (x + 1) % w;
          T2[yc + x] = decay * (T[yu + xl] + T[yu + x] + T[yu + xr] + T[yc + xl] + T[yc + x] + T[yc + xr] + T[yd + xl] + T[yd + x] + T[yd + xr]) / 9;
        }
      }
      [T, T2] = [T2, T];
    }
    for (let i = 0; i < T.length; i++) T[i] = Math.log1p(T[i]); // les veines fines restent visibles
    return { w, h, data: T, zeroFloor: true, gamma: 0.9, desc: { fr: `Physarum · ${N} agents · capteurs ${(SA * 180 / Math.PI).toFixed(0)}° à ${(SO / k).toFixed(1)}`, en: `Physarum · ${N} agents · sensors ${(SA * 180 / Math.PI).toFixed(0)}° at ${(SO / k).toFixed(1)}` } };
  },
};

// Ordre d'affichage = ordre des préférences. Encre, la favorite, pèse double au tirage.
export const FIELDS = { encre, flux, fractal, caustiques, turing, craquelure, physarum };
export const FIELD_IDS = Object.keys(FIELDS);
export const FIELD_WEIGHTS = { encre: 2 };

// ─── Pipeline ────────────────────────────────────────────────────────────

export function resample(src, cols, rows) {
  const { w, h, data } = src, out = new Float32Array(cols * rows);
  if (w === cols && h === rows) { out.set(data); return out; }
  if (w >= cols && h >= rows) {
    for (let j = 0; j < rows; j++) {
      const y0 = Math.floor((j * h) / rows), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * h) / rows));
      for (let i = 0; i < cols; i++) {
        const x0 = Math.floor((i * w) / cols), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * w) / cols));
        let s = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += data[y * w + x];
        out[j * cols + i] = s / ((y1 - y0) * (x1 - x0));
      }
    }
    return out;
  }
  for (let j = 0; j < rows; j++) {
    const fy = Math.min(h - 1, Math.max(0, ((j + 0.5) * h) / rows - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < cols; i++) {
      const fx = Math.min(w - 1, Math.max(0, ((i + 0.5) * w) / cols - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const a = data[y0 * w + x0] * (1 - tx) + data[y0 * w + x1] * tx;
      const b = data[y1 * w + x0] * (1 - tx) + data[y1 * w + x1] * tx;
      out[j * cols + i] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

export function normalize(v, zeroFloor, gamma) {
  const sorted = Float32Array.from(v).sort();
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const lo = zeroFloor ? Math.min(0, sorted[0]) : q(0.01), hi = q(0.997);
  const span = hi - lo || 1;
  for (let i = 0; i < v.length; i++) {
    const t = Math.min(1, Math.max(0, (v[i] - lo) / span));
    v[i] = Math.pow(t, gamma);
  }
  return v;
}

export function stats(v) {
  let s = 0, s2 = 0, vis = 0;
  for (const x of v) { s += x; s2 += x * x; if (x > 0.15) vis++; }
  const mean = s / v.length;
  return { mean, std: Math.sqrt(Math.max(0, s2 / v.length - mean * mean)), visible: vis / v.length };
}

// Filtre qualité : ni presque vide, ni saturé, ni uniforme.
export function passesGate(st) {
  return st.mean > 0.05 && st.mean < 0.62 && st.std > 0.07 && st.visible > 0.04 && st.visible < 0.92;
}

// Critère all-over : l'écran découpé en 6×4 blocs ; aucun bloc presque vide et une
// densité régulière d'un bloc à l'autre — autrement dit, pas de foyer.
export function allOverScore(v, cols, rows) {
  const bx = 6, by = 4, means = [];
  for (let b = 0; b < by; b++) for (let a = 0; a < bx; a++) {
    const x0 = Math.floor((a * cols) / bx), x1 = Math.floor(((a + 1) * cols) / bx);
    const y0 = Math.floor((b * rows) / by), y1 = Math.floor(((b + 1) * rows) / by);
    let s = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += v[y * cols + x];
    means.push(s / ((x1 - x0) * (y1 - y0)));
  }
  const m = means.reduce((p, q) => p + q) / means.length || 1e-9;
  const cv = Math.sqrt(means.reduce((p, q) => p + (q - m) ** 2, 0) / means.length) / m;
  return { cv, min: Math.min(...means) / m };
}
export const allOverOk = (sc) => sc.cv < 0.4 && sc.min > 0.3;

export function generate(fieldId, seed, cols, rows, aspect) {
  const rng = mulberry32(seed);
  const out = FIELDS[fieldId].gen(rng, { cols, rows, aspect });
  const v = normalize(resample(out, cols, rows), out.zeroFloor, out.gamma);
  const st = stats(v), allOver = allOverScore(v, cols, rows);
  // Le filtre écarte seulement les réalisations ratées (presque vides, saturées, inégales).
  return { v, desc: out.desc, stats: st, allOver, ok: passesGate(st) && allOverOk(allOver) };
}
