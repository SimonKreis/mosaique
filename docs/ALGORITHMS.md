# Algorithms and sources · Algorithmes et sources

Every field implements a published model. Parameter ranges, tone curves (gamma)
and quality thresholds are curatorial constants: chosen once, fixed in code.
What is ad hoc is listed honestly in the last column.

Chaque champ implémente un modèle publié. Les plages de paramètres, les courbes
de tons (gamma) et les seuils du filtre sont des constantes de curation : choisies
une fois, fixées dans le code. Ce qui est fait maison est indiqué en dernière colonne.

## Favourites · Préférés

| Field · Champ | Model · Modèle | Source | Ad hoc |
|---|---|---|---|
| Ink · Encre | Domain-warped fractal Perlin noise | Perlin 1985, *An Image Synthesizer*; Perlin 2002, *Improving Noise*; Quilez, *Domain Warping* (2002) | warp strength range |
| Drips · Coulures | Persistent (correlated) random walk, poured until a target box-counting dimension D ∈ [1.5, 1.8] | Taylor, Micolich & Jonas 1999, *Fractal analysis of Pollock's drip paintings*, Nature 399 | stroke thickness ∝ 1/speed, splatter, layering |
| Flow · Flux | Line integral convolution along a curl (divergence-free) noise field | Cabral & Leedom 1993, SIGGRAPH; Bridson et al. 2007, *Curl-noise for procedural fluid flow* | — |
| Automaton · Automate | Elementary cellular automata, Wolfram classes 3 and 4, random initial state | Wolfram 1984, *Universality and complexity in cellular automata* | brightness weighted by local density |
| Caustics · Caustiques | Light refracted by a sum-of-sines water surface (paraxial Snell's law), photon density | geometric optics | — |
| Chladni | Nodal lines of square-plate modes, cos(nπx)cos(mπy) − cos(mπx)cos(nπy) | Chladni 1787; Rayleigh, *The Theory of Sound* | — |
| Quasicrystal · Quasicristal | Superposition of n plane waves at angles π·k/n (2n-fold symmetry) | Shechtman et al. 1984, PRL 53; de Bruijn 1981 | symmetry centre placed off-screen |
| Truchet | Random-orientation tiles: Smith quarter-circle arcs or diagonals (10 PRINT) | Truchet 1704; Smith & Boucher 1987, Leonardo 20; Montfort et al. 2012, *10 PRINT* | — |
| Cyclic · Cyclique | Cyclic cellular automaton (von Neumann neighbourhood, threshold 1) | Fisch, Gravner & Griffeath 1991, *Cyclic cellular automata in two dimensions* | — |

## Others · Autres

| Field · Champ | Model · Modèle | Source | Ad hoc |
|---|---|---|---|
| Sandpile · Tas de sable | Identity element of the abelian sandpile group on the screen rectangle | Bak, Tang & Wiesenfeld 1987, PRL 59; Creutz 1991 | — |
| Physarum | Agent-based slime-mould transport network | Jones 2010, *Artificial Life* 16 | log display |
| Crackle · Craquelure | Worley cellular noise, F2 − F1 edges, two scales | Worley 1996, SIGGRAPH | — |
| Turing | Gray-Scott reaction-diffusion, (F, k) from Pearson's classes | Gray & Scott 1984; Pearson 1993, *Science* 261 | — |
| Moiré, Waves · Ondes | Superposition of circular waves | Huygens' principle | — |
| Julia | Escape-time Julia sets, smooth iteration count | Julia 1918 | — |
| Attractor · Attracteur | Clifford and de Jong maps, density histogram | Pickover 1990s; de Jong | — |
| Harmonograph · Harmonographe | Damped harmonic oscillators | 19th-century harmonograph | — |
| Spiral · Spirale | Logarithmic-spiral arms | density-wave theory (Lin & Shu 1964) | **density formula is ad hoc** |

## Palettes

| Palette | Source |
|---|---|
| Cubehelix (auto) | Green 2011, *A colour scheme for the display of astronomical intensity images*, Bull. Astr. Soc. India 39. Seeded: start hue, rotations, saturation, gamma |
| Viridis, Plasma, Magma, Inferno | van der Walt & Smith 2015 (matplotlib) |
| Turbo | Mikhailov 2019, Google AI |
| Spectre, Ice/Glace, Abyss, Frost, Polar, Aurora, others | **hand-picked colour stops** |

## Shared rules · Règles communes

- Grid · Grille: cell size is a divisor of gcd(width, height), so no cell is cut.
- Quality filter · Filtre qualité: rejects near-empty, saturated or flat images; all-over fields must also be even across 6×4 blocks.
- ASCII: symbols are sorted by the ink they actually cover in JetBrains Mono.
