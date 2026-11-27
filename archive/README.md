# Archive

Ce dossier garde en réserve ce qui a été retiré du projet lors de la
classification formelle (voir [docs/METHODE.md](../docs/METHODE.md)) :
les algorithmes qui ne sont pas des champs aléatoires stationnaires, isotropes
et ergodiques, les tableaux du musée, l'image personnelle et les palettes
secondaires. **Ces éléments sont en attente d'élimination.**

This folder holds what was removed from the project by the formal
classification (see [docs/METHODE.md](../docs/METHODE.md)): algorithms that are
not stationary, isotropic, ergodic random fields, museum paintings, the
personal image and the secondary palettes. **They are pending removal.**

## Contenu · Contents

`v3-avant-classification/` : l'application complète telle qu'elle était juste
avant la classification (`web/` et `server.py`), avec ses 19 champs.

`v3-avant-classification/`: the complete application as it was just before the
classification (`web/` and `server.py`), with its 19 fields.

## Restaurer · Restore

Pour lancer l'ancienne version telle quelle · To run the old version as is:

```bash
cd archive/v3-avant-classification && python3 server.py
```

Ce dossier n'est servi par rien d'autre ; le supprimer n'affecte pas l'application.
Nothing else serves this folder; deleting it does not affect the application.
