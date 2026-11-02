#!/usr/bin/env node
// Captures d'ecran via Chrome headless (protocole DevTools), sans dependance, pour verifier le rendu d'un site.
//   node scripts/capture.mjs <url> <dossier> <largeur> <hauteur> <mobile 0|1> '<etapes JSON>'
//   etapes : [{ "nom": "1", "scroll": "innerHeight*1", "attente": 2000, "js": "optionnel" }]
// Variables : REDUIT=1 (prefers-reduced-motion), SONDE="<expression JS>" (valeur affichee a la fin),
// CHROME_PATH (chemin du navigateur, sinon Chrome, Edge ou Chromium trouve automatiquement).
// Affiche aussi la largeur de defilement (debordement horizontal), les exceptions et les erreurs de la console.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cheminEnv = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), ".env");
if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);

const [url, dossier, largeur, hauteur, mobile, etapesJson] = process.argv.slice(2);
if (!url || !dossier) {
  console.error("Usage : node scripts/capture.mjs <url> <dossier> <largeur> <hauteur> <mobile 0|1> '<etapes JSON>'");
  process.exit(1);
}
const etapes = JSON.parse(etapesJson || '[{"nom":"1"}]');
const L = +(largeur || 1440), H = +(hauteur || 900), estMobile = mobile === "1";
const port = 9333 + Math.floor(Math.random() * 500);
mkdirSync(dossier, { recursive: true });

// Chrome, Edge ou Chromium selon le systeme (Windows, Linux, macOS)
function trouverNavigateur() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const env = process.env;
  const candidats = {
    win32: [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean).flatMap((d) => [
      join(d, "Google", "Chrome", "Application", "chrome.exe"),
      join(d, "Microsoft", "Edge", "Application", "msedge.exe"),
    ]),
    linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"].flatMap((n) => [`/usr/bin/${n}`, `/snap/bin/${n}`]),
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  }[process.platform] ?? [];
  const trouve = candidats.find((c) => existsSync(c));
  if (!trouve) {
    console.error("Navigateur introuvable : installer Google Chrome (ou Edge, Chromium), ou définir CHROME_PATH dans le .env.");
    process.exit(1);
  }
  return trouve;
}

const chrome = spawn(trouverNavigateur(), [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${join(dossier, ".profil")}`,
  `--window-size=${L},${H}`, "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let cible;
for (let i = 0; i < 50 && !cible; i++) {
  await pause(200);
  try {
    const liste = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    cible = liste.find((t) => t.type === "page");
  } catch {}
}
if (!cible) { console.error("Chrome injoignable"); chrome.kill(); process.exit(1); }

const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const attentes = new Map();
const evenements = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && attentes.has(d.id)) { attentes.get(d.id)(d); attentes.delete(d.id); }
  else if (d.method) evenements.push(d);
};
const envoyer = (method, params = {}) =>
  new Promise((r) => { const n = ++id; attentes.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

await envoyer("Page.enable");
await envoyer("Runtime.enable");
await envoyer("Emulation.setDeviceMetricsOverride", { width: L, height: H, deviceScaleFactor: estMobile ? 2 : 1, mobile: estMobile });
if (estMobile) {
  await envoyer("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await envoyer("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
}
if (process.env.REDUIT) await envoyer("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await envoyer("Page.navigate", { url });
for (let i = 0; i < 100 && !evenements.some((e) => e.method === "Page.loadEventFired"); i++) await pause(100);
await pause(1500);

for (const e of etapes) {
  if (e.js) await envoyer("Runtime.evaluate", { expression: e.js, awaitPromise: true });
  if (e.scroll !== undefined) await envoyer("Runtime.evaluate", { expression: `window.scrollTo(0, ${e.scroll})` });
  await pause(e.attente ?? 2500);
  const r = await envoyer("Page.captureScreenshot", { format: "jpeg", quality: 72 });
  writeFileSync(join(dossier, `${e.nom}.jpg`), Buffer.from(r.result.data, "base64"));
  console.log("capture", e.nom);
}
if (process.env.SONDE) { const r = await envoyer("Runtime.evaluate", { expression: process.env.SONDE, awaitPromise: true, returnByValue: true }); console.log("sonde", JSON.stringify(r.result?.result?.value)); }
const mesure = await envoyer("Runtime.evaluate", { expression: "JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth })", returnByValue: true });
console.log(mesure.result?.result?.value);
const exceptions = evenements.filter((e) => e.method === "Runtime.exceptionThrown").map((e) => e.params.exceptionDetails.exception?.description?.split("\n")[0]);
const consoles = evenements.filter((e) => e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)).map((e) => e.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
console.log("exceptions", JSON.stringify(exceptions));
console.log("console", JSON.stringify(consoles));
ws.close();
chrome.kill();
process.exit(0);
