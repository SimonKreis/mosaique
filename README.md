# Mosaïque

**[English](#english) · [Français](#français)** — daily automatic version: [mosaique-daily](https://github.com/SimonKreis/mosaique-daily)

![The seven fields of Mosaïque](docs/planche.jpg)

---

## English

A high-density wallpaper generator built on **one formal rule**: every image is
a realisation of a **stationary, isotropic and ergodic random field**: a
texture whose law is the same everywhere and in every direction, with
randomness at every scale. No centre, no grid, no repeating motif: the whole
screen is covered evenly, like marble, foam or a Pollock canvas.

The field is rendered as a grid of circles, squares, pixels or ASCII
characters, at your screen's exact resolution, coloured by a spectral gradient.

```
random field (stationary · isotropic · ergodic) → value per cell → style → gradient → PNG
```

### Why a formal rule

Mosaïque was built to stop endlessly browsing for the "perfect" wallpaper. An
open-ended collection of formulas only moves that problem into the code. A
mathematical definition closes it: an algorithm belongs to the project if, and
only if, it satisfies the definition and is published. The full framework
(definitions, seven rules of application, the classification of every
algorithm tried, and its limits) is in **[docs/METHODE.md](docs/METHODE.md)**.

### The seven fields

In order of preference (★ drawn twice as often):

| Field | Model | Source |
|---|---|---|
| Ink ★ | Domain warping of isotropic Gaussian fields | Quilez 2002; Longuet-Higgins 1957 |
| Flow | Line integral convolution along a divergence-free random flow | Cabral & Leedom 1993; Bridson et al. 2007 |
| 1/f fractal | Gaussian field with a power-law spectrum, contour dimension 1.3–1.5 | Voss 1985; Spehar et al. 2003 |
| Caustics | Light refracted by an isotropic Gaussian sea | Longuet-Higgins 1957; Berry & Upstill 1980 |
| Turing | Gray-Scott reaction-diffusion | Gray & Scott 1984; Pearson 1993 |
| Crackle | Poisson–Voronoi tessellation | Okabe et al. 2000; Worley 1996 |
| Physarum | Slime-mould transport network | Jones 2010 |

Twelve other algorithms were tried and archived because they do not satisfy
the rule (cellular automata, tilings, quasicrystals, Chladni figures, fractals
centred on the screen…). They are kept in [`archive/`](archive/), pending
removal.

### Gradients

**Cubehelix** (Green 2011) is a gradient engine: the seed computes a new
black-to-white multi-colour gradient for every image. Alongside it: Viridis,
Plasma, Magma, Inferno (matplotlib), Turbo (Google), and hand-picked Spectrum
and cold palettes (Ice ★, Abyss, Frost, Polar, Aurora).

### Install and run

Requires Python 3 (no dependencies) and a recent browser.

```bash
git clone https://github.com/SimonKreis/mosaique.git
cd mosaique
./mosaique
```

The script starts a local server (no network access) and opens
`http://127.0.0.1:8765/`. The interface is in English or French (FR/EN button).

### Controls

| Control | Effect |
|---|---|
| Source | one of the seven fields, or random (weighted) |
| Style | circles / squares / pixels / ASCII, or random |
| Density | cell size, among the divisors of the resolution's GCD (no cut-off cells) |
| Palette | spectral or cold gradient, or random (weighted) |
| Screen | target resolution (read from `hyprctl`, otherwise 3840×2160) |
| `space` | shuffle: new seed; settings you fixed stay locked |
| `←` `→` | history |
| `K` | keep: save the PNG |
| `A` | apply: save the PNG and set it as wallpaper ([Omarchy](https://omarchy.org)) |

Images are saved to `MOSAIQUE_KEEP_DIR` if set, otherwise to the active Omarchy
theme's background folder, otherwise to `~/Pictures/mosaique/`. The URL holds
the seed and settings, so the same URL gives the same image. Every keep and
apply is logged in `data/journal.jsonl`.

---

## Français

Un générateur de fonds d'écran haute densité fondé sur **une seule règle
formelle** : chaque image est la réalisation d'un **champ aléatoire
stationnaire, isotrope et ergodique**. C'est une texture dont la loi est la même
partout et dans toutes les directions, avec du hasard à toutes les échelles.
Pas de centre, pas de grille, pas de motif qui se répète : tout l'écran est
couvert de façon égale, comme du marbre, de l'écume ou une toile de Pollock.

Le champ est rendu en grille de cercles, de carrés, de pixels ou de
caractères ASCII, à la résolution exacte de l'écran, et coloré par un dégradé
spectral.

```
champ aléatoire (stationnaire · isotrope · ergodique) → valeur par cellule → rendu → dégradé → PNG
```

### Pourquoi une règle formelle

Mosaïque est né pour arrêter de chercher sans fin le fond d'écran « parfait ».
Une collection ouverte de formules ne fait que déplacer ce problème dans le
code. Une définition mathématique le ferme : un algorithme fait partie du
projet si, et seulement si, il satisfait la définition et il est publié. Le
cadre complet (définitions, sept règles d'application, classification de
chaque algorithme essayé et limites) est dans **[docs/METHODE.md](docs/METHODE.md)**.

### Les sept champs

Dans l'ordre des préférences (★ tiré deux fois plus souvent) :

| Champ | Modèle | Source |
|---|---|---|
| Encre ★ | Déformation de domaine de champs gaussiens isotropes | Quilez 2002 ; Longuet-Higgins 1957 |
| Flux | Convolution intégrale linéaire le long d'un écoulement aléatoire sans divergence | Cabral et Leedom 1993 ; Bridson et al. 2007 |
| Fractal 1/f | Champ gaussien à spectre en loi de puissance, dimension des contours 1,3–1,5 | Voss 1985 ; Spehar et al. 2003 |
| Caustiques | Lumière réfractée par une mer gaussienne isotrope | Longuet-Higgins 1957 ; Berry et Upstill 1980 |
| Turing | Réaction-diffusion de Gray-Scott | Gray et Scott 1984 ; Pearson 1993 |
| Craquelure | Mosaïque de Poisson–Voronoï | Okabe et al. 2000 ; Worley 1996 |
| Physarum | Réseau de transport de moisissure visqueuse | Jones 2010 |

Douze autres algorithmes ont été essayés puis archivés parce qu'ils ne
satisfont pas la règle (automates cellulaires, pavages, quasicristaux, figures
de Chladni, fractales centrées…). Ils sont gardés dans [`archive/`](archive/),
en attente d'élimination.

### Dégradés

**Cubehelix** (Green 2011) est un moteur de dégradés : la seed calcule un
nouveau dégradé multicolore du noir au blanc pour chaque image. À côté :
Viridis, Plasma, Magma, Inferno (matplotlib), Turbo (Google), et Spectre et
les palettes froides choisies à la main (Glace ★, Abysse, Givre, Polaire, Aurore).

### Installer et lancer

Il faut Python 3 (aucune dépendance) et un navigateur récent.

```bash
git clone https://github.com/SimonKreis/mosaique.git
cd mosaique
./mosaique
```

Le script démarre un serveur local (aucun accès réseau) et ouvre
`http://127.0.0.1:8765/`. L'interface est en français ou en anglais (bouton FR/EN).

### Contrôles

| Contrôle | Effet |
|---|---|
| Source | un des sept champs, ou au hasard (pondéré) |
| Rendu | cercles / carrés / pixels / ASCII, ou hasard |
| Densité | taille de cellule, parmi les diviseurs du PGCD de la résolution (aucune cellule coupée) |
| Palette | dégradé spectral ou froid, ou au hasard (pondéré) |
| Écran | résolution cible (lue via `hyprctl`, sinon 3840×2160) |
| `espace` | shuffle : nouvelle seed ; les réglages fixés restent verrouillés |
| `←` `→` | historique |
| `K` | garder : enregistre le PNG |
| `A` | appliquer : enregistre le PNG et le met en fond d'écran ([Omarchy](https://omarchy.org)) |

Les images vont dans `MOSAIQUE_KEEP_DIR` s'il est défini, sinon dans le dossier
de fonds d'écran du thème Omarchy actif, sinon dans `~/Pictures/mosaique/`.
L'URL contient la seed et les réglages : la même URL redonne la même image.
Chaque « garder » et « appliquer » est noté dans `data/journal.jsonl`.

---

## License / Licence

MIT
