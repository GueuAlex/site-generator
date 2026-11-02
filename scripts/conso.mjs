#!/usr/bin/env node
// Consommation de l'API Kimi : solde reel du compte et detail des appels enregistres dans */couts.json.
//   node scripts/conso.mjs
// Le solde vient de l'API (GET /v1/users/me/balance, doc : https://platform.kimi.ai/docs/api/balance.md).
// Le detail par appel est celui que scripts/kimi.mjs enregistre ; le cout est estime avec les prix du .env,
// ou a defaut avec les prix publics de kimi-k3.1-pro (USD par million de tokens), sans les frais d'ecriture du cache.
// Le detail officiel par jour et par cle demande une cle Admin (sk-admin-*, scope billing:read) : non gere ici.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cheminEnv = join(RACINE, ".env");
if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);

const prix = {
  entree: Number(process.env.KIMI_PRICE_IN || 2),
  cache: Number(process.env.KIMI_PRICE_CACHE_IN || 0.2),
  sortie: Number(process.env.KIMI_PRICE_OUT || 10),
};
const prixDuEnv = Boolean(process.env.KIMI_PRICE_IN && process.env.KIMI_PRICE_OUT);
const baseURL = process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1";

// Estimation d'un appel (tokens d'entree hors cache, entree en cache, sortie)
function estimer(t) {
  const cache = t.entree_cache || 0;
  return ((t.entree - cache) * prix.entree + cache * prix.cache + t.sortie * prix.sortie) / 1e6;
}

const usd = (n) => `${n.toFixed(2)} $`;
const milliers = (n) => n.toLocaleString("fr-FR");

// --- Solde reel du compte ---
async function solde() {
  if (!process.env.MOONSHOT_API_KEY) return console.log("Solde : MOONSHOT_API_KEY absente du .env.");
  try {
    const rep = await fetch(`${baseURL}/users/me/balance`, { headers: { Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}` } });
    const json = await rep.json();
    if (!rep.ok || json.code !== 0) return console.log(`Solde : réponse inattendue (HTTP ${rep.status}${json.error?.message ? `, ${json.error.message}` : ""}).`);
    const d = json.data;
    console.log("Solde du compte Kimi (API)");
    console.log(`  Disponible : ${usd(d.available_balance)}  (espèces ${usd(d.cash_balance)}, bons ${usd(d.voucher_balance)})\n`);
  } catch (e) {
    console.log(`Solde : API injoignable (${e.cause?.code || e.message}).\n`);
  }
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
    const s = { appels: liste.length, entree: 0, cache: 0, sortie: 0, cout: 0, estime: false };
    for (const a of liste) {
      const c = estimer(a.tokens);
      s.entree += a.tokens.entree;
      s.cache += a.tokens.entree_cache || 0;
      s.sortie += a.tokens.sortie;
      s.cout += c;
      s.estime ||= Boolean(a.tokens_estimes);
      total.raisonnement += a.tokens.raisonnement || 0;
      total.duree += a.duree_s || 0;
      const k = `${a.commande} (${a.statut})`;
      parCommande[k] = parCommande[k] || { n: 0, cout: 0 };
      parCommande[k].n += 1;
      parCommande[k].cout += c;
    }
    total.appels += s.appels;
    total.entree += s.entree;
    total.cache += s.cache;
    total.sortie += s.sortie;
    total.cout += s.cout;
    lignes.push([site, s.appels, milliers(s.entree), milliers(s.cache), milliers(s.sortie), usd(s.cout) + (s.estime ? " *" : "")]);
  }

  console.log(`Appels enregistrés par scripts/kimi.mjs (${sites.length} site(s))`);
  const entetes = ["Site", "Appels", "Entrée", "dont cache", "Sortie", "Coût estimé"];
  const larg = entetes.map((e, i) => Math.max(e.length, ...lignes.map((l) => String(l[i]).length)));
  const fmt = (l) => "  " + l.map((v, i) => (i === 0 ? String(v).padEnd(larg[i]) : String(v).padStart(larg[i]))).join("   ");
  console.log(fmt(entetes));
  lignes.forEach((l) => console.log(fmt(l)));
  console.log(fmt(["TOTAL", total.appels, milliers(total.entree), milliers(total.cache), milliers(total.sortie), usd(total.cout)]));
  console.log(`\n  Raisonnement : ${milliers(total.raisonnement)} tokens (compris dans la sortie) · durée cumulée : ${Math.round(total.duree / 60)} min`);
  console.log("  Par commande : " + Object.entries(parCommande).map(([k, v]) => `${k} ${v.n} appel(s), ${usd(v.cout)}`).join(" · "));
  console.log(`  Prix utilisés (USD par million de tokens) : entrée ${prix.entree}, entrée en cache ${prix.cache}, sortie ${prix.sortie}${prixDuEnv ? " (.env)" : " (prix publics par défaut, .env vide)"}`);
  console.log("  * tokens en partie estimés (flux coupé puis repris). Les frais d'écriture du cache ne sont pas comptés.");
}

await solde();
appels();
