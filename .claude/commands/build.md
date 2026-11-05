---
description: Faire construire le site par Kimi à partir du cahier validé, puis le vérifier
argument-hint: <slug>
---

Site **$ARGUMENTS**.

1. Vérifie que `$ARGUMENTS/CAHIER_DES_CHARGES.md` est marqué « Validé : oui ». Sinon : si l'utilisateur vient de lancer `/build`, c'est son feu vert, passe la mention à « oui » ; dans les autres cas, arrête-toi et demande la validation (ne jamais utiliser `--forcer` sans son accord explicite).
2. Lance `node scripts/kimi.mjs build $ARGUMENTS` (Kimi par défaut ; si l'utilisateur demande DeepSeek, ajoute `--fournisseur deepseek`, et `--sortie site-deepseek` pour garder la version Kimi à côté). Si la réponse est coupée ou vide, rien n'est écrit : signale-le à l'utilisateur avec le coût, sans relancer automatiquement.
3. Vérifie : `node scripts/verifier.mjs $ARGUMENTS`. Relis aussi toi-même les prix, chiffres et citations signalés, et compare les textes au cahier (Kimi ne doit rien inventer ni réécrire).
4. Contrôle le rendu en desktop puis en mobile (375 × 812) : sers le site avec `node scripts/servir.mjs $ARGUMENTS 4300` (en arrière-plan ; un port libre par site si plusieurs tournent) et fais des captures avec `node scripts/capture.mjs`. Teste aussi chaque démo : la fenêtre « Démonstration » doit s'ouvrir.
5. `node scripts/suivi.mjs maj $ARGUMENTS en-revue`, puis donne à l'utilisateur : l'URL locale, les pages créées, le coût de l'appel et la liste des points à vérifier. Tu ne modifies pas le code du site toi-même : les corrections passent par `/fix`.
