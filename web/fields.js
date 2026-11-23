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
const TAU = Math.PI * 2;

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
  label: "Ondes",
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
    return { ...out, zeroFloor: true, gamma: 0.55, desc: `Ondes · ${n} sources (${layout}) · λ ${lambda.toFixed(3)}` };
  },
};

const chladni = {
  label: "Chladni",
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
    return { ...out, zeroFloor: false, gamma: 1.3, desc: `Chladni · modes (${n}, ${m})${mix ? ` + (${n2}, ${m2})` : ""}` };
  },
};

const turing = {
  label: "Turing",
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
    return { w, h, data: V, zeroFloor: false, gamma: 1, desc: `Turing · ${name} · F ${F.toFixed(4)} k ${K.toFixed(4)}` };
  },
};

const julia = {
  label: "Julia",
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
    return { ...out, zeroFloor: true, gamma: 0.75, desc: `Julia · c = ${cr.toFixed(3)} ${sign} ${Math.abs(ci).toFixed(3)}i` };
  },
};

const attracteur = {
  label: "Attracteur",
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
        desc: `Attracteur de ${type} · a ${a.toFixed(2)} b ${b.toFixed(2)} c ${c.toFixed(2)} d ${d.toFixed(2)}` };
    }
    return { w, h, data: new Float32Array(w * h), zeroFloor: true, gamma: 1, desc: "Attracteur (échec)" };
  },
};

const automate = {
  label: "Automate",
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
    return { w, h, data: dens, zeroFloor: true, gamma: 1.2, desc: `Automate · règle ${rule} · ${single ? "cellule unique" : `densité ${density.toFixed(2)}`}` };
  },
};

const harmonographe = {
  label: "Harmonographe",
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
    return { w, h, data, zeroFloor: true, gamma: 0.8, desc: `Harmonographe · rapport ${rx}:${ry}` };
  },
};

const encre = {
  label: "Encre",
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
    return { ...out, zeroFloor: false, gamma: rnd(rng, 1.3, 2.4), desc: `Encre · déformation ${warp.toFixed(1)}${ridge ? " · crêtes" : ""}` };
  },
};

const spirale = {
  label: "Spirale",
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
    return { ...out, zeroFloor: true, gamma: 0.6, desc: `Spirale · ${arms} bras · inclinaison ${tilt.toFixed(2)}` };
  },
};

export const FIELDS = { ondes, chladni, turing, julia, attracteur, automate, harmonographe, encre, spirale };
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

export function generate(fieldId, seed, cols, rows, aspect) {
  const rng = mulberry32(seed);
  const out = FIELDS[fieldId].gen(rng, { cols, rows, aspect });
  const v = normalize(resample(out, cols, rows), out.zeroFloor, out.gamma);
  return { v, desc: out.desc };
}
