#!/usr/bin/env node
// Appels a l'IA qui construit ou corrige un site : Kimi par defaut, DeepSeek en option (API compatibles OpenAI).
//
//   node scripts/kimi.mjs build <slug> [--fournisseur kimi|deepseek] [--sortie site-xxx] [--forcer] [--simuler <fichier>]
//   node scripts/kimi.mjs fix <slug> "<retours>" [--fournisseur kimi|deepseek] [--sortie site-xxx] [--simuler <fichier>]
//   node scripts/kimi.mjs modeles [--fournisseur kimi|deepseek]
//
// --fournisseur : kimi (defaut, ou IA_FOURNISSEUR du .env) ou deepseek ; reglages dans scripts/fournisseurs.mjs.
// --sortie : dossier du site genere (defaut : site), ex. site-deepseek pour comparer deux versions sans ecraser la premiere.
// --simuler <fichier> : utilise une reponse enregistree au lieu d'appeler l'API (tests, cout nul).
// --forcer : build meme si le cahier n'est pas marque « Validé : oui ».
// Configuration dans le fichier .env a la racine du kit (voir .env.example). Docs : https://platform.kimi.ai/docs et https://api-docs.deepseek.com

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cout as coutAppel, fournisseur } from "./fournisseurs.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT_SYSTEME = join(RACINE, "scripts", "kimi", "prompt-systeme.md");
// Skills UI/UX publies sur GitHub (voir CLAUDE.md, « Chaque site est unique ») ; le cahier en designe un
const DOSSIER_SKILLS = join(RACINE, "scripts", "kimi", "skills");
const EXTENSIONS_AUTORISEES = new Set([".html", ".css", ".js", ".svg", ".json", ".txt", ".xml", ".webmanifest"]);
const LOGO_IMAGE = /^logo\.(png|jpe?g|webp)$/i;
const TAILLE_MAX_IMAGE = 4 * 1024 * 1024;
// Reprises automatiques apres une reponse coupee ou interrompue
const REPRISES_MAX = Number(process.env.KIMI_REPRISES_MAX || 3);
const PAUSE_REPRISE_MS = 8000;

// --- Utilitaires d'affichage -------------------------------------------------
const info = (m) => console.log(`› ${m}`);
const avertir = (m) => console.log(`! ${m}`);
function arreter(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// --- Arguments ---------------------------------------------------------------
const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  if (i === -1) return undefined;
  const valeur = args[i + 1];
  args.splice(i, 2);
  return valeur;
};
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const fichierSimule = option("--simuler");
const forcer = drapeau("--forcer");
const idFournisseur = option("--fournisseur");
const sortie = option("--sortie") || "site";
if (!/^site(-[a-z0-9]+)*$/.test(sortie)) arreter("--sortie invalide : « site » ou « site-<nom> » (minuscules, chiffres, tirets).");
const [commande, slug, retours] = args;

// --- Configuration (.env) ----------------------------------------------------
const cheminEnv = join(RACINE, ".env");
if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);
const idIA = (idFournisseur || process.env.IA_FOURNISSEUR || "kimi").toLowerCase();
let IA;
try {
  IA = fournisseur(idIA);
} catch (e) {
  arreter(e.message);
}
const config = {
  cle: process.env[IA.cleEnv],
  modele: IA.modele(),
  baseURL: IA.baseURL(),
  maxTokens: IA.maxTokens(),
  timeoutMin: Number(process.env.KIMI_TIMEOUT_MIN || 30),
  devise: "USD",
  // Raisonnement toujours actif ; low | high | max (Kimi : "max" par defaut, tres long)
  effort: IA.effort(),
};

async function client() {
  if (!config.cle) arreter(`${IA.cleEnv} absente du .env (voir .env.example).`);
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: config.cle, baseURL: config.baseURL, timeout: config.timeoutMin * 60_000, maxRetries: 1 });
}

// --- Fichiers du site --------------------------------------------------------
function lister(dossier, base = dossier) {
  // Liste recursive des fichiers (chemins relatifs, separateur /)
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    if (e.name === ".DS_Store") return [];
    const chemin = join(dossier, e.name);
    return e.isDirectory() ? lister(chemin, base) : [relative(base, chemin).split(sep).join("/")];
  });
}

function cheminSur(chemin) {
  // Refuse les chemins absolus, les remontees et les extensions non prevues
  const c = chemin.trim();
  if (!c || c.startsWith("/") || c.includes("\\") || /^[a-z]+:/i.test(c)) return null;
  if (c.split("/").some((p) => p === ".." || p === "." || p === "")) return null;
  if (!EXTENSIONS_AUTORISEES.has(extname(c).toLowerCase())) return null;
  return c;
}

function extraireFichiers(texte) {
  // Blocs « === FILE: chemin === ... === END FILE === »
  const fichiers = [];
  const rejetes = [];
  const motif = /^=== FILE: (.+?) ===\r?\n([\s\S]*?)\r?\n=== END FILE ===[ \t]*$/gm;
  for (const m of texte.matchAll(motif)) {
    const chemin = cheminSur(m[1]);
    if (!chemin) rejetes.push(m[1]);
    else if (chemin.startsWith("assets/")) rejetes.push(`${m[1]} (assets/ est fourni, pas généré)`);
    else fichiers.push({ chemin, contenu: m[2] });
  }
  // Un fichier repete (reprise) garde sa derniere version
  const uniques = [...new Map(fichiers.map((f) => [f.chemin, f])).values()];
  return { fichiers: uniques, rejetes };
}

function horodatage() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
}

function sauvegarderSite(dossierSite, dossierHistorique) {
  // Copie de la version precedente (sans site/assets, recopie depuis assets/ a chaque appel)
  if (!existsSync(dossierSite) || lister(dossierSite).length === 0) return false;
  cpSync(dossierSite, join(dossierHistorique, "site"), {
    recursive: true,
    filter: (src) => !relative(dossierSite, src).split(sep).join("/").startsWith("assets"),
  });
  return true;
}

function copierAssets(dossier) {
  const source = join(dossier, "assets");
  const cible = join(dossier, sortie, "assets");
  rmSync(cible, { recursive: true, force: true });
  if (existsSync(source)) cpSync(source, cible, { recursive: true });
}

// --- Cout --------------------------------------------------------------------
function calculerCout(usage, date) {
  const tokens = {
    entree: usage?.prompt_tokens ?? 0,
    entree_cache: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    sortie: usage?.completion_tokens ?? 0,
    raisonnement: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
  // Tarif du fournisseur au debut de l'appel (DeepSeek : heures creuses a moitie prix)
  const { usd, prix } = coutAppel(idIA, config.modele, tokens, date);
  return { tokens, cout: usd, remise: prix.remise };
}

function enregistrerCout(dossier, entree) {
  const chemin = join(dossier, "couts.json");
  const liste = existsSync(chemin) ? JSON.parse(readFileSync(chemin, "utf8")) : [];
  liste.push(entree);
  writeFileSync(chemin, JSON.stringify(liste, null, 2) + "\n");
  return liste.reduce((t, e) => t + (e.cout ?? 0), 0);
}

// --- Appel a l'IA -------------------------------------------------------------
async function appeler(messages) {
  if (fichierSimule) {
    info(`Simulation : réponse lue dans ${fichierSimule} (aucun appel à l'API).`);
    return { texte: readFileSync(fichierSimule, "utf8"), finish: "stop", usage: null, modele: "simulation" };
  }
  if (!config.modele) arreter(`${IA.modeleEnv} absent du .env (vérifier l'identifiant avec « node scripts/kimi.mjs modeles --fournisseur ${idIA} »).`);
  const api = await client();
  info(`Appel à ${IA.nom} (${config.modele}), raisonnement « ${config.effort} » (réponse en streaming, ${config.timeoutMin} min maximum)…`);
  const debut = Date.now();
  let texte = "";
  let raisonnement = 0;
  let finish = null;
  let usage = null;
  let erreur = null;
  let dernierAffichage = 0;
  try {
    const flux = await api.chat.completions.create({
      model: config.modele,
      messages,
      [IA.paramLongueur]: config.maxTokens,
      reasoning_effort: config.effort,
      stream: true,
      stream_options: { include_usage: true },
    });
    for await (const morceau of flux) {
      const choix = morceau.choices?.[0];
      if (choix?.delta?.content) texte += choix.delta.content;
      // Le raisonnement arrive avant la reponse, dans reasoning_content (non conserve)
      if (choix?.delta?.reasoning_content) raisonnement += choix.delta.reasoning_content.length;
      if (choix?.finish_reason) finish = choix.finish_reason;
      if (morceau.usage) usage = morceau.usage;
      if (texte.length + raisonnement - dernierAffichage > 20000) {
        dernierAffichage = texte.length + raisonnement;
        process.stdout.write(`  … ${Math.round(raisonnement / 1000)} k car. de raisonnement, ${Math.round(texte.length / 1000)} k car. de réponse (${Math.round((Date.now() - debut) / 1000)} s)\n`);
      }
    }
  } catch (e) {
    // Flux coupe (reseau, passerelle) : le texte deja recu est conserve pour une reprise
    // Cause technique (ex. UND_ERR_SOCKET, ECONNRESET) pour savoir d'ou vient la coupure
    const cause = e?.cause?.code || e?.cause?.message;
    erreur = `${e?.status ? `${e.status} ` : ""}${e?.message ?? e}${cause ? ` [${cause}]` : ""}`;
    if (raisonnement) erreur += ` (${Math.round(raisonnement / 1000)} k car. de raisonnement reçus)`;
  }
  return { texte, finish, usage, erreur, modele: config.modele, duree: Math.round((Date.now() - debut) / 1000) };
}

const FIN_BLOC = "=== END FILE ===";
function jusquAuDernierBloc(texte) {
  // Texte tronque apres le dernier bloc de fichier complet
  const fin = texte.lastIndexOf(FIN_BLOC);
  return fin === -1 ? "" : texte.slice(0, fin + FIN_BLOC.length);
}

function cumulerUsages(appels) {
  // Somme des usages de chaque tentative ; sortie estimee (1 token ~ 3,5 caracteres) si le flux a ete coupe avant l'usage
  const total = { prompt_tokens: 0, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 0 } };
  let estime = false;
  for (const a of appels) {
    if (a.usage) {
      total.prompt_tokens += a.usage.prompt_tokens ?? 0;
      total.completion_tokens += a.usage.completion_tokens ?? 0;
      total.prompt_tokens_details.cached_tokens += a.usage.prompt_tokens_details?.cached_tokens ?? 0;
      total.completion_tokens_details.reasoning_tokens += a.usage.completion_tokens_details?.reasoning_tokens ?? 0;
    } else if (a.texte) {
      total.completion_tokens += Math.round(a.texte.length / 3.5);
      estime = true;
    }
  }
  return { usage: total, estime };
}

function promptSysteme(cahier) {
  // Prompt systeme + skill UI/UX choisi dans le cahier (ligne « Skill UI/UX : `<id>` »)
  let prompt = readFileSync(PROMPT_SYSTEME, "utf8");
  const id = cahier.match(/Skill UI\/UX\s*:\**\s*`?([a-z0-9-]+)`?/i)?.[1];
  if (!id) {
    avertir(`Aucun skill UI/UX indiqué dans le cahier (ligne « Skill UI/UX : \`<id>\` ») : ${IA.nom} suit seulement le prompt système.`);
    return prompt;
  }
  const chemin = join(DOSSIER_SKILLS, id, "SKILL.md");
  if (!existsSync(chemin)) {
    const disponibles = readdirSync(DOSSIER_SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    arreter(`Skill UI/UX « ${id} » introuvable. Disponibles : ${disponibles.join(", ")}.`);
  }
  info(`Skill UI/UX : ${id}`);
  return (
    prompt +
    `\n\n## Guide de design à appliquer (skill « ${id} »)\n\n` +
    "Ce guide vient d'un skill de design publié sur GitHub. Tu n'as accès à aucun script, outil, navigateur, fichier de référence ni base de données qu'il mentionne : " +
    "ignore ses étapes d'installation, de commandes, de recherche, de captures d'écran et de validation avec le client, et applique uniquement ses principes de direction artistique, " +
    "de composition, de typographie, de couleur, de mise en page et de motion. En cas de conflit, les règles ci-dessus (contraintes techniques, contenu, démos, concept du cahier, format de réponse) l'emportent toujours.\n\n" +
    "----- DÉBUT DU GUIDE -----\n\n" +
    readFileSync(chemin, "utf8") +
    "\n\n----- FIN DU GUIDE -----"
  );
}

function contenuLogo(dossier) {
  // Logo envoye en image pour ajuster la palette (SVG envoye en texte)
  const fichiers = lister(join(dossier, "assets"));
  const parties = [];
  const image = fichiers.find((f) => LOGO_IMAGE.test(f));
  if (image && !IA.vision()) avertir(`assets/${image} non envoyé : ${config.modele} ne lit pas les images (le logo SVG reste envoyé s'il existe).`);
  else if (image) {
    const chemin = join(dossier, "assets", image);
    if (statSync(chemin).size <= TAILLE_MAX_IMAGE) {
      const type = image.toLowerCase().endsWith(".png") ? "png" : image.toLowerCase().endsWith(".webp") ? "webp" : "jpeg";
      parties.push({ type: "text", text: `Logo de l'établissement (assets/${image}), pour ajuster la palette :` });
      parties.push({ type: "image_url", image_url: { url: `data:image/${type};base64,${readFileSync(chemin).toString("base64")}` } });
    } else avertir(`assets/${image} dépasse 4 Mo : non envoyé à ${IA.nom}.`);
  }
  const svg = fichiers.find((f) => /^logo\.svg$/i.test(f));
  if (svg && statSync(join(dossier, "assets", svg)).size < 60_000) {
    parties.push({ type: "text", text: `Logo vectoriel (assets/${svg}) :\n${readFileSync(join(dossier, "assets", svg), "utf8")}` });
  }
  return parties;
}

// --- Commandes ---------------------------------------------------------------
async function modeles() {
  const api = await client();
  const liste = await api.models.list();
  for await (const m of liste) console.log(m.id);
}

async function construireOuCorriger() {
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) arreter("Slug manquant ou invalide (minuscules, chiffres, tirets).");
  const dossier = join(RACINE, slug);
  const cahierChemin = join(dossier, "CAHIER_DES_CHARGES.md");
  if (!existsSync(cahierChemin)) arreter(`${slug}/CAHIER_DES_CHARGES.md introuvable.`);
  const cahier = readFileSync(cahierChemin, "utf8");
  const assets = lister(join(dossier, "assets"));
  const listeAssets = assets.length
    ? assets.map((f) => `- assets/${f} (${Math.round(statSync(join(dossier, "assets", f)).size / 1024)} Ko)`).join("\n")
    : "(aucun fichier fourni : utiliser des placeholders)";

  let consigne;
  if (commande === "build") {
    if (!forcer && !/Validé(?: par [^:*\n]+)?\s*:\**\s*oui/i.test(cahier)) {
      arreter("Le cahier n'est pas marqué « Validé : oui ». Build refusé (--forcer pour passer outre).");
    }
    consigne = "Construis le site complet décrit par ce cahier des charges, en respectant toutes les règles.";
  } else {
    if (!retours?.trim()) arreter('Retours manquants : node scripts/kimi.mjs fix <slug> "<retours>"');
    const actuels = lister(join(dossier, sortie)).filter((f) => !f.startsWith("assets/") && EXTENSIONS_AUTORISEES.has(extname(f).toLowerCase()));
    if (actuels.length === 0) arreter(`${slug}/${sortie}/ est vide : lancer d'abord « build »${sortie === "site" ? "" : ` avec --sortie ${sortie}`}.`);
    const blocs = actuels.map((f) => `=== FILE: ${f} ===\n${readFileSync(join(dossier, sortie, f), "utf8")}\n=== END FILE ===`).join("\n\n");
    consigne =
      `Voici les fichiers actuels du site :\n\n${blocs}\n\n` +
      `Retours à appliquer :\n${retours}\n\n` +
      "Renvoie UNIQUEMENT les fichiers modifiés, chacun en version complète, dans le même format de blocs. N'applique que ces retours, sans autre changement.";
  }

  const parties = [
    { type: "text", text: `Cahier des charges :\n\n${cahier}` },
    { type: "text", text: `Fichiers disponibles dans assets/ :\n${listeAssets}` },
    ...contenuLogo(dossier),
    { type: "text", text: consigne },
  ];
  const messages = [
    { role: "system", content: promptSysteme(cahier) },
    // Sans image, un seul texte : accepte par tous les modeles, y compris ceux qui ne lisent pas les images
    { role: "user", content: parties.some((p) => p.type !== "text") ? parties : parties.map((p) => p.text).join("\n\n") },
  ];

  // Appel, puis reprises si la reponse est coupee (limite de tokens) ou interrompue (flux coupe) :
  // on garde les fichiers complets et on demande seulement les suivants. Rien n'est ecrit si l'ensemble reste incomplet.
  const debut = Date.now();
  const dateAppel = new Date();
  const historique = join(dossier, ".historique", horodatage());
  mkdirSync(historique, { recursive: true });
  const appels = [];
  let cumul = "";
  let brut = "";
  let termine = false;
  let derniere = null;
  let echange = messages;
  for (let essai = 0; essai <= REPRISES_MAX; essai++) {
    derniere = await appeler(echange);
    appels.push(derniere);
    brut += (essai ? `\n\n----- REPRISE ${essai} -----\n\n` : "") + derniere.texte;
    // Reponse brute (ou partielle) conservee a chaque tentative pour pouvoir diagnostiquer
    writeFileSync(join(historique, `reponse-${commande}.txt`), brut);
    // Les blocs repris commencent sur une nouvelle ligne (le format exige « === FILE: » en debut de ligne)
    const suite = cumul ? `${cumul}\n${derniere.texte}` : derniere.texte;
    if (!derniere.erreur && derniere.finish !== "length") {
      cumul = suite;
      termine = true;
      break;
    }
    cumul = jusquAuDernierBloc(suite);
    // Une erreur HTTP (cle, quota, requete invalide) ne se regle pas en reessayant ; une coupure de flux, si
    if (fichierSimule || essai === REPRISES_MAX || (derniere.erreur && /^4\d\d /.test(derniere.erreur))) break;
    const faits = extraireFichiers(cumul).fichiers.map((f) => f.chemin);
    // Fichier commence mais coupe : a nommer, sinon Kimi passe au suivant et l'oublie
    const entames = [...suite.slice(cumul.length).matchAll(/^=== FILE: (.+?) ===/gm)].map((m) => m[1].trim());
    const coupe = entames.find((f) => !faits.includes(f));
    const raison = derniere.erreur ? `interrompue (${derniere.erreur}) après ${derniere.duree} s` : "coupée par la limite de tokens";
    avertir(`Réponse ${raison} : ${faits.length} fichier(s) complet(s)${faits.length ? ` (${faits.join(", ")})` : ""}. Reprise ${essai + 1}/${REPRISES_MAX}…`);
    await new Promise((r) => setTimeout(r, PAUSE_REPRISE_MS));
    echange = cumul
      ? [
          ...messages,
          { role: "assistant", content: cumul },
          {
            role: "user",
            content: `Ta réponse a été interrompue. Fichiers déjà complets : ${faits.join(", ")}.${coupe ? ` Le fichier ${coupe} a été coupé en cours d'écriture : recommence-le en entier, en premier.` : ""} Continue en produisant UNIQUEMENT les fichiers restants du site, chacun complet, dans le même format de blocs, sans répéter les fichiers déjà complets. N'oublie aucun fichier référencé par les pages (scripts, feuilles de style, pages liées).`,
          },
        ]
      : messages;
  }
  const duree = Math.round((Date.now() - debut) / 1000);
  const reponse = { ...derniere, texte: cumul };

  const { usage: usageTotal, estime } = cumulerUsages(appels);
  const { tokens, cout, remise } = calculerCout(usageTotal, dateAppel);
  const { fichiers, rejetes } = extraireFichiers(cumul);
  let statut = "ecrit";
  if (!termine) statut = derniere.erreur ? "interrompu" : "coupe";
  else if (fichiers.length === 0) statut = "vide";
  if (fichierSimule) statut = statut === "ecrit" ? "simule" : statut;

  if (statut === "ecrit" || statut === "simule") {
    const dossierSite = join(dossier, sortie);
    const sauvegarde = sauvegarderSite(dossierSite, historique);
    if (commande === "build") rmSync(dossierSite, { recursive: true, force: true });
    for (const f of fichiers) {
      const cible = join(dossierSite, f.chemin);
      mkdirSync(dirname(cible), { recursive: true });
      writeFileSync(cible, f.contenu.endsWith("\n") ? f.contenu : f.contenu + "\n");
    }
    copierAssets(dossier);
    if (sauvegarde) info(`Version précédente sauvegardée dans ${relative(RACINE, historique)}/site/`);
  }

  const total = enregistrerCout(dossier, {
    date: new Date().toISOString(),
    commande,
    fournisseur: idIA,
    modele: reponse.modele,
    ...(sortie !== "site" ? { sortie } : {}),
    ...(commande === "fix" ? { retours } : {}),
    tokens,
    ...(estime ? { tokens_estimes: true } : {}),
    cout,
    devise: config.devise,
    ...(remise ? { remise } : {}),
    duree_s: duree,
    tentatives: appels.length,
    finish_reason: reponse.finish,
    ...(reponse.erreur ? { erreur: reponse.erreur } : {}),
    statut,
    fichiers: fichiers.map((f) => f.chemin),
  });

  // --- Resume ---
  console.log("");
  if (statut === "coupe") console.log(`✗ Réponse COUPÉE par la limite de tokens (finish_reason: length), même après ${appels.length - 1} reprise(s) : rien n'a été écrit.`);
  else if (statut === "interrompu") console.log(`✗ Réponse INTERROMPUE (${reponse.erreur}) après ${appels.length} tentative(s) : rien n'a été écrit.`);
  else if (statut === "vide") console.log("✗ Aucun bloc « === FILE: … === » exploitable dans la réponse : rien n'a été écrit.");
  else console.log(`✓ ${fichiers.length} fichier(s) écrit(s) dans ${slug}/${sortie}/ par ${IA.nom} : ${fichiers.map((f) => f.chemin).join(", ")}`);
  for (const r of rejetes) avertir(`Bloc ignoré (chemin refusé) : ${r}`);
  console.log(`  Tokens : ${tokens.entree} en entrée (dont ${tokens.entree_cache} en cache), ${tokens.sortie} en sortie (dont ${tokens.raisonnement} de raisonnement)${estime ? " — en partie estimés (flux coupé)" : ""} · ${appels.length} tentative(s)`);
  console.log(`  Coût   : ${cout} ${config.devise} (tarif ${IA.nom}${remise ? `, ${remise}` : ""}) · total du site : ${Math.round(total * 10000) / 10000} ${config.devise}`);
  console.log(`  Durée  : ${duree} s · réponse brute : ${relative(RACINE, historique)}/reponse-${commande}.txt`);
  if (statut !== "ecrit" && statut !== "simule") process.exit(2);
}

// --- Point d'entree ----------------------------------------------------------
try {
  if (commande === "modeles") await modeles();
  else if (commande === "build" || commande === "fix") await construireOuCorriger();
  else arreter('Usage : node scripts/kimi.mjs build <slug> | fix <slug> "<retours>" | modeles [--fournisseur kimi|deepseek] [--sortie site-xxx]');
} catch (e) {
  arreter(`Erreur de l'API ${IA.nom} : ${e?.status ? `${e.status} ` : ""}${e?.message ?? e}`);
}
