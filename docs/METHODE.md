# Méthode · Method

**[Français](#français) · [English](#english)**

---

## Français

### Le principe

Mosaïque n'a qu'une règle : **chaque image est la réalisation d'un champ
aléatoire stationnaire, isotrope et ergodique.** Aucun algorithme n'entre dans
le projet parce qu'il est joli ; il entre parce qu'il satisfait cette définition
mathématique et qu'il est publié.

La règle a deux raisons d'être :

1. **Elle décrit une esthétique précise.** Une texture qui couvre toute la
   surface de façon égale, sans centre, sans direction privilégiée et sans
   motif qui se répète : un « all-over » à la Pollock, du marbre, de l'écume,
   un nuage. La recherche en perception relie cette esthétique à des propriétés
   mesurables : les images naturelles ont un spectre en 1/f (Field 1987), et
   l'œil préfère les fractales de dimension 1,3 à 1,5 (Spehar et al. 2003).
2. **Elle ferme le champ des possibles.** Sans critère formel, on peut toujours
   inventer une formule de plus. Avec lui, la liste des algorithmes admissibles
   est délimitée par la littérature, pas par le goût du jour.

### Les définitions

Soit X(x) un champ aléatoire réel indexé par x ∈ ℝ².

| Propriété | Définition | Ce que ça veut dire à l'écran |
|---|---|---|
| **Stationnaire** (au sens strict) | Pour tout vecteur h, la loi de (X(x₁+h), …, X(xₙ+h)) est celle de (X(x₁), …, X(xₙ)). | Aucune zone n'est privilégiée : pas de centre, pas de bord, pas de foyer. |
| **Isotrope** | Pour toute rotation R, la loi de (X(Rx₁), …, X(Rxₙ)) est celle de (X(x₁), …, X(xₙ)). | Aucune direction n'est privilégiée : pas de lignes, de grille ou de diagonales imposées. |
| **Ergodique (mélangeant)** | Cov(X(x), X(x+h)) → 0 quand ‖h‖ → ∞. | Deux régions éloignées sont indépendantes : le hasard est présent partout, rien ne se répète. |

La troisième condition est indispensable. Sans elle, n'importe quel motif
déterministe (un kaléidoscope, un pavage, une figure de Chladni) posé à une
position et dans une orientation tirées au hasard serait techniquement
stationnaire et isotrope. Le mélange exclut ces cas : il exige que l'aléa
agisse à toutes les échelles, pas seulement sur le cadrage.

Références : Adler et Taylor, *Random Fields and Geometry* (2007) ; Yaglom,
*Correlation Theory of Stationary and Related Random Functions* (1987) ; Chiu,
Stoyan, Kendall et Mecke, *Stochastic Geometry and its Applications* (2013) ;
Maruyama (1949) pour le lien entre mélange et covariance dans le cas gaussien.

### Les règles d'application

| | Règle |
|---|---|
| **R1** | Le critère porte sur le **modèle mathématique en espace continu**. La grille de calcul n'en est qu'une approximation. |
| **R2** | Un modèle **défini sur un réseau** (automate cellulaire, pavage) est exclu : son anisotropie appartient au modèle, pas à l'approximation. |
| **R3** | Un modèle à **spectre discret** (somme d'un nombre fini d'ondes fixées) n'est pas ergodique : il est exclu. |
| **R4** | Un modèle **déterministe, centré ou dépendant du cadre** est exclu. |
| **R5** | Quand un modèle conforme était construit sur une brique non conforme, on remplace la brique par sa version canonique sans changer le modèle : le bruit de Perlin (lié à une grille) devient un champ gaussien isotrope, la grille de germes « jitterée » devient un processus de Poisson. |
| **R6** | Les choix restants (plages de paramètres, courbe de tons, seuils du filtre qualité) sont des **constantes fixées une fois** et documentées dans le code. Ils ne changent pas la classe d'un champ. Le filtre écarte des réalisations ratées, jamais une classe. |
| **R7** | Un nouvel algorithme n'entre que s'il satisfait le critère et cite sa source. |

### La brique commune : le champ gaussien isotrope

Quatre champs reposent sur le **modèle des ondes aléatoires** (Longuet-Higgins
1957 ; Berry 1977) : une somme d'ondes planes dont les directions et les phases
sont uniformes, et dont les nombres d'onde sont tirés de façon continue sur
chaque octave. Sa loi est invariante par translation et par rotation, et son
spectre continu le rend ergodique. L'amplitude suit une loi de puissance,
P(k) ∝ k^−(2H+2), où H est l'exposant de Hurst.

### Les champs retenus

Dans l'ordre des préférences ; Encre, la favorite, est tirée deux fois plus souvent.

| Champ | Modèle | Pourquoi il est conforme | Sources |
|---|---|---|---|
| **Encre** ★ | Déformation de domaine de champs gaussiens isotropes | Une composition de champs stationnaires isotropes indépendants l'est aussi | Quilez (2002) ; Longuet-Higgins (1957) |
| **Flux** | Convolution intégrale linéaire d'un bruit blanc le long du rotationnel d'un champ gaussien isotrope | Opérateurs invariants par translation et rotation appliqués à des champs conformes | Cabral et Leedom (1993) ; Bridson et al. (2007) |
| **Fractal 1/f** | Champ gaussien à densité spectrale isotrope en loi de puissance ; D = 2 − H tiré entre 1,3 et 1,5 | C'est l'exemple canonique de champ stationnaire isotrope | Voss (1985) ; Mandelbrot (1982) ; Spehar et al. (2003) |
| **Caustiques** | Réfraction de la lumière par une mer gaussienne isotrope, focalisation q ∈ [0,7 ; 1,4] | Transformation locale invariante d'un champ conforme | Longuet-Higgins (1957) ; Berry et Upstill (1980) |
| **Turing** | Réaction-diffusion de Gray-Scott, état initial aléatoire uniforme | Équations invariantes par translation et rotation, hasard initial homogène | Gray et Scott (1984) ; Pearson (1993) |
| **Craquelure** | Mosaïque de Poisson–Voronoï, deux échelles superposées | Le processus de Poisson homogène est stationnaire, isotrope et mélangeant | Okabe et al. (2000) ; Worley (1996) |
| **Physarum** | Agents à règles invariantes par rotation, positions et caps initiaux uniformes | Dynamique invariante, hasard initial homogène ; limite continue : chimiotactisme | Jones (2010) ; Keller et Segel (1970) |

### Les champs archivés

Ils sont conservés dans [`archive/`](../archive/), en attente d'élimination.

| Champ | Raison |
|---|---|
| Automate (Wolfram) | Un axe est le temps : anisotrope par construction (R2) |
| Cyclique | Automate cellulaire sur réseau : fronts carrés (R2) |
| Truchet | Pavage sur réseau (R2) |
| Quasicristal | Nombre fini d'ondes fixées : spectre discret, non ergodique (R3) |
| Chladni | Modes propres déterministes et périodiques (R3, R4) |
| Moiré, Ondes | Sources ponctuelles en nombre fini, liées au cadre (R4) |
| Coulures | Les gestes partent des zones vides du cadre : la loi dépend de la position (R4) |
| Tas de sable, Julia, Attracteur, Harmonographe, Spirale | Déterministes ou centrés (R4) |
| Tableaux du musée, image personnelle | Ce ne sont pas des champs aléatoires |
| Palettes Braise, Nébuleuse, Phosphore, Lune, Couleurs de l'image | Options secondaires retirées avec le menu caché |

### Ce qui ne relève pas du critère

- **Les palettes** colorent la valeur du champ sans en changer la classe.
  Cubehelix (Green 2011) est un moteur : la seed calcule un nouveau dégradé
  multicolore du noir au blanc pour chaque image. Viridis, Plasma, Magma et
  Inferno (van der Walt et Smith 2015) et Turbo (Mikhailov 2019) sont publiées.
  Spectre et les palettes froides (Glace, Abysse, Givre, Polaire, Aurore) sont
  des dégradés choisis à la main.
- **Le rendu** (cercles, carrés, pixels, ASCII) est une quantification par
  cellule. La grille est calée sur le PGCD de la résolution, pour qu'aucune
  cellule ne soit coupée.

### Limites assumées

- Tout calcul se fait sur une grille finie et un écran borné : la stationnarité
  et l'isotropie sont celles du modèle, approchées par le calcul (R1).
- Le modèle des ondes aléatoires utilise 10 à 14 ondes par octave : c'est une
  approximation standard d'un spectre continu.
- Turing et Physarum sont simulés sur un réseau carré : ce sont des
  discrétisations de modèles continus isotropes, ce qui les distingue des
  automates cellulaires, définis sur le réseau.

---

## English

### The principle

Mosaïque has a single rule: **every image is a realisation of a stationary,
isotropic and ergodic random field.** No algorithm enters the project because
it looks good; it enters because it satisfies this mathematical definition and
is published.

The rule exists for two reasons:

1. **It describes a precise aesthetic.** A texture that covers the whole surface
   evenly, with no centre, no preferred direction and no repeating motif: a
   Pollock-like "all-over", marble, foam, a cloud. Perception research ties this
   aesthetic to measurable properties: natural images have a 1/f spectrum
   (Field 1987), and viewers prefer fractals of dimension 1.3 to 1.5 (Spehar et
   al. 2003).
2. **It closes the space of possibilities.** Without a formal criterion, one can
   always invent one more formula. With it, the set of admissible algorithms is
   bounded by the literature, not by the mood of the day.

### Definitions

Let X(x) be a real random field indexed by x ∈ ℝ².

| Property | Definition | What it means on screen |
|---|---|---|
| **Stationary** (strict sense) | For every vector h, (X(x₁+h), …, X(xₙ+h)) has the same law as (X(x₁), …, X(xₙ)). | No privileged region: no centre, no edge, no focal point. |
| **Isotropic** | For every rotation R, (X(Rx₁), …, X(Rxₙ)) has the same law as (X(x₁), …, X(xₙ)). | No privileged direction: no imposed lines, grid or diagonals. |
| **Ergodic (mixing)** | Cov(X(x), X(x+h)) → 0 as ‖h‖ → ∞. | Distant regions are independent: randomness is everywhere, nothing repeats. |

The third condition is essential. Without it, any deterministic pattern (a
kaleidoscope, a tiling, a Chladni figure) placed at a random position and
orientation would technically be stationary and isotropic. Mixing rules these
out: randomness must act at every scale, not only on the framing.

References: Adler & Taylor, *Random Fields and Geometry* (2007); Yaglom,
*Correlation Theory of Stationary and Related Random Functions* (1987); Chiu,
Stoyan, Kendall & Mecke, *Stochastic Geometry and its Applications* (2013);
Maruyama (1949) for mixing and covariance in the Gaussian case.

### Rules of application

| | Rule |
|---|---|
| **R1** | The criterion applies to the **mathematical model in continuous space**; the computing grid only approximates it. |
| **R2** | A model **defined on a lattice** (cellular automaton, tiling) is excluded: its anisotropy belongs to the model, not to the approximation. |
| **R3** | A model with a **discrete spectrum** (a finite sum of fixed waves) is not ergodic, so it is excluded. |
| **R4** | A **deterministic, centred or frame-dependent** model is excluded. |
| **R5** | When a conforming model was built on a non-conforming building block, the block is replaced by its canonical version without changing the model: Perlin noise (tied to a grid) becomes an isotropic Gaussian field; a jittered grid of seeds becomes a Poisson process. |
| **R6** | Remaining choices (parameter ranges, tone curve, quality-filter thresholds) are **constants set once** and documented in the code. They do not change a field's class. The filter discards failed realisations, never a class. |
| **R7** | A new algorithm enters only if it satisfies the criterion and cites its source. |

### Shared building block: the isotropic Gaussian field

Four fields rest on the **random-wave model** (Longuet-Higgins 1957; Berry
1977): a sum of plane waves with uniform directions and phases, and wavenumbers
drawn continuously within each octave. Its law is invariant under translation
and rotation, and its continuous spectrum makes it ergodic. Amplitudes follow a
power law, P(k) ∝ k^−(2H+2), where H is the Hurst exponent.

### Fields kept

In order of preference; Ink, the favourite, is drawn twice as often.

| Field | Model | Why it conforms | Sources |
|---|---|---|---|
| **Ink** ★ | Domain warping of isotropic Gaussian fields | A composition of independent stationary isotropic fields is stationary and isotropic | Quilez (2002); Longuet-Higgins (1957) |
| **Flow** | Line integral convolution of white noise along the curl of an isotropic Gaussian field | Translation- and rotation-invariant operators applied to conforming fields | Cabral & Leedom (1993); Bridson et al. (2007) |
| **1/f fractal** | Gaussian field with an isotropic power-law spectrum; D = 2 − H drawn in [1.3, 1.5] | The canonical stationary isotropic field | Voss (1985); Mandelbrot (1982); Spehar et al. (2003) |
| **Caustics** | Light refracted by an isotropic Gaussian sea, focusing q ∈ [0.7, 1.4] | Invariant local transform of a conforming field | Longuet-Higgins (1957); Berry & Upstill (1980) |
| **Turing** | Gray-Scott reaction-diffusion, uniform random initial state | Translation- and rotation-invariant equations, homogeneous initial randomness | Gray & Scott (1984); Pearson (1993) |
| **Crackle** | Poisson–Voronoi tessellation, two superposed scales | The homogeneous Poisson process is stationary, isotropic and mixing | Okabe et al. (2000); Worley (1996) |
| **Physarum** | Agents with rotation-invariant rules, uniform initial positions and headings | Invariant dynamics, homogeneous initial randomness; continuum limit: chemotaxis | Jones (2010); Keller & Segel (1970) |

### Archived fields

Kept in [`archive/`](../archive/), pending removal.

| Field | Reason |
|---|---|
| Automaton (Wolfram) | One axis is time: anisotropic by construction (R2) |
| Cyclic | Lattice cellular automaton: square fronts (R2) |
| Truchet | Lattice tiling (R2) |
| Quasicrystal | Finite set of fixed waves: discrete spectrum, not ergodic (R3) |
| Chladni | Deterministic, periodic eigenmodes (R3, R4) |
| Moiré, Waves | Finite set of point sources tied to the frame (R4) |
| Drips | Strokes start from the frame's empty areas: the law depends on position (R4) |
| Sandpile, Julia, Attractor, Harmonograph, Spiral | Deterministic or centred (R4) |
| Museum paintings, personal image | Not random fields |
| Ember, Nebula, Phosphor, Moon, Image-colour palettes | Secondary options removed with the hidden menu |

### Outside the criterion

- **Palettes** colour the field's value without changing its class. Cubehelix
  (Green 2011) is an engine: the seed computes a new black-to-white
  multi-colour gradient for each image. Viridis, Plasma, Magma and Inferno
  (van der Walt & Smith 2015) and Turbo (Mikhailov 2019) are published.
  Spectrum and the cold palettes (Ice, Abyss, Frost, Polar, Aurora) are
  hand-picked gradients.
- **Styles** (circles, squares, pixels, ASCII) quantise each cell. The grid is
  set from the resolution's GCD so that no cell is cut.

### Acknowledged limits

- Every computation runs on a finite grid and a bounded screen: stationarity
  and isotropy are those of the model, approximated by the computation (R1).
- The random-wave model uses 10 to 14 waves per octave, a standard
  approximation of a continuous spectrum.
- Turing and Physarum are simulated on a square lattice: they are
  discretisations of isotropic continuous models, which sets them apart from
  cellular automata, which are defined on the lattice.
