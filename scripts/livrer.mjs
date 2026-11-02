#!/usr/bin/env node
// Livraison d'un site vitrine : controles, build si necessaire, puis zip dans livraisons/.
//   node scripts/livrer.mjs <nom-du-site>
// Site genere par Kimi (<slug>/site/index.html) : verification par scripts/verifier.mjs (bloquante),
// zip de site/ et copie de NOTE_FONCTIONNALITES.md en livraisons/<slug>-NOTE.md.
// Autres stacks : Next.js (export statique, sortie out/), Vite (sortie dist/), HTML simple.
// Regles : section « Livraison des sites » de CLAUDE.md. Fonctionne sous Windows, Linux et macOS.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { creerZip, lireZip } from "./lib/zip.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIVRAISONS = join(RACINE, "livraisons");
const WINDOWS = process.platform === "win32";

const erreur = (m) => {
  console.error(`\n✗ ${m}`);
  process.exit(1);
};
const info = (m) => console.log(`› ${m}`);
const avertir = (m) => console.log(`! ${m}`);

// Fichiers et dossiers jamais livres pour un site HTML simple (le dossier du site sert de sortie)
const EXCLUS_HTML = new Set([
  ".git", ".gitignore", "node_modules", ".DS_Store", "Thumbs.db", "brief", "docs", "scripts", "src",
  "CLAUDE.md", "AGENTS.md", "README.md", "package.json", "package-lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
  "yarn.lock", "tailwind.config.js", "tailwind.config.ts", "postcss.config.js", "postcss.config.mjs", "tsconfig.json",
]);
// Fichiers systeme ignores partout
const IGNORES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

// --- Nom du site ---
const nom = (process.argv[2] || "").replace(/[\\/]+$/, "");
if (!nom) erreur("Usage : node scripts/livrer.mjs <nom-du-site>");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nom)) erreur(`Nom invalide : « ${nom} ». Minuscules, chiffres et tirets uniquement, sans accents ni espaces (ex. pharmacie-abobo).`);
const SITE = join(RACINE, nom);
if (!existsSync(SITE)) erreur(`Dossier introuvable : ${SITE}`);

// Liste recursive des fichiers (chemins relatifs, separateur /)
function lister(dossier, filtre = () => true, base = dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    const rel = relative(base, chemin).split(sep).join("/");
    if (IGNORES.has(e.name) || !filtre(rel, e.name)) return [];
    return e.isDirectory() ? lister(chemin, filtre, base) : [rel];
  });
}

// --- Detection de la stack ---
const premier = (...noms) => noms.map((n) => join(SITE, n)).find((f) => existsSync(f));
const configNext = premier("next.config.ts", "next.config.mjs", "next.config.js", "next.config.cjs");
const configVite = premier("vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs");
let stack;
let sortie;
if (existsSync(join(SITE, "site", "index.html"))) [stack, sortie] = ["kimi", join(SITE, "site")];
else if (configNext) [stack, sortie] = ["next", join(SITE, "out")];
else if (configVite) [stack, sortie] = ["vite", join(SITE, "dist")];
else if (existsSync(join(SITE, "index.html"))) [stack, sortie] = ["html", SITE];
else erreur(`Stack non reconnue : ni site/index.html, ni next.config, ni vite.config, ni index.html dans ${nom}.`);
info(`Site : ${nom} · stack : ${stack}`);

// --- Configuration statique obligatoire ---
const sansCommentaires = (f) => readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
if (stack === "next") {
  const c = sansCommentaires(configNext);
  const manque = [
    [/output\s*:\s*['"]export['"]/, "output: 'export'"],
    [/unoptimized\s*:\s*true/, "images: { unoptimized: true }"],
    [/trailingSlash\s*:\s*true/, "trailingSlash: true"],
  ].filter(([m]) => !m.test(c)).map(([, t]) => t);
  if (manque.length) erreur(`${basename(configNext)} n'est pas en export statique. Il manque : ${manque.join(" ; ")}`);
}
if (stack === "vite" && !/base\s*:\s*['"]\.\/['"]/.test(sansCommentaires(configVite))) {
  erreur(`${basename(configVite)} doit contenir base: './' (chemins relatifs).`);
}

// Lance une commande dans le dossier du site (shell requis sous Windows pour npm.cmd, pnpm.cmd…)
function lancer(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: SITE, stdio: "inherit", shell: WINDOWS });
  return r.status === 0;
}

// --- Controles ou build ---
if (stack === "kimi") {
  if (!existsSync(join(SITE, "NOTE_FONCTIONNALITES.md"))) erreur("NOTE_FONCTIONNALITES.md absent : il accompagne obligatoirement le lien du site.");
  info("Vérification du site (scripts/verifier.mjs)…");
  const r = spawnSync(process.execPath, [join(RACINE, "scripts", "verifier.mjs"), nom], { stdio: "inherit" });
  if (r.status !== 0) erreur("Vérification échouée : corriger les erreurs ci-dessus avant de livrer.");
} else {
  const pkg = join(SITE, "package.json");
  const aUnBuild = existsSync(pkg) && Boolean(JSON.parse(readFileSync(pkg, "utf8")).scripts?.build);
  if (stack !== "html" || aUnBuild) {
    if (!existsSync(pkg)) erreur("package.json introuvable : impossible de lancer le build.");
    const pm = existsSync(join(SITE, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(SITE, "yarn.lock")) ? "yarn" : "npm";
    if (!existsSync(join(SITE, "node_modules"))) {
      info(`Installation des dépendances (${pm})…`);
      const args = pm === "npm" ? [existsSync(join(SITE, "package-lock.json")) ? "ci" : "install"] : ["install", "--frozen-lockfile"];
      if (!lancer(pm, args)) erreur("L'installation des dépendances a échoué.");
    }
    // Sortie precedente supprimee pour ne jamais livrer un ancien build
    if (stack !== "html") rmSync(sortie, { recursive: true, force: true });
    info(`Build (${pm} run build)…`);
    if (!lancer(pm, ["run", "build"])) erreur("Le build a échoué.");
  }
}

// --- Fichiers a livrer ---
if (!existsSync(sortie)) erreur(`Dossier de sortie introuvable : ${sortie}`);
const fichiers = lister(sortie, (rel, n) => stack !== "html" || !EXCLUS_HTML.has(rel.split("/")[0]) || n === "index.html");
if (!fichiers.includes("index.html")) erreur(`index.html absent à la racine de la sortie (${sortie}).`);

// --- Controles de securite ---
const interdits = fichiers.filter((f) => f.split("/").some((p) => p === "node_modules" || p === ".env" || p.startsWith(".env.")));
if (interdits.length) erreur(`Livraison refusée : fichiers interdits dans la sortie :\n  ${interdits.slice(0, 5).join("\n  ")}`);
const sources = fichiers.filter((f) => /\.(tsx?|jsx|vue|svelte)$/.test(f) && !f.endsWith(".d.ts"));
if (sources.length) erreur(`Livraison refusée : fichiers sources dans la sortie :\n  ${sources.slice(0, 5).join("\n  ")}`);
const TEXTE = /\.(html?|css|js|mjs|json|txt|xml|svg|md|webmanifest)$/i;
const SECRET = /sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}/;
const contenu = (f) => readFileSync(join(sortie, ...f.split("/")));
const secrets = fichiers.filter((f) => TEXTE.test(f) && SECRET.test(contenu(f).toString("utf8")));
if (secrets.length) erreur(`Livraison refusée : ce qui ressemble à une clé API ou à un secret a été trouvé dans :\n  ${secrets.slice(0, 5).join("\n  ")}`);
// Chemins absolus : attendus en Next.js (/_next/), a signaler pour les autres stacks
if (stack !== "next") {
  const absolus = fichiers.filter((f) => /\.html?$/i.test(f) && /(src|href)="\/[^/]/.test(contenu(f).toString("utf8")));
  if (absolus.length) avertir(`Chemins absolus (src="/…" ou href="/…") dans : ${absolus.slice(0, 5).join(", ")}. Préférer des chemins relatifs.`);
}

// --- Zip ---
mkdirSync(LIVRAISONS, { recursive: true });
const zip = join(LIVRAISONS, `${nom}.zip`);
const tmp = `${zip}.tmp`;
writeFileSync(tmp, creerZip(fichiers.sort().map((f) => ({ nom: f, contenu: contenu(f) }))));
// Controle : index.html a la racine du zip relu
if (!lireZip(tmp).has("index.html")) {
  rmSync(tmp, { force: true });
  erreur("index.html n'est pas à la racine du zip.");
}
renameSync(tmp, zip);

const taille = statSync(zip).size;
const lisible = taille >= 1024 * 1024 ? `${(taille / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(taille / 1024)} Ko`;
console.log(`\n✓ Livraison prête\n  Zip    : ${zip}\n  Taille : ${lisible} (${fichiers.length} fichiers)`);

// Note des fonctionnalites de demo, qui accompagne le lien du site
const note = join(SITE, "NOTE_FONCTIONNALITES.md");
if (existsSync(note)) {
  copyFileSync(note, join(LIVRAISONS, `${nom}-NOTE.md`));
  console.log(`  Note   : ${join(LIVRAISONS, `${nom}-NOTE.md`)}`);
}
