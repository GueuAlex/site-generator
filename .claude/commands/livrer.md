---
description: Livrer un site (zip pour David et note des fonctionnalités) et mettre à jour le suivi
argument-hint: <slug>
---

Site **$ARGUMENTS**. Suis la section « Livraison des sites » de `CLAUDE.md`.

1. Vérifie que `$ARGUMENTS/NOTE_FONCTIONNALITES.md` est à jour : chaque `data-demo` du site y figure, ainsi que les contenus encore en placeholder.
2. Lance `node scripts/livrer.mjs $ARGUMENTS` (vérification bloquante, zip et copie de la note dans `livraisons/`).
3. Contrôle une dernière fois le rendu du zip : décompresse-le dans un dossier temporaire, sers-le avec `node scripts/servir.mjs <dossier> 4301`, puis captures desktop et mobile avec `node scripts/capture.mjs`.
4. `node scripts/suivi.mjs maj $ARGUMENTS livre --livre`.
5. Affiche le chemin et la taille du zip, le chemin de la note et le résultat de la checklist de livraison. **N'envoie rien à personne** : l'utilisateur transmet lui-même le zip à David et joint la note au lien.
