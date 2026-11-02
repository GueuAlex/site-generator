---
description: Transmettre les retours de l'utilisateur à Kimi, puis revérifier le site
argument-hint: <slug> <retours>
---

Arguments : `$ARGUMENTS` (le premier mot est le slug, le reste les retours de l'utilisateur).

1. Reformule les retours en consignes précises et vérifiables pour Kimi (une consigne par ligne, en citant la page et la section concernées), sans en changer le sens. Si un retour demande d'ajouter un contenu (tarif, texte, chiffre), mets d'abord à jour le cahier des charges : Kimi n'intègre que des textes validés.
2. Lance `node scripts/kimi.mjs fix <slug> "<consignes>"`. La version précédente est sauvegardée automatiquement dans `<slug>/.historique/`.
3. Revérifie : `node scripts/verifier.mjs <slug>`, puis le rendu desktop et mobile.
4. Résume à l'utilisateur : fichiers modifiés, coût de l'appel, points encore à vérifier.
