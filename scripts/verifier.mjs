#!/usr/bin/env node
// Controles automatiques d'un site genere par Kimi (section 7 du brief), avant revue et livraison.
//   node scripts/verifier.mjs <slug>
// Code de sortie : 0 si aucune erreur (les avertissements restent a verifier a la main), 1 sinon.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage : node scripts/verifier.mjs <slug>");
  process.exit(1);
}
const DOSSIER = join(RACINE, slug);
const SITE = join(DOSSIER, "site");

// Domaines externes autorises (voir CLAUDE.md, « Livraison des sites »)
const DOMAINES_AUTORISES = ["cdn.tailwindcss.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com", "www.google.com", "maps.google.com", "wa.me", "api.whatsapp.com",
  // Liens vers les reseaux de l'etablissement
  "www.facebook.com", "facebook.com", "www.instagram.com", "instagram.com", "www.tiktok.com", "tiktok.com"];
const SECRETS = /sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}/;

const erreurs = [];
const avertissements = [];
const lister = (d) =>
  !existsSync(d) ? [] : readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lister(join(d, e.name)) : [join(d, e.name)]));
const rel = (f) => relative(SITE, f).split(sep).join("/");

if (!existsSync(join(SITE, "index.html"))) erreurs.push("index.html absent de site/.");
const fichiers = lister(SITE);
const pages = fichiers.filter((f) => f.endsWith(".html"));
const textes = fichiers.filter((f) => /\.(html|css|js|json|svg|txt|xml|webmanifest)$/.test(f));

// --- Liens internes, assets, ancres, chemins absolus, domaines externes ---
const ids = new Map(pages.map((p) => [rel(p), new Set([...readFileSync(p, "utf8").matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]))]));
const externes = new Set();
for (const f of textes) {
  const contenu = readFileSync(f, "utf8");
  const refs = [
    ...[...contenu.matchAll(/\s(?:href|src|poster|data-src)=["']([^"']*)["']/g)].map((m) => m[1]),
    ...[...contenu.matchAll(/srcset=["']([^"']*)["']/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0])),
    ...(f.endsWith(".css") || f.endsWith(".html") ? [...contenu.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]) : []),
  ];
  for (const brut of refs) {
    const ref = brut.trim();
    if (!ref || ref.startsWith("data:") || ref.startsWith("javascript:") || /^(mailto|tel|sms):/i.test(ref) || ref.includes("${")) continue;
    if (/^(https?:)?\/\//i.test(ref)) {
      externes.add(new URL(ref.startsWith("//") ? `https:${ref}` : ref).hostname);
      continue;
    }
    if (ref.startsWith("/")) {
      erreurs.push(`${rel(f)} : chemin absolu « ${ref} » (les chemins doivent être relatifs).`);
      continue;
    }
    const [chemin, ancre] = ref.split("#");
    // Dans un script, les chemins se resolvent depuis la page qui le charge (racine du site), pas depuis js/
    const base = f.endsWith(".js") ? "" : posix.dirname(rel(f));
    const cible = chemin ? posix.normalize(posix.join(base, decodeURI(chemin.split("?")[0]))) : rel(f);
    if (chemin) {
      const absolu = join(SITE, normalize(cible));
      if (!existsSync(absolu) && !existsSync(join(absolu, "index.html"))) erreurs.push(`${rel(f)} : « ${ref} » pointe vers un fichier absent.`);
    }
    if (ancre && cible.endsWith(".html") && ids.has(cible) && !ids.get(cible).has(ancre)) {
      erreurs.push(`${rel(f)} : ancre « #${ancre} » introuvable dans ${cible}.`);
    }
  }
  if (SECRETS.test(contenu)) erreurs.push(`${rel(f)} : ressemble à une clé API ou à un secret.`);
  // --- Aucune donnee envoyee ---
  if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket/.test(contenu)) erreurs.push(`${rel(f)} : appel réseau (fetch, XMLHttpRequest, sendBeacon ou WebSocket) interdit.`);
  for (const m of contenu.matchAll(/<form\b[^>]*\saction=["']([^"']*)["']/gi)) {
    if (m[1] && m[1] !== "#") erreurs.push(`${rel(f)} : formulaire avec action « ${m[1]} » (les démos n'envoient rien).`);
  }
  if (/type=["'](?:text|tel|number)["'][^>]*(?:card|carte|cvv|cvc|expir)/i.test(contenu) || /autocomplete=["']cc-/i.test(contenu)) {
    erreurs.push(`${rel(f)} : champ de carte bancaire détecté (le paiement doit être simulé par le choix d'un opérateur).`);
  }
}
for (const d of externes) if (!DOMAINES_AUTORISES.includes(d)) avertissements.push(`Ressource externe non prévue : ${d}`);

// --- Pages : formulaires sans demo, balises SEO, WhatsApp, pied de page ---
const cahier = existsSync(join(DOSSIER, "CAHIER_DES_CHARGES.md")) ? readFileSync(join(DOSSIER, "CAHIER_DES_CHARGES.md"), "utf8") : "";
// Numero attendu : le lien wa.me du cahier, sinon un numero en 225 sur une ligne « WhatsApp »
const ligneWa = cahier.split("\n").find((l) => /whatsapp/i.test(l) && /225\d{10}/.test(l.replace(/\D/g, "")));
const numeroAttendu = cahier.match(/wa\.me\/(\d+)/)?.[1] ?? ligneWa?.replace(/\D/g, "").match(/225\d{10}/)?.[0];
const demos = new Set();
for (const p of pages) {
  const html = readFileSync(p, "utf8");
  for (const m of html.matchAll(/data-demo=["']([^"']+)["']/g)) demos.add(m[1]);
  for (const m of html.matchAll(/<form\b([^>]*)>/gi)) {
    // Formulaire accepte s'il porte data-demo ou s'il est dans une section data-demo encore ouverte
    const avant = html.slice(0, m.index);
    const dansDemo = avant.lastIndexOf("data-demo=") > avant.lastIndexOf("</section>");
    if (!/data-demo=/.test(m[1]) && !dansDemo) avertissements.push(`${rel(p)} : formulaire hors d'un élément data-demo.`);
  }
  for (const [nom, motif] of [["title", /<title(\s[^>]*)?>[^<]+<\/title>/], ["meta description", /<meta[^>]+name=["']description["']/], ["og:title", /property=["']og:title["']/], ["og:description", /property=["']og:description["']/], ["og:image", /property=["']og:image["']/], ["noindex", /<meta[^>]+name=["']robots["'][^>]*noindex/]]) {
    if (!motif.test(html)) erreurs.push(`${rel(p)} : balise ${nom} absente.`);
  }
  const numeros = [...html.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d+)/g)].map((m) => m[1]);
  if (numeros.length === 0) erreurs.push(`${rel(p)} : aucun lien WhatsApp (bouton flottant obligatoire).`);
  else if (numeroAttendu && numeros.some((n) => n !== numeroAttendu)) erreurs.push(`${rel(p)} : numéro WhatsApp ${[...new Set(numeros)].join(", ")} différent du cahier (${numeroAttendu}).`);
  if (!/Proposition de site réalisée par Digifaz/i.test(html)) avertissements.push(`${rel(p)} : mention « Proposition de site réalisée par Digifaz » absente.`);
}
if (!numeroAttendu) avertissements.push("Numéro WhatsApp introuvable dans le cahier (ligne « WhatsApp » avec un numéro) : comparaison impossible.");

// --- Chaque demo listee dans la note ---
const note = existsSync(join(DOSSIER, "NOTE_FONCTIONNALITES.md")) ? readFileSync(join(DOSSIER, "NOTE_FONCTIONNALITES.md"), "utf8") : null;
if (demos.size && note === null) erreurs.push("NOTE_FONCTIONNALITES.md absent alors que le site contient des démos.");
for (const d of demos) if (note !== null && !note.includes(d)) erreurs.push(`Démo « ${d} » absente de NOTE_FONCTIONNALITES.md.`);

// --- Contenus a relire (pas de verdict automatique possible) ---
const aRelire = [];
for (const p of pages) {
  const texte = readFileSync(p, "utf8").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ");
  for (const m of texte.matchAll(/[^.!?\n]{0,60}(\d[\d\s.]*\s?(?:F\s?CFA|FCFA|F\b|€|%)|témoign|«[^»]{0,80}»\s*[—-]\s*[A-Z])[^.!?\n]{0,40}/gi)) {
    aRelire.push(`${rel(p)} : « ${m[0].replace(/\s+/g, " ").trim()} »`);
  }
}

// --- Rapport ---
console.log(`Vérification de ${slug}/site : ${pages.length} page(s) (${pages.map(rel).join(", ")}), ${fichiers.length} fichier(s)`);
console.log(`Démos (data-demo) : ${demos.size ? [...demos].join(", ") : "aucune"}`);
console.log(`Ressources externes : ${externes.size ? [...externes].join(", ") : "aucune"}`);
if (erreurs.length) console.log(`\n✗ ${erreurs.length} erreur(s) :\n${erreurs.map((e) => `  - ${e}`).join("\n")}`);
if (avertissements.length) console.log(`\n! ${avertissements.length} avertissement(s) :\n${avertissements.map((e) => `  - ${e}`).join("\n")}`);
if (aRelire.length) console.log(`\n? Prix, chiffres ou citations à relire (aucun contenu inventé) :\n${aRelire.slice(0, 20).map((e) => `  - ${e}`).join("\n")}`);
if (!erreurs.length) console.log("\n✓ Aucune erreur bloquante.");
process.exit(erreurs.length ? 1 : 0);
