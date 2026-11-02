---
description: Recherche en ligne et cahier des charges finalisé d'un prospect de l'Excel (un seul arrêt : logo, photos et feu vert de l'utilisateur)
argument-hint: <N° de la ligne Excel>
---

Prospect n° **$ARGUMENTS** du fichier de prospection. Suis la section « Workflow Claude Code + Kimi » de `CLAUDE.md`, en particulier « Rythme : ne pas bloquer » : **aucune question bloquante**, on tranche et on avance.

**Si `<slug>/` existe déjà et que l'utilisateur vient de déposer des fichiers dans `<slug>/assets/` ou de donner son feu vert : passe directement à l'étape 6.**

## Recherche (rapide)
1. Lis la ligne : `node scripts/prospect.mjs <N°>` (lecture seule, ne jamais écrire dans l'Excel). Si un nom d'établissement est donné, retrouve son N° avec `node scripts/prospect.mjs --liste` : le nom fait foi, un nombre seul peut être un numéro d'ordre personnel et non le N° de l'Excel.
2. Génère le slug à partir du nom (minuscules, tirets, sans accents ni mots vides superflus, ex. `restaurant-le-baobab-cocody`). Vérifie qu'il n'existe pas déjà. Crée `<slug>/` et `<slug>/assets/`, puis `node scripts/suivi.mjs maj <slug> recherche --numero $ARGUMENTS --nom "<Nom>"`.
3. Recherche sur les sources principales : fiche Google Maps (coordonnées, horaires, note), page Facebook (À propos, publications visibles), Instagram, annuaires, ancien site éventuel. Ne pas s'attarder si l'établissement est peu présent en ligne.
4. Rédige `<slug>/RECHERCHE.md` d'après `_modeles/RECHERCHE.md` : chaque information avec sa source et sa date de consultation, et les contradictions avec la fiche Excel.

## Cahier finalisé, note et photos utiles
5. Relis la section « Concept et différenciation » des cahiers déjà faits (`grep -A12 "Concept et différenciation" */CAHIER_DES_CHARGES.md`), puis rédige directement la version finale de `<slug>/CAHIER_DES_CHARGES.md` d'après `_modeles/CAHIER_DES_CHARGES.md` (« Validé : non ») :
   - structure classique (barre de navigation en haut, pied de page en bas) ; un concept dont les sections, apartés, décors et animations diffèrent des sites déjà faits, tiré d'un trait réel de l'établissement, décrit précisément ;
   - la ligne « Skill UI/UX » avec le skill le plus adapté parmi les cinq de `CLAUDE.md` (varier d'un site à l'autre) ;
   - tous les textes de la section 4 rédigés en français, prêts à intégrer ;
   - chaque contradiction tranchée avec la meilleure source ; chaque information inconnue remplacée par une formulation neutre (jamais de chiffre inventé, pas de crochets visibles) ;
   - section 9 : recopie la partie « Contraintes techniques » de `scripts/kimi/prompt-systeme.md`.
6. Intègre les fichiers présents dans `<slug>/assets/` (vérifie qu'ils montrent bien l'établissement ; renomme-les si besoin et mets à jour la section 7).
7. Rédige `<slug>/NOTE_FONCTIONNALITES.md` d'après `_modeles/NOTE_FONCTIONNALITES.md`, avec la section « À confirmer avec le prospect ».
8. Rédige `<slug>/MANQUANTS.md` d'après `_modeles/MANQUANTS.md` : seulement le logo et les photos qui amélioreraient la démo, sans questions.
9. `node scripts/suivi.mjs maj <slug> cahier-a-valider`, puis **arrête-toi** : résume en quelques lignes ce qui a été trouvé et tranché, et demande à l'utilisateur le logo et les photos qu'il a sous la main, et son feu vert.
10. Au feu vert : passe « Validé » à « oui », `node scripts/suivi.mjs maj <slug> cahier-valide`, puis propose `/build <slug>`.
