# Démarrage

Installation à faire une fois par ordinateur, en 15 minutes environ. Les commandes sont données pour **Windows** (PowerShell) et pour **Linux** (terminal).

## 1. Installer les outils

| Outil | Windows (PowerShell) | Linux (Debian, Ubuntu) |
|---|---|---|
| Git | `winget install Git.Git` | `sudo apt install git` |
| Node.js 22 ou plus | `winget install OpenJS.NodeJS.LTS` | voir https://nodejs.org (paquet `nodejs` 22+) |
| Google Chrome | déjà installé, sinon `winget install Google.Chrome` (Edge convient aussi) | `google-chrome-stable` ou `chromium` |
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` | `curl -fsSL https://claude.ai/install.sh \| bash` |

Fermez puis rouvrez le terminal, et vérifiez :

```
node --version
git --version
claude --version
```

`node --version` doit afficher `v22` ou plus.

## 2. Récupérer le kit

```
git clone https://github.com/GueuAlex/site-generator.git kit-sites-vitrines
cd kit-sites-vitrines
npm install
```

## 3. Créer votre fichier `.env`

Copiez `.env.example` en `.env` (Windows : `copy .env.example .env` ; Linux : `cp .env.example .env`), puis ouvrez `.env` et remplissez :

- **`MOONSHOT_API_KEY`** : votre clé Kimi personnelle (console : https://platform.kimi.ai, rubrique API Keys). Elle ne doit jamais être partagée ni ajoutée au dépôt : `.env` est ignoré par git.
- **`DEEPSEEK_API_KEY`** : votre clé DeepSeek personnelle, transmise en privé. Elle permet de construire un site avec DeepSeek au lieu de Kimi (`--fournisseur deepseek`).
- **`PROSPECTS_XLSX`** : le chemin de votre copie synchronisée du fichier Excel de prospection, sans guillemets. Exemple Windows : `PROSPECTS_XLSX=C:/Users/vous/OneDrive/Prospection.xlsx`.

Vérifiez que tout répond :

```
node scripts/prospect.mjs --liste
node scripts/kimi.mjs modeles
node scripts/conso.mjs
node scripts/kimi.mjs modeles --fournisseur deepseek
```

La première commande liste les prospects. La deuxième doit citer `kimi-k3.1-pro`, la troisième affiche vos soldes Kimi et DeepSeek, et la quatrième doit citer `deepseek-v4-pro` (si vous avez une clé DeepSeek).

## 4. Travailler

Ouvrez Claude Code **dans le dossier du kit** (`cd kit-sites-vitrines`, puis `claude`). Il charge alors automatiquement les règles (`CLAUDE.md`) et les commandes :

```
/cahier 42
```

Claude Code lit la ligne 42 de l'Excel, fait la recherche et rédige le cahier, puis s'arrête. Déposez le logo et les photos que vous avez dans le dossier du site, sous `assets/`, puis :

```
/build <slug>
/fix <slug> vos retours, tous regroupés en un seul message
/livrer <slug>
```

Le zip et la note se trouvent ensuite dans `livraisons/`. Envoyez le zip à David et joignez la note au lien. `/statut` affiche l'avancement de vos sites.

## 5. Mettre à jour le kit

Quand une amélioration est publiée dans le dépôt :

```
git pull
npm install
```

Vos sites, votre `.env`, votre suivi et vos livraisons ne sont pas touchés : git les ignore.

## En cas de problème

- **« Navigateur introuvable »** pendant les captures : ajoutez `CHROME_PATH=<chemin de chrome.exe ou msedge.exe>` dans `.env`.
- **`MOONSHOT_API_KEY absente`** : le fichier s'appelle bien `.env` (et non `.env.txt`) et se trouve à la racine du kit.
- **Réponse de Kimi coupée** : le script reprend automatiquement jusqu'à 3 fois. Si rien n'est écrit, relancez la commande plus tard.
- **Solde épuisé** : `node scripts/conso.mjs` affiche les soldes Kimi et DeepSeek ; rechargez le compte concerné sur sa console.
- **Tester DeepSeek** (facultatif) : ajoutez `DEEPSEEK_API_KEY` dans `.env`, puis `node scripts/kimi.mjs modeles --fournisseur deepseek` doit citer `deepseek-v4-pro`.
