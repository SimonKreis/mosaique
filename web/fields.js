// Sources de champ. Chaque champ produit une grille de valeurs brutes ;
// generate() la ramène à la grille d'affichage puis la normalise dans [0, 1].
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
const gauss = (rng) => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(TAU * rng());
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

// Bruit de gradient (Perlin) et fBm, initialisés par la seed.
function makeNoise(rng) {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const a = rng() * TAU; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g = (ix, iy, dx, dy) => { const h = perm[ix + perm[iy]]; return gx[h] * dx + gy[h] * dy; };
    const n00 = g(X, Y, xf, yf), n10 = g(X + 1, Y, xf - 1, yf);
    const n01 = g(X, Y + 1, xf, yf - 1), n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
    const u = fade(xf), v = fade(yf);
    return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
  }
  function fbm(x, y, oct = 5) {
    let s = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) {
      s += amp * noise(x * f + o * 17.3, y * f - o * 9.1);
      f *= 2.02; amp *= 0.5;
    }
    return s; // ≈ [-0.6, 0.6]
  }
  return { noise, fbm };
}

function hash2(i, j, seed) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fitCurve(w, h, xs, ys, margin = 0.08) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < xs.length; k++) {
    if (xs[k] < minX) minX = xs[k]; if (xs[k] > maxX) maxX = xs[k];
    if (ys[k] < minY) minY = ys[k]; if (ys[k] > maxY) maxY = ys[k];
  }
  const s = Math.min((w * (1 - 2 * margin)) / (maxX - minX || 1), (h * (1 - 2 * margin)) / (maxY - minY || 1));
  return { s, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// ─── Champs ──────────────────────────────────────────────────────────────

const ondes = {
  label: { fr: "Ondes", en: "Waves" },
  gen(rng, { cols, rows, aspect }) {
    const n = pick(rng, [2, 2, 3, 3, 4, 5, 6]);
    const layout = pick(rng, ["libre", "ligne", "cercle"]);
    const lambda = rnd(rng, 0.06, 0.2), k = TAU / lambda;
    const decay = rnd(rng, 0.6, 3);
    const rot = rnd(rng, 0, TAU), rad = rnd(rng, 0.15, 0.6), gap = rnd(rng, 0.12, 0.45);
    const src = [];
    for (let i = 0; i < n; i++) {
      if (layout === "cercle") src.push([Math.cos(rot + (TAU * i) / n) * rad, Math.sin(rot + (TAU * i) / n) * rad, 0]);
      else if (layout === "ligne") src.push([(i - (n - 1) / 2) * gap, 0, 0]);
      else src.push([rnd(rng, -0.8, 0.8) * aspect, rnd(rng, -0.75, 0.75), rnd(rng, 0, TAU)]);
    }
    const out = analytic(cols, rows, aspect, 2, (x, y) => {
      let s = 0;
      for (const [sx, sy, ph] of src) { const r = Math.hypot(x - sx, y - sy); s += Math.cos(k * r + ph) / (1 + decay * r); }
      return s * s;
    });
    return { ...out, zeroFloor: true, gamma: 0.55, desc: { fr: `Ondes · ${n} sources (${layout}) · λ ${lambda.toFixed(3)}`, en: `Waves · ${n} sources (${{ libre: "free", ligne: "line", cercle: "circle" }[layout]}) · λ ${lambda.toFixed(3)}` } };
  },
};

const chladni = {
  label: { fr: "Chladni", en: "Chladni" },
  gen(rng, { cols, rows, aspect }) {
    const n = rndInt(rng, 1, 9);
    let m = rndInt(rng, 1, 9); if (m === n) m = n + rndInt(rng, 1, 3);
    const mix = rng() < 0.45 ? rnd(rng, 0.2, 0.8) : 0;
    const n2 = rndInt(rng, 1, 7), m2 = n2 + rndInt(rng, 1, 4);
    const L = rnd(rng, 0.55, 1.15), sharp = rnd(rng, 3, 9);
    const mode = (a, b, u, v) => Math.cos(a * Math.PI * u) * Math.cos(b * Math.PI * v) - Math.cos(b * Math.PI * u) * Math.cos(a * Math.PI * v);
    const out = analytic(cols, rows, aspect, 2, (x, y) => {
      const u = x / (2 * L) + 0.5, v = y / (2 * L) + 0.5;
      const f = (1 - mix) * mode(n, m, u, v) + mix * mode(n2, m2, u, v);
      return Math.exp(-Math.abs(f) * sharp);
    });
    return { ...out, zeroFloor: false, gamma: 1.3, desc: { fr: `Chladni · modes (${n}, ${m})${mix ? ` + (${n2}, ${m2})` : ""}`, en: `Chladni · modes (${n}, ${m})${mix ? ` + (${n2}, ${m2})` : ""}` } };
  },
};

const turing = {
  label: { fr: "Turing", en: "Turing" },
  allOver: true,
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

const julia = {
  label: { fr: "Julia", en: "Julia" },
  gen(rng, { cols, rows, aspect }) {
    const cs = [[-0.8, 0.156], [-0.4, 0.6], [0.285, 0.01], [-0.70176, -0.3842], [-0.835, -0.2321], [0.355, 0.355],
      [-0.54, 0.54], [0.37, 0.1], [-0.162, 1.04], [-0.7269, 0.1889], [-0.75, 0.11], [-0.1, 0.651], [0.3, -0.49], [-1.476, 0]];
    const [c0r, c0i] = pick(rng, cs);
    const cr = c0r + rnd(rng, -0.004, 0.004), ci = c0i + rnd(rng, -0.004, 0.004);
    const scale = rnd(rng, 0.7, 1.15), rot = pick(rng, [0, 0, Math.PI / 2, rnd(rng, 0, TAU)]);
    const ox = rnd(rng, -0.1, 0.1), oy = rnd(rng, -0.1, 0.1);
    const cosR = Math.cos(rot), sinR = Math.sin(rot), maxIt = 300;
    const out = analytic(cols, rows, aspect, 2, (x, y) => {
      let zr = (x * cosR - y * sinR) * scale + ox, zi = (x * sinR + y * cosR) * scale + oy;
      for (let n = 0; n < maxIt; n++) {
        const zr2 = zr * zr, zi2 = zi * zi;
        if (zr2 + zi2 > 256) return n + 1 - Math.log2(Math.log2(zr2 + zi2) / 2);
        zi = 2 * zr * zi + ci; zr = zr2 - zi2 + cr;
      }
      return 0;
    });
    const sign = ci < 0 ? "−" : "+";
    return { ...out, zeroFloor: true, gamma: 0.75, desc: { fr: `Julia · c = ${cr.toFixed(3)} ${sign} ${Math.abs(ci).toFixed(3)}i`, en: `Julia · c = ${cr.toFixed(3)} ${sign} ${Math.abs(ci).toFixed(3)}i` } };
  },
};

const attracteur = {
  label: { fr: "Attracteur", en: "Attractor" },
  gen(rng, { cols, rows }) {
    const w = cols * 2, h = rows * 2;
    const type = pick(rng, ["Clifford", "de Jong"]);
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = rnd(rng, -2.4, 2.4), b = rnd(rng, -2.4, 2.4), c = rnd(rng, -2.4, 2.4), d = rnd(rng, -2.4, 2.4);
      const step = type === "Clifford"
        ? (x, y) => [Math.sin(a * y) + c * Math.cos(a * x), Math.sin(b * x) + d * Math.cos(b * y)]
        : (x, y) => [Math.sin(a * y) - Math.cos(b * x), Math.sin(c * x) - Math.cos(d * y)];
      const P = 6000, xs = new Float32Array(P), ys = new Float32Array(P);
      let x = 0.1, y = 0.1;
      for (let i = 0; i < 200; i++) [x, y] = step(x, y);
      for (let i = 0; i < P; i++) { [x, y] = step(x, y); xs[i] = x; ys[i] = y; }
      const { s, cx, cy } = fitCurve(w, h, xs, ys);
      if (!isFinite(s) || s > w) continue;
      const data = new Float32Array(w * h);
      for (let i = 0; i < 500000; i++) {
        [x, y] = step(x, y);
        const px = Math.floor((x - cx) * s + w / 2), py = Math.floor((y - cy) * s + h / 2);
        if (px >= 0 && px < w && py >= 0 && py < h) data[py * w + px]++;
      }
      let filled = 0;
      for (let i = 0; i < data.length; i++) { if (data[i] > 0) filled++; data[i] = Math.log1p(data[i]); }
      const cover = filled / data.length;
      if (cover < 0.05 || cover > 0.55) continue;
      return { w, h, data, zeroFloor: true, gamma: 0.85,
        desc: { fr: `Attracteur de ${type} · a ${a.toFixed(2)} b ${b.toFixed(2)} c ${c.toFixed(2)} d ${d.toFixed(2)}`, en: `${type} attractor · a ${a.toFixed(2)} b ${b.toFixed(2)} c ${c.toFixed(2)} d ${d.toFixed(2)}` } };
    }
    return { w, h, data: new Float32Array(w * h), zeroFloor: true, gamma: 1, desc: { fr: "Attracteur (échec)", en: "Attractor (failed)" } };
  },
};

const automate = {
  label: { fr: "Automate", en: "Automaton" },
  gen(rng, { cols, rows }) {
    const rules = [30, 45, 73, 90, 105, 110, 124, 137, 150, 18, 22, 54, 57, 62, 75, 89, 101, 126, 135, 146, 169, 182, 193, 225];
    const rule = pick(rng, rules), sub = pick(rng, [1, 2, 2]);
    const w = cols * sub, h = rows * sub, data = new Float32Array(w * h);
    let row = new Uint8Array(w), next = new Uint8Array(w);
    const single = rng() < 0.35, density = rnd(rng, 0.04, 0.5);
    if (single) row[Math.floor(w / 2)] = 1;
    else for (let i = 0; i < w; i++) row[i] = rng() < density ? 1 : 0;
    const warm = single ? 0 : rndInt(rng, 0, h);
    for (let t = 0; t < h + warm; t++) {
      if (t >= warm) for (let i = 0; i < w; i++) data[(t - warm) * w + i] = row[i];
      for (let i = 0; i < w; i++) {
        const idx = (row[(i + w - 1) % w] << 2) | (row[i] << 1) | row[(i + 1) % w];
        next[i] = (rule >> idx) & 1;
      }
      [row, next] = [next, row];
    }
    // Pondère chaque cellule vivante par la densité de son voisinage (5×5) :
    // les zones pleines brillent, les cellules isolées restent petites.
    const dens = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      let s = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) s += data[yy * w + ((x + dx + w) % w)];
      }
      dens[y * w + x] = 0.2 + s / 25;
    }
    return { w, h, data: dens, zeroFloor: true, gamma: 1.2, desc: { fr: `Automate · règle ${rule} · ${single ? "cellule unique" : `densité ${density.toFixed(2)}`}`, en: `Automaton · rule ${rule} · ${single ? "single cell" : `density ${density.toFixed(2)}`}` } };
  },
};

const harmonographe = {
  label: { fr: "Harmonographe", en: "Harmonograph" },
  gen(rng, { cols, rows }) {
    const w = cols * 2, h = rows * 2;
    const ratios = [[1, 1], [1, 2], [2, 3], [3, 2], [3, 4], [1, 3], [2, 5], [3, 5], [4, 5], [1, 4]];
    const [rx, ry] = pick(rng, ratios), base = rnd(rng, 1.5, 3);
    const det = () => rnd(rng, -0.015, 0.015);
    const f = [rx * base + det(), ry * base + det(), rx * base * pick(rng, [1, 2, 0.5]) + det(), ry * base * pick(rng, [1, 2, 0.5]) + det()];
    const p = f.map(() => rnd(rng, 0, TAU)), dmp = f.map(() => rnd(rng, 0.0008, 0.004));
    const amp = [1, 1, rnd(rng, 0.3, 1), rnd(rng, 0.3, 1)];
    const T = 3 / Math.min(...dmp), N = 400000;
    const xs = new Float32Array(N), ys = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * T;
      xs[i] = amp[0] * Math.sin(f[0] * t + p[0]) * Math.exp(-dmp[0] * t) + amp[2] * Math.sin(f[2] * t + p[2]) * Math.exp(-dmp[2] * t);
      ys[i] = amp[1] * Math.sin(f[1] * t + p[1]) * Math.exp(-dmp[1] * t) + amp[3] * Math.sin(f[3] * t + p[3]) * Math.exp(-dmp[3] * t);
    }
    const { s, cx, cy } = fitCurve(w, h, xs, ys, 0.06);
    const data = new Float32Array(w * h);
    for (let i = 0; i < N; i++) {
      const px = Math.floor((xs[i] - cx) * s + w / 2), py = Math.floor((ys[i] - cy) * s + h / 2);
      if (px >= 0 && px < w && py >= 0 && py < h) data[py * w + px]++;
    }
    for (let i = 0; i < data.length; i++) data[i] = Math.log1p(data[i]);
    return { w, h, data, zeroFloor: true, gamma: 0.8, desc: { fr: `Harmonographe · rapport ${rx}:${ry}`, en: `Harmonograph · ratio ${rx}:${ry}` } };
  },
};

const encre = {
  label: { fr: "Encre", en: "Ink" },
  allOver: true,
  gen(rng, { cols, rows, aspect }) {
    const { fbm } = makeNoise(rng);
    const sc = rnd(rng, 0.8, 2.2), warp = rnd(rng, 1.5, 4.5), ridge = rng() < 0.4;
    const out = analytic(cols, rows, aspect, 1, (x, y) => {
      const px = x * sc, py = y * sc;
      const qx = fbm(px, py), qy = fbm(px + 5.2, py + 1.3);
      const rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2), ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8);
      const v = fbm(px + warp * rx, py + warp * ry);
      return ridge ? 1 - Math.abs(v) * 2.2 : v;
    });
    return { ...out, zeroFloor: false, gamma: rnd(rng, 1.3, 2.4), desc: { fr: `Encre · déformation ${warp.toFixed(1)}${ridge ? " · crêtes" : ""}`, en: `Ink · warp ${warp.toFixed(1)}${ridge ? " · ridges" : ""}` } };
  },
};

const spirale = {
  label: { fr: "Spirale", en: "Spiral" },
  gen(rng, { cols, rows, aspect }) {
    const { fbm } = makeNoise(rng);
    const arms = pick(rng, [1, 2, 2, 2, 3, 4]), tanP = rnd(rng, 0.18, 0.5), sharp = rnd(rng, 1.5, 5);
    const tilt = rnd(rng, 0.4, 1), rot = rnd(rng, 0, TAU), size = rnd(rng, 0.7, 1.2);
    const cx = rnd(rng, -0.3, 0.3) * aspect, cy = rnd(rng, -0.15, 0.15), starSeed = rndInt(rng, 1, 1e9);
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const out = analytic(cols, rows, aspect, 1, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const u = dx * cosR - dy * sinR, v = (dx * sinR + dy * cosR) / tilt;
      const r = Math.hypot(u, v) + 1e-4, th = Math.atan2(v, u);
      const arm = Math.pow(0.5 + 0.5 * Math.cos(arms * (th - Math.log(r) / tanP)), sharp);
      const disk = Math.exp((-r / size) * 1.8), bulge = Math.exp(-((r / (size * 0.12)) ** 2));
      const dust = 0.55 + 0.9 * fbm(u * 6, v * 6, 4);
      return disk * (0.15 + 0.85 * arm) * dust + bulge * 0.9;
    });
    // Étoiles éparses, à l'échelle des cellules.
    for (let j = 0; j < out.h; j++) for (let i = 0; i < out.w; i++) {
      const s = hash2(i, j, starSeed);
      if (s < 0.004) out.data[j * out.w + i] += 0.08 + s * 40;
    }
    return { ...out, zeroFloor: true, gamma: 0.6, desc: { fr: `Spirale · ${arms} bras · inclinaison ${tilt.toFixed(2)}`, en: `Spiral · ${arms} arms · tilt ${tilt.toFixed(2)}` } };
  },
};


// ─── Champs all-over : toute la surface, sans foyer ──────────────────────

// Dimension fractale par comptage de boîtes (pente de log N(s) contre log 1/s).
function boxDimension(mask, w, h) {
  const xs = [], ys = [];
  for (const sz of [2, 4, 8, 16, 32]) {
    let n = 0;
    for (let by = 0; by < h; by += sz) for (let bx = 0; bx < w; bx += sz) {
      let hit = false;
      for (let y = by; y < Math.min(h, by + sz) && !hit; y++)
        for (let x = bx; x < Math.min(w, bx + sz); x++) if (mask[y * w + x]) { hit = true; break; }
      if (hit) n++;
    }
    xs.push(Math.log(1 / sz)); ys.push(Math.log(Math.max(1, n)));
  }
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return num / den;
}

// Peinture par coulures : on verse des gestes jusqu'à atteindre une dimension
// fractale cible, dans la plage mesurée sur les drip paintings de Pollock.
const coulures = {
  label: { fr: "Coulures", en: "Drips" },
  allOver: true,
  gen(rng, { cols, rows }) {
    const [w, h] = simSize(cols, rows, 400), k = w / 320;
    const grid = new Float32Array(w * h), mask = new Uint8Array(w * h);
    const targetD = rnd(rng, 1.5, 1.8), layers = rndInt(rng, 3, 5);
    const thick = rnd(rng, 0.35, 0.9) * k, sigma = rnd(rng, 0.03, 0.12);
    const stamp = (cx, cy, r, val) => {
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { grid[y * w + x] = val; mask[y * w + x] = 1; }
    };
    // Comme Pollock qui tournait autour de la toile : chaque geste part de
    // préférence d'une zone encore peu couverte (blocs de 8×5).
    const BX = 8, BY = 5;
    const startPoint = () => {
      const items = [];
      for (let b = 0; b < BY; b++) for (let a = 0; a < BX; a++) {
        let c = 0, t = 0;
        for (let y = Math.floor((b * h) / BY); y < Math.floor(((b + 1) * h) / BY); y += 2)
          for (let x = Math.floor((a * w) / BX); x < Math.floor(((a + 1) * w) / BX); x += 2) { c += mask[y * w + x]; t++; }
        items.push([[a, b], (1 - c / t) ** 3 + 0.01]);
      }
      const [a, b] = pickWeighted(rng, items);
      return [((a + rng()) * w) / BX, ((b + rng()) * h) / BY];
    };
    const stroke = (val) => {
      let [x, y] = startPoint(), a = rnd(rng, 0, TAU), om = 0, sp = rnd(rng, 0.6, 1.6);
      const len = rndInt(rng, 100, 500) * k, th = thick * rnd(rng, 0.5, 1.8);
      for (let st = 0; st < len; st++) {
        om = om * 0.97 + gauss(rng) * sigma * 0.3;
        if (rng() < 0.002) om += gauss(rng) * 0.3; // boucle soudaine
        a += om + gauss(rng) * sigma * 0.2;
        sp = Math.min(2.2, Math.max(0.3, sp + gauss(rng) * 0.08));
        x += Math.cos(a) * sp * k; y += Math.sin(a) * sp * k;
        stamp(x, y, th * (0.5 + 0.7 / sp), val * (0.9 + 0.1 * rng())); // lent = plus épais
        if (rng() < 0.015) stamp(x + gauss(rng) * th * 5, y + gauss(rng) * th * 5, th * rnd(rng, 0.3, 1.1), val);
      }
    };
    let n = 0, D = 1;
    for (let layer = 0; layer < layers; layer++) {
      const val = 0.35 + (0.65 * (layer + 1)) / layers;
      const target = 1 + ((targetD - 1) * (layer + 1)) / layers;
      while (n < 1500) {
        for (let i = 0; i < 8; i++, n++) stroke(val);
        D = boxDimension(mask, w, h);
        if (D >= target) break;
      }
    }
    return { w, h, data: grid, zeroFloor: true, gamma: 1, desc: { fr: `Coulures · D ${D.toFixed(2)} (cible ${targetD.toFixed(2)}) · ${layers} couches · ${n} gestes`, en: `Drips · D ${D.toFixed(2)} (target ${targetD.toFixed(2)}) · ${layers} layers · ${n} strokes` } };
  },
};

// Physarum (modèle de Jones) : des agents suivent et renforcent leurs propres traces.
const physarum = {
  label: { fr: "Physarum", en: "Physarum" },
  allOver: true,
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

// Flux : convolution intégrale linéaire (LIC) d'un bruit le long d'un champ sans divergence.
const flux = {
  label: { fr: "Flux", en: "Flow" },
  allOver: true,
  gen(rng, { cols, rows, aspect }) {
    const { fbm } = makeNoise(rng);
    const [w, h] = simSize(cols, rows, 480), k = w / 320;
    const sc = rnd(rng, 0.6, 1.6), L = Math.round(rnd(rng, 18, 40) * k), dens = rnd(rng, 0.06, 0.18);
    const psi = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      psi[j * w + i] = fbm((((i + 0.5) / w) * 2 - 1) * aspect * sc, (((j + 0.5) / h) * 2 - 1) * sc, 4);
    const vx = new Float32Array(w * h), vy = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dy = psi[Math.min(h - 1, j + 1) * w + i] - psi[Math.max(0, j - 1) * w + i];
      const dx = psi[j * w + Math.min(w - 1, i + 1)] - psi[j * w + Math.max(0, i - 1)];
      const m = Math.hypot(dx, dy) || 1;
      vx[j * w + i] = dy / m; vy[j * w + i] = -dx / m; // rotationnel : perpendiculaire au gradient
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

// Caustiques : la lumière réfractée par une surface d'eau se concentre en réseau.
const caustiques = {
  label: { fr: "Caustiques", en: "Caustics" },
  allOver: true,
  gen(rng, { cols, rows, aspect }) {
    const [w, h] = simSize(cols, rows, 400);
    const M = rndInt(rng, 8, 14), waves = [];
    for (let m = 0; m < M; m++) {
      const lambda = rnd(rng, 0.12, 0.9), th = rnd(rng, 0, TAU), kk = TAU / lambda;
      waves.push([Math.cos(th) * kk, Math.sin(th) * kk, lambda * 0.08 * kk, rnd(rng, 0, TAU)]); // kx, ky, amplitude × k, phase
    }
    const strength = rnd(rng, 0.05, 0.11), data = new Float32Array(w * h);
    const ppc = 3, margin = 0.15, PW = Math.round(w * ppc * (1 + 2 * margin)), PH = Math.round(h * ppc * (1 + 2 * margin));
    for (let pj = 0; pj < PH; pj++) {
      const v = (pj + 0.5) / PH * (1 + 2 * margin) - margin, y = v * 2 - 1;
      for (let pi = 0; pi < PW; pi++) {
        const u = (pi + 0.5) / PW * (1 + 2 * margin) - margin, x = (u * 2 - 1) * aspect;
        let gx = 0, gy = 0;
        for (const [kx, ky, ak, ph] of waves) { const c = Math.cos(kx * x + ky * y + ph) * ak; gx += c * kx / Math.hypot(kx, ky); gy += c * ky / Math.hypot(kx, ky); }
        const px = Math.floor((((x - strength * gx) / aspect + 1) / 2) * w), py = Math.floor(((y - strength * gy + 1) / 2) * h);
        if (px >= 0 && px < w && py >= 0 && py < h) data[py * w + px]++;
      }
    }
    for (let i = 0; i < data.length; i++) data[i] = Math.log1p(data[i]);
    return { w, h, data, zeroFloor: false, gamma: rnd(rng, 1.0, 1.5), desc: { fr: `Caustiques · ${M} vagues · réfraction ${strength.toFixed(3)}`, en: `Caustics · ${M} waves · refraction ${strength.toFixed(3)}` } };
  },
};

// Craquelure : bords de cellules de Voronoï (F2 − F1) à deux échelles, légèrement déformés.
const craquelure = {
  label: { fr: "Craquelure", en: "Crackle" },
  allOver: true,
  gen(rng, { cols, rows, aspect }) {
    const { fbm } = makeNoise(rng);
    const S1 = rnd(rng, 0.1, 0.28), S2 = S1 * rnd(rng, 0.22, 0.4), w1 = rnd(rng, 0.03, 0.07), w2 = rnd(rng, 0.04, 0.09);
    const warp = rnd(rng, 0, 0.06), seed1 = rndInt(rng, 1, 1e9), seed2 = rndInt(rng, 1, 1e9);
    const edge = (x, y, S, seed) => {
      const ix = Math.floor(x / S), iy = Math.floor(y / S);
      let f1 = 1e9, f2 = 1e9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy;
        const px = (cx + hash2(cx, cy, seed)) * S, py = (cy + hash2(cy, cx, seed ^ 0x5f3759df)) * S;
        const d = Math.hypot(x - px, y - py);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      return f2 - f1;
    };
    const out = analytic(cols, rows, aspect, 2, (x, y) => {
      const wx = x + warp * fbm(x * 3, y * 3, 3), wy = y + warp * fbm(x * 3 + 7, y * 3 - 3, 3);
      return Math.exp(-edge(wx, wy, S1, seed1) / (S1 * w1)) + 0.55 * Math.exp(-edge(wx, wy, S2, seed2) / (S2 * w2));
    });
    return { ...out, zeroFloor: true, gamma: 0.9, desc: { fr: `Craquelure · cellules ${S1.toFixed(2)} / ${S2.toFixed(2)}`, en: `Crackle · cells ${S1.toFixed(2)} / ${S2.toFixed(2)}` } };
  },
};

// Moiré : interférence de nombreuses sources réparties partout, sans amortissement.
const moire = {
  label: { fr: "Moiré", en: "Moiré" },
  allOver: true,
  gen(rng, { cols, rows, aspect }) {
    const n = rndInt(rng, 12, 36), lambda = rnd(rng, 4, 9) * (2 / rows), kk = TAU / lambda;
    const src = Array.from({ length: n }, () => [rnd(rng, -1.2, 1.2) * aspect, rnd(rng, -1.2, 1.2), rnd(rng, 0, TAU)]);
    const out = analytic(cols, rows, aspect, 2, (x, y) => {
      let s = 0;
      for (const [sx, sy, ph] of src) s += Math.cos(kk * Math.hypot(x - sx, y - sy) + ph);
      return (s * s) / n;
    });
    return { ...out, zeroFloor: true, gamma: 0.8, desc: { fr: `Moiré · ${n} sources · λ ${(lambda * rows / 2).toFixed(1)} cellules`, en: `Moiré · ${n} sources · λ ${(lambda * rows / 2).toFixed(1)} cells` } };
  },
};

// Ordre d'affichage : les champs all-over d'abord.
export const FIELDS = { encre, coulures, physarum, flux, caustiques, craquelure, turing, moire,
  ondes, chladni, julia, attracteur, automate, harmonographe, spirale };
export const ALLOVER_IDS = Object.keys(FIELDS).filter((id) => FIELDS[id].allOver);
export const FIELD_IDS = Object.keys(FIELDS);

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
  const field = FIELDS[fieldId];
  const out = field.gen(rng, { cols, rows, aspect });
  const v = normalize(resample(out, cols, rows), out.zeroFloor, out.gamma);
  const st = stats(v);
  const allOver = field.allOver ? allOverScore(v, cols, rows) : null;
  return { v, desc: out.desc, stats: st, allOver, ok: passesGate(st) && (!allOver || allOverOk(allOver)) };
}
