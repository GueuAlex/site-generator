#!/usr/bin/env node
// Sert un site en local pour le relire (Windows, Linux, macOS).
//   node scripts/servir.mjs <slug> [port]          -> sert <slug>/site (site genere par Kimi)
//   node scripts/servir.mjs <dossier> [port]       -> sert un dossier quelconque (ex. un zip decompresse)
// Utilise « npx serve » avec scripts/serve.json, qui desactive les redirections effacant les parametres d'adresse.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [cible, port = "4300"] = process.argv.slice(2);
if (!cible) {
  console.error("Usage : node scripts/servir.mjs <slug|dossier> [port]");
  process.exit(1);
}
const dossier = [join(RACINE, cible, "site"), resolve(cible)].find((d) => existsSync(join(d, "index.html")));
if (!dossier) {
  console.error(`✗ Aucun index.html dans ${join(cible, "site")} ni dans ${cible}.`);
  process.exit(1);
}
console.log(`› http://localhost:${port}  (${dossier})`);
// npx est un script .cmd sous Windows : il faut passer par le shell, et donc entourer de guillemets
// les chemins qui contiennent des espaces (ex. C:\Users\Jean Dupont\...)
const windows = process.platform === "win32";
const args = ["-y", "serve@14", "-l", port, "-c", join(RACINE, "scripts", "serve.json"), dossier].map((a) => (windows && /\s/.test(a) ? `"${a}"` : a));
const enfant = spawn("npx", args, { stdio: "inherit", shell: windows });
enfant.on("exit", (code) => process.exit(code ?? 0));
