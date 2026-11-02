# Kit « sites vitrines » — Claude Code + Kimi

Kit de l'équipe DIGIFAZ pour produire des **sites vitrines de démonstration** pour des prospects (écoles, hôtels, restaurants, résidences, commerces…), à partir du fichier de prospection.

Le principe : deux IA, chacune avec son rôle.
- **Claude Code** fait la recherche sur l'établissement et rédige un cahier des charges complet (textes, structure, couleurs, photos). Ensuite, il vérifie et livre le site.
- **Kimi** (API Moonshot) construit le site à partir de ce cahier, puis applique les corrections.

Vous validez le cahier, relisez le site et transmettez le zip à David, qui le déploie sur le serveur de test.

> Installation : voir **[DEMARRAGE.md](DEMARRAGE.md)**. Règles détaillées pour Claude : [CLAUDE.md](CLAUDE.md).

---

## En bref

- Chaque membre clone ce dépôt et y met **sa propre clé Kimi** dans `.env`. Ses sites, son suivi et ses livraisons restent sur son ordinateur : git les ignore.
- **Une ligne de l'Excel = un slug = un dossier = un zip livré.**
- **Claude Code ne code pas les sites** : il rédige, appelle Kimi, vérifie et livre. Toute correction passe par Kimi (`/fix`).
- Tout ce qui n'est pas écrit dans les fichiers est perdu d'une session à l'autre : les décisions vont dans le cahier et la note du site.

## Le circuit d'un site

| Étape | Commande | Statut dans `suivi.csv` |
|---|---|---|
| 1. Recherche en ligne, cahier finalisé, note et liste du logo et des photos utiles | `/cahier <N°>` | `recherche`, puis `cahier-a-valider` |
| 2. Vous déposez le logo et les photos que vous avez dans `<slug>/assets/`, et donnez votre feu vert | `/build <slug>` vaut feu vert | `cahier-valide` |
| 3. Construction par Kimi, vérification | `/build <slug>` | `en-revue` |
| 4. Vos retours, corrections par Kimi (regroupez-les : chaque correction coûte) | `/fix <slug> <retours>` | `en-revue` |
| 5. Livraison : zip et note pour David | `/livrer <slug>` | `livre` |
| Avancement de vos sites | `/statut` | — |

Coût indicatif constaté : environ **0,30 à 0,70 $ par construction** et **0,25 à 0,50 $ par correction** (tarifs Kimi à vérifier sur votre tableau de bord). `node scripts/conso.mjs` affiche votre solde et le coût estimé de chaque appel.

---

## Préférences de travail

- **Langue** : échanges en français ; textes des sites en français avec accents ; commentaires de code en français **sans accents**.
- **Rythme** : jusqu'à 5 sites par personne et par jour. Aucune question bloquante : les informations manquantes seront fournies par le prospect s'il signe.
- **Vérification** : Claude Code contrôle lui-même chaque site (`scripts/verifier.mjs`, rendu desktop et mobile 375 px) avant de le présenter.
- **Secrets** : la clé Kimi reste dans `.env`, jamais affichée, copiée ni ajoutée au dépôt.
- **Améliorer le kit** : une règle ou un script amélioré profite à toute l'équipe. Proposez-le dans le dépôt, avec une branche et une pull request, plutôt que de le garder pour vous.

## Stack des sites

- **HTML, CSS et JavaScript vanilla**, sans build, dans `<slug>/site/`. Chemins relatifs partout.
- Ressources externes autorisées, et seulement celles-ci : **Tailwind via CDN**, **GSAP via CDN** (`cdn.jsdelivr.net`), **Google Fonts**, carte **Google Maps** en `<iframe>`.
- Les règles données à Kimi sont dans `scripts/kimi/prompt-systeme.md`. Le modifier change le comportement de Kimi pour toute l'équipe.
- Kimi crée librement ses illustrations SVG, formes, animations et motion design ; il ne génère pas d'images matricielles.
- Skills UI/UX : cinq skills publiés sur GitHub sont copiés dans `scripts/kimi/skills/`, avec leur licence ; le cahier de chaque site en désigne un.

## Outils requis

| Outil | Rôle |
|---|---|
| **Claude Code** | l'agent qui orchestre tout (commandes `/cahier`, `/build`…) |
| **Node.js 22** ou plus récent | tous les scripts du kit (`npm install` une fois pour le SDK `openai`) |
| **Git** | récupérer le kit et ses mises à jour (`git pull`) ; sous Windows, Git for Windows fournit aussi le terminal Bash utilisé par Claude Code |
| **Google Chrome** (ou Edge, ou Chromium) | captures d'écran pour vérifier le rendu |
| **Kimi** (API Moonshot, `https://api.moonshot.ai/v1`) | modèle `kimi-k3.1-pro`, une clé par personne |

---

## Direction artistique : se démarquer

Ces sites sont des propositions commerciales. Le propriétaire doit se dire « je n'ai jamais vu ça pour un établissement comme le mien ».

### Principes
1. **Partir de l'âme du lieu** : logo, couleurs, matériaux, lumière, quartier, histoire, clientèle. On ne recycle jamais un site précédent.
2. **Un moment signature** dans la première section, sobre et soigné (CSS ou GSAP).
3. **Typographie expressive** : une police d'affichage avec du caractère et une police de texte lisible, avec de forts contrastes d'échelle.
4. **Mettre en scène les photos fournies** (cadrages, masques, formes) au lieu de les poser dans des cartes.
5. **Du rythme** : alterner sections denses et respirations.
6. **Aucun site ne ressemble à un autre** : structure classique (barre de navigation en haut, pied de page en bas), mais composition des sections, apartés, décors, illustrations et animations différents à chaque site.

### À proscrire (le look « template » ou « IA générique »)
- Dégradés violet-bleu génériques, glassmorphism partout
- Inter, Roboto ou Arial par défaut, sans intention
- Grilles de 3 cartes identiques « icône + titre + texte »
- Emojis utilisés comme icônes ; photos de banque d'images quand de vraies photos existent
- Lorem ipsum ; fausses promotions, comptes à rebours ou avis inventés
- Animations gratuites qui gênent la lecture

### Garde-fous
- **Mobile d'abord** : le propriétaire ouvrira très probablement le lien sur son téléphone.
- **`prefers-reduced-motion`** : les animations se réduisent à de simples fondus.
- **Performance** : pages légères, images aux bonnes dimensions.
- **Animer uniquement `transform` et `opacity`**.
- **Accessibilité** : contrastes AA, navigation au clavier, `alt` descriptifs, HTML sémantique.

### Aide-mémoire par secteur

| Secteur | Sections clés | Action principale | Pistes de moment signature |
|---|---|---|---|
| École | Projet pédagogique, cycles, vie scolaire, inscriptions et frais, contact | Pré-inscription (démo), WhatsApp | Chiffres clés réels qui défilent, frise des cycles |
| Hôtel | Chambres, services (piscine, restaurant), galerie, accès, avis | Réserver (démo), WhatsApp | Photo dans un masque, plan interactif, galerie horizontale |
| Restaurant | Carte, ambiance, horaires, événements | Réserver une table (démo), commander sur WhatsApp | Plats mis en scène, carte façon ardoise |
| Résidence, immobilier | Logements et plans, équipements, quartier | Planifier une visite | Plans SVG qui se dessinent |
| Organisation, association | Mission, actions, équipe, partenaires | Contacter, soutenir | Compteurs d'impact, récit au défilement |
| Commerce, services | Produits ou prestations, réalisations, zone d'intervention | Demander un devis sur WhatsApp | Avant/après, produits mis en scène |

---

## Règles pour des sites de prospection

Ces sites sont des **propositions non sollicitées**, hébergées publiquement. Les règles suivantes sont obligatoires.

- **`noindex, nofollow`** sur toutes les pages jusqu'à la signature.
- **Aucun chiffre inventé présenté comme réel** (avis, notes, effectifs, tarifs, frais) : une formulation neutre à la place. Les informations plausibles mais non vérifiées sont utilisées, puis listées « à confirmer avec le prospect » dans la note.
- **Aucune donnée collectée** : les formulaires sont des démos qui n'envoient ni ne stockent rien. Les boutons d'action réels pointent vers `tel:`, WhatsApp, `mailto:` ou une plateforme existante.
- **Données privées** : jamais de notes de prospection, de contacts personnels du propriétaire ni de clé API dans `<slug>/site/` ni dans le zip.
- **Mention discrète en pied de page** : « Proposition de site réalisée par **Digifaz** ».
- **Démo uniquement sur le serveur de test DIGIFAZ** : pas de nom de domaine qui imite celui de l'établissement.
- **Crédits** : citer les auteurs des photos quand ils sont connus.

## Checklist qualité avant livraison

- [ ] Feu vert sur le cahier, textes du site identiques au cahier
- [ ] `node scripts/verifier.mjs <slug>` sans erreur ; prix, chiffres et citations signalés relus
- [ ] Rendu impeccable à 375 px, 768 px et 1440 px, sans débordement ni erreur dans la console
- [ ] `prefers-reduced-motion` respecté
- [ ] Aperçu de partage soigné : `og:image`, titre, description
- [ ] `noindex, nofollow` actif
- [ ] Tous les liens fonctionnent : téléphone, WhatsApp, e-mail, Google Maps, réseaux
- [ ] Chaque démo ouvre le message de démonstration et figure dans `NOTE_FONCTIONNALITES.md`
- [ ] Aucun lorem ipsum, aucun contenu inventé présenté comme réel
- [ ] Zip et note dans `livraisons/`, `suivi.csv` à jour

## Après la signature d'un client

1. Retirer `noindex`, ajouter `sitemap.xml`, `robots.txt` et les données structurées schema.org.
2. Rendre dynamiques les fonctionnalités en démo, d'après `NOTE_FONCTIONNALITES.md`.
3. Remplacer les photos d'illustration et les contenus provisoires par les vrais.
4. Brancher le nom de domaine du client et un hébergement adapté.
5. Ajouter les mentions légales et la politique de confidentialité.

## Licence

Les skills de `scripts/kimi/skills/` gardent leur licence d'origine (fichier `LICENSE` de chaque dossier, source dans `SOURCE.md`).
