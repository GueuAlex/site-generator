#!/usr/bin/env node
// Consommation des IA qui construisent les sites (Kimi, DeepSeek) : solde reel de chaque compte
// et detail des appels enregistres dans */couts.json.
//   node scripts/conso.mjs
// Soldes et tarifs : voir scripts/fournisseurs.mjs. Le cout d'un appel est celui que scripts/kimi.mjs a enregistre,
// ou a defaut une estimation au tarif public de son fournisseur, sans les frais d'ecriture du cache.
// Le detail officiel par cle Kimi (toute l'equipe) demande une cle Admin Kimi : non gere ici.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOURNISSEURS, cout } from "./fournisseurs.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cheminEnv = join(RACINE, ".env");
if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);

// Cout d'un appel : celui enregistre par kimi.mjs, sinon estime au tarif du fournisseur a la date de l'appel
function estimer(a) {
  if (typeof a.cout === "number" && a.modele !== "simulation") return a.cout;
  return cout(a.fournisseur || "kimi", a.modele, a.tokens, new Date(a.date)).usd;
}

const usd = (n) => `${n.toFixed(2)} $`;
const milliers = (n) => n.toLocaleString("fr-FR");

// --- Solde reel de chaque compte (fournisseurs dont la cle est dans .env) ---
async function soldes() {
  console.log("Soldes des comptes");
  for (const [id, f] of Object.entries(FOURNISSEURS)) {
    const cle = process.env[f.cleEnv];
    if (!cle) {
      console.log(`  ${f.nom.padEnd(9)} : ${f.cleEnv} absente du .env`);
      continue;
    }
    try {
      const s = await f.solde(cle);
      console.log(`  ${f.nom.padEnd(9)} : ${s.disponible.toFixed(2)} ${s.devise === "USD" ? "$" : s.devise}  (${s.detail})`);
    } catch (e) {
      console.log(`  ${f.nom.padEnd(9)} : solde illisible (${e.cause?.code || e.message})`);
    }
  }
  console.log("");
}

// --- Appels enregistres par site ---
function appels() {
  const sites = readdirSync(RACINE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RACINE, d.name, "couts.json")))
    .map((d) => d.name)
    .sort();
  const total = { appels: 0, entree: 0, cache: 0, sortie: 0, raisonnement: 0, duree: 0, cout: 0 };
  const lignes = [];
  const parCommande = {};
  for (const site of sites) {
    const liste = JSON.parse(readFileSync(join(RACINE, site, "couts.json"), "utf8"));
    const s = { appels: liste.length, entree: 0, cache: 0, sortie: 0, cout: 0, estime: false, ia: new Set() };
    for (const a of liste) {
      const c = estimer(a);
      s.ia.add(FOURNISSEURS[a.fournisseur || "kimi"]?.nom || a.fournisseur);
      s.entree += a.tokens.entree;
      s.cache += a.tokens.entree_cache || 0;
      s.sortie += a.tokens.sortie;
      s.cout += c;
      s.estime ||= Boolean(a.tokens_estimes);
      total.raisonnement += a.tokens.raisonnement || 0;
      total.duree += a.duree_s || 0;
      const k = `${FOURNISSEURS[a.fournisseur || "kimi"]?.nom || a.fournisseur} ${a.commande} (${a.statut})`;
      parCommande[k] = parCommande[k] || { n: 0, cout: 0 };
      parCommande[k].n += 1;
      parCommande[k].cout += c;
    }
    total.appels += s.appels;
    total.entree += s.entree;
    total.cache += s.cache;
    total.sortie += s.sortie;
    total.cout += s.cout;
    lignes.push([site, [...s.ia].join(", "), s.appels, milliers(s.entree), milliers(s.cache), milliers(s.sortie), usd(s.cout) + (s.estime ? " *" : "")]);
  }

  console.log(`Appels enregistrés par scripts/kimi.mjs (${sites.length} site(s))`);
  const entetes = ["Site", "IA", "Appels", "Entrée", "dont cache", "Sortie", "Coût"];
  const larg = entetes.map((e, i) => Math.max(e.length, ...lignes.map((l) => String(l[i]).length)));
  const fmt = (l) => "  " + l.map((v, i) => (i <= 1 ? String(v).padEnd(larg[i]) : String(v).padStart(larg[i]))).join("   ");
  console.log(fmt(entetes));
  lignes.forEach((l) => console.log(fmt(l)));
  console.log(fmt(["TOTAL", "", total.appels, milliers(total.entree), milliers(total.cache), milliers(total.sortie), usd(total.cout)]));
  console.log(`\n  Raisonnement : ${milliers(total.raisonnement)} tokens (compris dans la sortie) · durée cumulée : ${Math.round(total.duree / 60)} min`);
  console.log("  Par commande : " + Object.entries(parCommande).map(([k, v]) => `${k} ${v.n} appel(s), ${usd(v.cout)}`).join(" · "));
  console.log("  Tarifs : prix publics de chaque fournisseur (scripts/fournisseurs.mjs), ou prix du .env ; DeepSeek à moitié prix en heures creuses.");
  console.log("  * tokens en partie estimés (flux coupé puis repris). Les frais d'écriture du cache ne sont pas comptés.");
}

await soldes();
appels();
