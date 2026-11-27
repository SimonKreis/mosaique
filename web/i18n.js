// Interface bilingue français / anglais. La langue suit le navigateur,
// puis le choix fait avec le bouton FR/EN (mémorisé).

export let lang = localStorage.getItem("mosaique.lang") || (navigator.language.startsWith("fr") ? "fr" : "en");

export function setLang(l) {
  lang = l;
  localStorage.setItem("mosaique.lang", l);
  document.documentElement.lang = l;
}

// Choisit la langue d'une valeur { fr, en } (ou rend une chaîne telle quelle).
export const L = (v) => (v && typeof v === "object" ? v[lang] ?? v.fr : v);

const STR = {
  source: { fr: "Source", en: "Source" },
  renderer: { fr: "Rendu", en: "Style" },
  density: { fr: "Densité", en: "Density" },
  random: { fr: "au hasard", en: "random" },
  palette: { fr: "Palette", en: "Palette" },
  screen: { fr: "Écran", en: "Screen" },
  keep: { fr: "Garder", en: "Keep" },
  apply: { fr: "Appliquer", en: "Apply" },
  keys: { fr: "espace : shuffle · ← → : historique · K : garder · A : appliquer", en: "space: shuffle · ← →: history · K: keep · A: apply" },
  titlePrev: { fr: "Précédent (←)", en: "Previous (←)" },
  titleNext: { fr: "Suivant (→)", en: "Next (→)" },
  titleShuffle: { fr: "Nouvelle image (espace)", en: "New image (space)" },
  titleKeep: { fr: "Enregistrer le PNG (K)", en: "Save the PNG (K)" },
  titleApply: { fr: "Enregistrer et mettre en fond d'écran (A)", en: "Save and set as wallpaper (A)" },
  busy: { fr: "calcul…", en: "rendering…" },
  randomPrefs: { fr: "Au hasard ★ pondéré", en: "Random ★ weighted" },
  randomPrefPalettes: { fr: "Au hasard ★ pondéré", en: "Random ★ weighted" },
  groupSpectral: { fr: "Spectres", en: "Spectral" },
  groupCold: { fr: "Froides", en: "Cold" },
  randomShort: { fr: "Hasard", en: "Random" },
  grid: { fr: "grille", en: "grid" },
  pitch: { fr: "pas", en: "cell" },
  rejected: { fr: (n) => `${n} rejet${n > 1 ? "s" : ""} du filtre`, en: (n) => `${n} rejected by the filter` },
  kept: { fr: "Gardé :", en: "Kept:" },
  applied: { fr: "Appliqué comme fond d'écran", en: "Set as wallpaper" },
  failed: { fr: "Échec :", en: "Failed:" },
  error: { fr: "Erreur :", en: "Error:" },
};

export const t = (key, ...args) => {
  const v = STR[key][lang] ?? STR[key].fr;
  return typeof v === "function" ? v(...args) : v;
};

// Applique les textes fixes de la page (attributs data-i18n et data-i18n-title).
export function applyStatic() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
}
