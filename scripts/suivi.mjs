#!/usr/bin/env node
// Suivi des sites dans suivi.csv (racine du kit, propre a chaque membre) (separateur « ; » pour Excel en francais).
//   node scripts/suivi.mjs                                   -> avancement de tous les sites et cout total
//   node scripts/suivi.mjs maj <slug> <statut> [--numero N] [--nom "Nom"] [--livre]
// Le cout de chaque site est recalcule a partir de <slug>/couts.json.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(RACINE, "suivi.csv");
const COLONNES = ["slug", "numero", "nom", "statut", "cout", "devise", "date_livraison", "mis_a_jour"];
const STATUTS = ["recherche", "attente-elements", "cahier-a-valider", "cahier-valide", "construit", "en-revue", "livre"];

const echapper = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function lireCsv() {
  if (!existsSync(CSV)) return [];
  const [entete, ...lignes] = readFileSync(CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = entete.split(";");
  return lignes.map((l) => {
    const valeurs = [];
    let courant = "";
    let guillemets = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (guillemets && c === '"' && l[i + 1] === '"') { courant += '"'; i++; }
      else if (c === '"') guillemets = !guillemets;
      else if (c === ";" && !guillemets) { valeurs.push(courant); courant = ""; }
      else courant += c;
    }
    valeurs.push(courant);
    return Object.fromEntries(cols.map((c, i) => [c, valeurs[i] ?? ""]));
  });
}
const ecrireCsv = (lignes) =>
  writeFileSync(CSV, [COLONNES.join(";"), ...lignes.map((l) => COLONNES.map((c) => echapper(String(l[c] ?? ""))).join(";"))].join("\n") + "\n");

function coutSite(slug) {
  const chemin = join(RACINE, slug, "couts.json");
  if (!existsSync(chemin)) return { cout: 0, devise: "" };
  const appels = JSON.parse(readFileSync(chemin, "utf8"));
  return { cout: Math.round(appels.reduce((t, a) => t + (a.cout ?? 0), 0) * 10000) / 10000, devise: appels.at(-1)?.devise ?? "" };
}

const args = process.argv.slice(2);
const aujourdhui = new Date().toISOString().slice(0, 10);

if (args[0] === "maj") {
  const [, slug, statut] = args;
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  if (!slug || !STATUTS.includes(statut)) {
    console.error(`Usage : node scripts/suivi.mjs maj <slug> <statut> [--numero N] [--nom "Nom"] [--livre]\nStatuts : ${STATUTS.join(", ")}`);
    process.exit(1);
  }
  const lignes = lireCsv();
  let ligne = lignes.find((l) => l.slug === slug);
  if (!ligne) lignes.push((ligne = { slug }));
  Object.assign(ligne, { statut, mis_a_jour: aujourdhui, ...coutSite(slug) });
  if (opt("--numero")) ligne.numero = opt("--numero");
  if (opt("--nom")) ligne.nom = opt("--nom");
  if (args.includes("--livre")) ligne.date_livraison = aujourdhui;
  ecrireCsv(lignes);
  console.log(`✓ ${slug} : ${statut}${ligne.cout ? ` · coût ${ligne.cout} ${ligne.devise}` : ""}`);
} else {
  const lignes = lireCsv().map((l) => ({ ...l, ...coutSite(l.slug) }));
  if (!lignes.length) {
    console.log("Aucun site suivi pour l'instant (suivi.csv vide).");
    process.exit(0);
  }
  const largeur = Math.max(...lignes.map((l) => l.slug.length), 4);
  console.log(`${"Site".padEnd(largeur)}  N°   ${"Statut".padEnd(17)} ${"Coût".padStart(10)}  Livré le`);
  for (const l of lignes) {
    console.log(`${l.slug.padEnd(largeur)}  ${(l.numero || "-").padEnd(4)} ${l.statut.padEnd(17)} ${String(l.cout || 0).padStart(10)}  ${l.date_livraison || "-"}`);
  }
  const parStatut = STATUTS.map((s) => [s, lignes.filter((l) => l.statut === s).length]).filter(([, n]) => n);
  const total = Math.round(lignes.reduce((t, l) => t + l.cout, 0) * 10000) / 10000;
  const devise = lignes.find((l) => l.devise)?.devise ?? "";
  console.log(`\n${lignes.length} site(s) · ${parStatut.map(([s, n]) => `${n} ${s}`).join(", ")}`);
  console.log(`Coût Kimi total : ${total} ${devise}`);
}
