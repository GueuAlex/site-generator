#!/usr/bin/env node
// Lecture SEULE du fichier de prospection (onglet « Prospects », en-tetes ligne 4).
//   node scripts/prospect.mjs <N°>      -> la ligne en JSON (colonnes vides omises)
//   node scripts/prospect.mjs --liste   -> N°, nom, secteur, commune de chaque ligne
// Le fichier n'est jamais modifie : il est partage avec toute l'equipe.
// Chemin : variable PROSPECTS_XLSX du .env (absolu, ou relatif a la racine du kit).
// Sans dependance : un .xlsx est un zip de fichiers XML.
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lireZip } from "./lib/zip.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ONGLET = "Prospects";
const LIGNE_ENTETES = 4;

const cheminEnv = join(RACINE, ".env");
if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);

function quitter(message) {
  console.error(message);
  process.exit(1);
}

// Decodage des entites XML
const decoder = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e.toLowerCase()];
  });

// Texte de tous les <t> d'un fragment (texte riche compris)
const textes = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decoder(m[1])).join("");
const attribut = (balise, nom) => balise.match(new RegExp(`\\s${nom}="([^"]*)"`))?.[1];

function lireLignes(chemin) {
  const zip = lireZip(chemin);
  const lire = (nom) => zip.get(nom)?.toString("utf8") ?? "";
  // Onglet « Prospects » -> identifiant de relation -> fichier de la feuille
  const feuilles = [...lire("xl/workbook.xml").matchAll(/<sheet\s[^>]*\/?>/g)].map((m) => ({
    nom: decoder(attribut(m[0], "name") ?? ""),
    rid: attribut(m[0], "r:id"),
  }));
  const feuille = feuilles.find((f) => f.nom === ONGLET);
  if (!feuille) quitter(`✗ Onglet « ${ONGLET} » introuvable (onglets : ${feuilles.map((f) => f.nom).join(", ")}).`);
  const rel = [...lire("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s[^>]*\/?>/g)].find((m) => attribut(m[0], "Id") === feuille.rid);
  let cible = (attribut(rel?.[0] ?? "", "Target") ?? "").replace(/^\//, "");
  if (!cible.startsWith("xl/")) cible = `xl/${cible}`;

  const partages = [...lire("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textes(m[1]));
  const lignes = new Map();
  for (const r of lire(cible).matchAll(/<row\s([^>]*)>([\s\S]*?)<\/row>/g)) {
    const numero = Number(attribut(` ${r[1]}`, "r"));
    const cellules = {};
    for (const c of r[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribut(` ${c[1]}`, "r") ?? "";
      const type = attribut(` ${c[1]}`, "t");
      const corps = c[2] ?? "";
      const v = corps.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valeur = "";
      if (type === "s" && v != null) valeur = partages[Number(v)] ?? "";
      else if (type === "inlineStr") valeur = textes(corps);
      else if (v != null) valeur = decoder(v);
      cellules[ref.match(/[A-Z]+/)?.[0]] = valeur.trim();
    }
    lignes.set(numero, cellules);
  }
  return lignes;
}

const arg = process.argv[2];
if (!arg) quitter("Usage : node scripts/prospect.mjs <N°> | --liste");
const brut = process.env.PROSPECTS_XLSX;
if (!brut) quitter("✗ PROSPECTS_XLSX absent du .env : indiquer le chemin du fichier Excel de prospection.");
const chemin = isAbsolute(brut) ? brut : join(RACINE, brut);
if (!existsSync(chemin)) quitter(`✗ Fichier introuvable : ${chemin}\n  Vérifier PROSPECTS_XLSX dans le .env.`);

const lignes = lireLignes(chemin);
const entetes = lignes.get(LIGNE_ENTETES) ?? {};
const colNum = Object.keys(entetes).find((k) => entetes[k] === "N°");
if (!colNum) quitter(`✗ En-tête « N° » absent de la ligne ${LIGNE_ENTETES}.`);
const donnees = [...lignes.entries()]
  .filter(([n, l]) => n > LIGNE_ENTETES && l[colNum])
  .sort(([a], [b]) => a - b)
  .map(([, l]) => l);
const enObjet = (l) => Object.fromEntries(Object.entries(l).filter(([k, v]) => entetes[k] && v).map(([k, v]) => [entetes[k], v]));

if (arg === "--liste") {
  for (const l of donnees) {
    const d = enObjet(l);
    console.log([d["N°"], d["Nom de l'entreprise"], d["Secteur"], d["Commune"]].map((x) => x ?? "").join(" · "));
  }
} else {
  // Les numeros peuvent etre stockes en flottant ("12.0")
  const ligne = donnees.find((l) => l[colNum] === arg || (/^\d+(\.0+)?$/.test(l[colNum]) && String(parseInt(l[colNum], 10)) === arg));
  if (!ligne) quitter(`✗ Aucune ligne avec le N° ${arg}.`);
  console.log(JSON.stringify(enObjet(ligne), null, 2));
}
