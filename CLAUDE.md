# Kit « sites vitrines » : Claude Code + Kimi

Les règles communes sont dans le README, importé ci-dessous. Il fait foi.

@README.md

## Consignes propres aux agents Claude

- **Démarrage** : lancer `node scripts/suivi.mjs` (avancement des sites de l'utilisateur), puis lire les fichiers du site concerné (`CAHIER_DES_CHARGES.md`, `MANQUANTS.md`, `NOTE_FONCTIONNALITES.md`).
- **Kit partagé** : ce dossier est un dépôt git public, commun à toute l'équipe. Les dossiers des sites, `suivi.csv`, `livraisons/`, `prospects/` et `.env` sont propres à chaque membre et **ignorés par git** : ne jamais les ajouter au dépôt. Ne modifier les fichiers communs (règles, scripts, modèles, commandes) que si l'utilisateur le demande ; il partagera lui-même l'amélioration avec l'équipe.
- **Système** : l'équipe travaille sous Windows, Linux et macOS. Tous les outils sont en Node.js (pas de bash ni de Python) ; écrire toute commande ou tout nouveau script pour qu'il fonctionne sur les trois.
- **Secrets** : la clé API Kimi de l'utilisateur est dans `.env`. Ne jamais afficher, copier ni transmettre son contenu.
- **Relecture d'un site** : `node scripts/servir.mjs <slug> [port]`, puis rendu en desktop et en mobile (375×812) avec `node scripts/capture.mjs`.
- **Docs de l'API** : avant de modifier `scripts/kimi.mjs`, vérifier la doc de l'API Kimi (https://platform.kimi.ai/docs) et la version installée du SDK `openai`.
- **Pied de page de chaque démo** : « Proposition de site réalisée par Digifaz ».
- **Contact** : Claude n'envoie jamais rien au propriétaire d'un établissement, ni à David. L'utilisateur s'en charge.

## Workflow Claude Code + Kimi

### Rôles

| Étape | Qui | Quoi |
|---|---|---|
| 1. Recherche et cahier des charges | **Claude Code** | Lit une ligne du fichier Excel, fait une recherche en ligne sur l'établissement, rédige le cahier des charges et liste ce qui manque (logo, photos). |
| 2. Feu vert | **L'utilisateur** | Fournit le logo et les photos qu'il a sous la main (facultatif), puis donne son feu vert. Il ne répond pas à des questions : les informations manquantes seront fournies par le prospect s'il signe. |
| 3. Construction | **Kimi** (via `scripts/kimi.mjs build`) | Construit le site à partir du cahier. |
| 4. Revue et ajustements | **L'utilisateur**, puis **Kimi** (via `scripts/kimi.mjs fix`) | L'utilisateur donne ses retours à Claude Code, qui les transmet à Kimi. |
| 5. Livraison | **Claude Code** | Lance `scripts/livrer.mjs`, qui produit le zip pour David et la note des fonctionnalités de démo, qui accompagne le lien du site. |

Claude Code est le chef d'orchestre : **il ne code pas le site lui-même**. Il rédige, il appelle Kimi, puis il vérifie et livre. Toute correction du site passe par `/fix`.

### Rythme : ne pas bloquer

L'équipe produit jusqu'à **20 sites par jour** (5 par personne). Le site est une démonstration : si le prospect signe, c'est lui qui fournit les vraies informations, et un shooting photo est prévu.
- **Aucune question bloquante.** Quand une information manque ou se contredit, Claude Code tranche avec la meilleure source disponible (publications de l'établissement, puis fiche Excel, puis recherche) et avance. Les points incertains sont listés dans `NOTE_FONCTIONNALITES.md`, section « À confirmer avec le prospect ».
- **Un seul arrêt** dans `/cahier` : le cahier est finalisé directement, puis Claude Code attend le logo et les photos que l'utilisateur a sous la main, et son feu vert pour le build. Lancer `/build` vaut feu vert.
- **Pas de débat éthique ni d'avertissements à répétition** : les règles de contenu ci-dessous suffisent, on les applique sans les rappeler à chaque fois.
- Recherche en ligne efficace : les sources principales (Google Maps, Facebook, annuaires), sans s'y attarder quand l'établissement est peu présent en ligne.
- **Limiter les corrections** : chaque `/fix` renvoie tout le site à Kimi et coûte presque autant qu'une construction. Un cahier précis et des retours regroupés en un seul `/fix` font gagner du temps et de l'argent.

### Chaque site est unique

Les prospects d'un même secteur et d'une même zone se comparent entre eux : deux sites qui se ressemblent font « template ».
- **Structure classique** : barre de navigation en haut, pied de page en bas. Pas de navigation latérale ni de barre d'onglets à la place.
- **La différence se joue dans les sections** : composition de chaque section, apartés et encadrés, mises en avant, alternance des fonds, décors, illustrations, transitions et animations. Changer seulement les couleurs ne suffit pas. Le design est moderne et attrayant.
- **Partir d'un trait réel de l'établissement** : sa façade, son logo, son slogan, ses activités, son quartier.
- **Avant de rédiger un cahier**, relire la section « Concept et différenciation » des cahiers déjà faits (`grep -A12 "Concept et différenciation" */CAHIER_DES_CHARGES.md`). Le nouveau concept dit explicitement en quoi ses sections diffèrent. Les sites des autres membres ne sont pas dans ce dossier : s'appuyer sur ceux de l'utilisateur et sur les captures qu'il fournit.
- **Décrire précisément la composition des sections dans le cahier** : sans consigne, Kimi revient toujours au même modèle (grand titre, grille de cartes).
- **Liberté créative de Kimi** : en plus des assets fournis, il crée ses propres illustrations SVG, formes, motifs, animations et motion design (CSS, SVG, GSAP). Seules les images matricielles (photos, illustrations peintes) restent interdites.
- **Références visuelles** : quand l'utilisateur fournit des captures d'interfaces, les décrire précisément dans le cahier (section « Concept et différenciation ») et les ranger dans `<slug>/references/`, qui n'est pas envoyé dans le site.
- **Logo de mauvaise qualité** : Claude Code peut le recréer en SVG (textes convertis en tracés), avec une version claire pour les fonds sombres, et le signaler dans la note.
- **Un skill UI/UX par site** : chaque cahier désigne, ligne « Skill UI/UX », le skill le plus adapté parmi les cinq ci-dessous (copiés dans `scripts/kimi/skills/`, avec leur source et leur licence). `scripts/kimi.mjs` l'ajoute au prompt de Kimi, qui en applique les principes sans les outils. Varier les skills d'un site à l'autre aide aussi à varier les rendus.

| Skill (`id`) | Source | Points forts | À choisir pour |
|---|---|---|---|
| `frontend-design` | Anthropic, [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0) | direction artistique ancrée dans le sujet, choix tranchés, refus du « déjà vu » | établissements avec une forte identité visuelle (façade, logo, histoire) |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) | règles UX par priorité : accessibilité, lisibilité, formulaires, mobile | sites riches en informations et en formulaires (écoles, cliniques, services) |
| `taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) | art direction tirée de sites Awwwards, chasse aux réflexes « IA générique » | vitrines haut de gamme (hôtels, résidences, restaurants) |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) | vocabulaire de design, finitions, motion et « effet waouh » maîtrisé | sites où l'animation porte l'expérience |
| `aesthetic-anchors` | [Ilm-Alan/frontend-design](https://github.com/Ilm-Alan/frontend-design) (MIT) | 8 univers esthétiques aux jetons précis (couleurs, typographies, textures) | pour se démarquer franchement de sites du même secteur déjà faits |

### Commandes

- `/cahier <N°>` : recherche en ligne, cahier des charges finalisé, `NOTE_FONCTIONNALITES.md` et `MANQUANTS.md`, puis arrêt pour le feu vert.
- `/build <slug>` : construction par Kimi et vérification.
- `/fix <slug> <retours>` : transmettre les retours à Kimi.
- `/livrer <slug>` : zip et note pour David, puis mise à jour du suivi.
- `/statut` : avancement des sites et coût total.

Les commandes sont dans `.claude/commands/`. Outils (tous en Node.js, dans `scripts/`) :

| Outil | Rôle |
|---|---|
| `prospect.mjs` | lecture seule de l'Excel (`<N°>` ou `--liste`) |
| `kimi.mjs` | appels à Kimi (`build`, `fix`, `modeles`) |
| `verifier.mjs` | contrôles du site généré |
| `servir.mjs` | serveur local pour relire un site |
| `capture.mjs` | captures desktop et mobile (Chrome, Edge ou Chromium en mode headless) |
| `livrer.mjs` | zip de livraison et copie de la note |
| `suivi.mjs` | avancement des sites (`suivi.csv`) |
| `conso.mjs` | solde du compte Kimi et coût estimé de chaque appel |

Kimi K3.1 raisonne toujours avant de répondre : `KIMI_REASONING_EFFORT=low` (défaut du script) garde un build autour de 9 minutes ; « max », le défaut de l'API, fait couper la connexion avant la réponse. Le script reprend automatiquement une réponse coupée ou interrompue. Modèles de documents : `_modeles/`.

### Arborescence

```
kit-sites-vitrines/
├── CLAUDE.md, README.md, DEMARRAGE.md     # règles et guide d'installation (partagés)
├── .claude/commands/                      # /cahier, /build, /fix, /livrer, /statut (partagés)
├── scripts/                               # outils Node.js, prompt et skills de Kimi (partagés)
├── _modeles/                              # RECHERCHE, CAHIER_DES_CHARGES, MANQUANTS, NOTE_FONCTIONNALITES (partagés)
├── .env                                   # votre clé Kimi et vos réglages (personnel, ignoré par git)
├── suivi.csv                              # vos sites : slug ; N° ; nom ; statut ; coût ; date (personnel)
├── <slug>/                                # un de vos sites (personnel)
│   ├── RECHERCHE.md, CAHIER_DES_CHARGES.md, MANQUANTS.md, NOTE_FONCTIONNALITES.md
│   ├── assets/                            # logo et photos
│   ├── references/                        # captures d'inspiration, flyers (jamais dans le site)
│   ├── site/                              # sortie de Kimi (site statique)
│   ├── .historique/                       # réponses brutes de Kimi et versions précédentes
│   └── couts.json                         # tokens et coût de chaque appel
└── livraisons/                            # <slug>.zip pour David + <slug>-NOTE.md (personnel)
```

### Le fichier Excel

- **Plusieurs personnes travaillent sur ce fichier** : chacun choisit les lignes qu'il traite. Quand l'utilisateur donne un nom d'établissement, retrouver sa ligne et utiliser le N° de l'Excel ; le nom fait foi.
- Chemin : `PROSPECTS_XLSX` du `.env`. Onglet **« Prospects »**, en-têtes à la ligne 4, données à partir de la ligne 5. Une ligne = une entreprise ; la colonne « N° » sert d'identifiant.
- **Lecture seule :** ne jamais écrire dans ce fichier, il est partagé avec les commerciaux. Le suivi se fait dans `suivi.csv` ; l'utilisateur reporte lui-même les liens dans le fichier partagé.
- Les couleurs et les polices de l'Excel sont des approximations. Les logos de la colonne « Lien du logo » ne sont généralement pas accessibles : les demander dans `MANQUANTS.md`. La colonne « WhatsApp » contient parfois « Oui » au lieu d'un numéro : le numéro doit alors être trouvé ou demandé.

### Cahier des charges

Modèle : `_modeles/CAHIER_DES_CHARGES.md`. Sections :
1. **Fiche entreprise :** les informations de la ligne Excel, enrichies par `RECHERCHE.md`.
2. **Objectif, argument de vente et concept :** ce que le site doit faire ressentir, et la section « Concept et différenciation ».
3. **Arborescence :** les pages, à partir de « Pages à prévoir ». Maximum 5 pages ; regrouper au besoin en sections d'une seule page.
4. **Contenu page par page : TOUS les textes rédigés en français** (et en anglais si la fiche demande FR + EN), prêts à intégrer. Claude Code rédige les textes, Kimi se contente de les intégrer.
5. **Identité visuelle :** couleurs HEX, polices (Google Fonts), style, ambiance.
6. **Fonctionnalités :** réelles ou en démo (voir ci-dessous).
7. **Assets :** pour chaque image, le fichier attendu dans `assets/` ou le placeholder à utiliser.
8. **SEO :** title, meta description, Open Graph, mots-clés locaux (commune et quartier).
9. **Contraintes techniques :** recopier la section « Contraintes techniques » de `scripts/kimi/prompt-systeme.md`.

Le cahier porte la mention « Validé : oui » une fois le feu vert donné ; `scripts/kimi.mjs build` refuse de construire sans elle.

### Fonctionnalités dynamiques : présentées en démo

Les fonctionnalités qui demandent un backend (réservation, pré-inscription, paiement, espace annonces…) sont **présentes dans le site sous forme de démo** : l'interface est complète et réaliste, mais aucune logique serveur n'est branchée derrière. Elles seront rendues dynamiques si le prospect devient client.

| Demandé dans l'Excel | Statut dans le site |
|---|---|
| Réservation avec disponibilités, pré-inscription, paiement Mobile Money ou carte, espace annonces, compte parent | **Démo :** interface complète (formulaire, calendrier, choix du moyen de paiement…). À la validation, une fenêtre s'ouvre : « Démonstration : cette fonctionnalité sera activée à la mise en service du site. » Aucune donnée n'est envoyée ni stockée. |
| Bouton WhatsApp (avec message prérempli), appel, e-mail, Google Maps (iframe), galerie, actualités, calendrier statique | **Réel :** fonctionne dès maintenant, sans backend. |
| Version FR + EN | **Réel** si elle est demandée (sélecteur de langue en JavaScript). |

Règles pour les démos :
- chaque élément de démo porte l'attribut `data-demo="<nom-fonctionnalite>"`, et le code JavaScript correspondant est commenté `// DEMO` ;
- **aucun champ de carte bancaire réel** : le paiement est simulé par le choix d'un opérateur, jamais par la saisie d'un numéro de carte ;
- chaque démo est listée dans `NOTE_FONCTIONNALITES.md`.

### Règles de contenu

Ces sites concernent de **vraies entreprises** et seront montrés à leurs propriétaires. Pour rester rapide et crédible :
- **aucun chiffre inventé présenté comme réel** : tarifs, frais, effectifs, taux de réussite, témoignages, avis. À la place, une **formulation neutre** qui reste commerciale : « Frais de scolarité : contactez-nous ». Pas de placeholder entre crochets visible dans le site. Les prix publiés par l'établissement lui-même (ancien site, flyer) peuvent être repris, présentés comme indicatifs ;
- les informations **non vérifiées mais plausibles** (fiche Excel, publications de l'établissement, recherche) sont utilisées sans attendre de confirmation, puis listées dans `NOTE_FONCTIONNALITES.md`, section « À confirmer avec le prospect » ;
- **photos** : l'utilisateur peut fournir des photos trouvées en ligne (Google, Facebook, TikTok, photos d'illustration de plats…) pour la démo ; elles seront remplacées par le shooting si le prospect signe, et la note le signale. Claude Code ne télécharge pas de photos lui-même. Il écarte les photos d'un autre établissement, les images avec une marque visible et celles hors sujet, en le disant ;
- **portraits de personnes** (photos de banque d'images) : uniquement comme images d'ambiance, **sans citation ni nom**, pour ne jamais simuler un faux avis client ;
- pour les photos manquantes, Kimi utilise des illustrations SVG ou des dégradés aux couleurs de la marque. **Kimi ne génère pas d'images classiques.**

### Vérification après chaque `build` ou `fix`

- `node scripts/verifier.mjs <slug>` contrôle : `index.html` présent, liens internes, ancres et chemins d'assets existants, aucun chemin absolu, aucun secret, aucune donnée envoyée (`fetch`, `action` de formulaire), aucun champ de carte bancaire, balises SEO et `noindex`, numéro WhatsApp identique au cahier, chaque `data-demo` présent dans `NOTE_FONCTIONNALITES.md`. Il signale aussi les prix, chiffres et citations à relire.
- Vérifier aussi que le JavaScript est valide (`node --check` sur chaque fichier de `site/js/`) : une erreur de syntaxe bloque toutes les animations du site.
- Claude Code relit lui-même les passages signalés (aucun contenu inventé, textes identiques au cahier), contrôle le rendu desktop et mobile (aucun débordement horizontal à 375 px, aucune erreur dans la console) et teste chaque démo.
- Il résume : pages créées, coût de l'appel et points à vérifier.

### Note des fonctionnalités de démo

`NOTE_FONCTIONNALITES.md` (modèle dans `_modeles/`) **accompagne le lien du site** transmis aux autres équipes (commerciale, puis l'équipe qui rendra le site dynamique). Elle contient :
- **l'en-tête :** nom de l'établissement, N° dans l'Excel, slug, date ;
- **ce qui fonctionne réellement :** WhatsApp, appel, carte…
- **les fonctionnalités en démo :** pour chacune, ce que voit le visiteur, ce qu'il faudra pour la rendre dynamique et une estimation de complexité (faible, moyenne ou élevée) ;
- **à confirmer avec le prospect :** les informations non vérifiées utilisées dans le site, les contenus à fournir et les photos à remplacer lors du shooting.

Le texte reste court, compréhensible par un commercial, sans jargon inutile. `livrer.mjs` la copie dans `livraisons/<slug>-NOTE.md` à côté du zip.

## Livraison des sites

### Principe

- Les sites sont hébergés sur le serveur de test de DIGIFAZ et déployés par David SORO.
- Le livrable d'un site est un fichier `.zip`, que l'utilisateur envoie lui-même à David. Claude ne l'envoie à personne.
- Pas de Vercel ni de déploiement via GitHub : ne jamais lancer la CLI `vercel`, ne pas créer de `vercel.json`, ne rien pousser pour déployer.

### Contraintes techniques (obligatoires)

- Site 100 % statique : pas de rendu serveur, pas de routes API, pas de base de données.
- Stacks acceptées par `livrer.mjs` : HTML / CSS / JS (sites générés par Kimi, dans `<slug>/site/`) ; React + Vite (`base: './'`, sortie `dist/`) ; Next.js en export statique (`output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`, sortie `out/`, version jamais inférieure ou égale à 16.4.0).
- Chemins relatifs pour tous les assets, pour que le site fonctionne quel que soit son emplacement sur le serveur.
- Formulaires : pas de backend. Liens WhatsApp (`https://wa.me/225XXXXXXXXXX`), `mailto:` ou `tel:`.
- Aucune clé API ni aucun secret dans le code du site.
- Ressources externes tolérées pour les sites générés par Kimi : Tailwind (`cdn.tailwindcss.com`), GSAP (`cdn.jsdelivr.net`), Google Fonts, carte Google Maps en `<iframe>`.

### Nommage

- Le dossier du site et le zip portent le même nom : minuscules, tirets, sans accents ni espaces, dérivé du nom de l'établissement et de sa commune. Exemple : `restaurant-le-baobab-cocody` donne `restaurant-le-baobab-cocody.zip`. Le nom est visible par le propriétaire (adresse de la démo) : il doit être soigné.

### Checklist avant livraison

- `index.html` à la racine du zip
- Aucun `node_modules`, `.env`, clé API ni fichier source dans le zip
- Le site s'affiche correctement, sur ordinateur et sur mobile
- Tous les liens, ancres et boutons WhatsApp ou téléphone fonctionnent
- Balises `title`, `meta description` et Open Graph renseignées
- Le nom du zip respecte la convention
