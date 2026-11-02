// Lecture et ecriture de fichiers zip sans dependance (Windows, Linux, macOS).
// Lecture : utilisee pour le fichier Excel (.xlsx = zip de XML). Ecriture : zips de livraison.
import { readFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";

// --- CRC-32 (table classique) ---
const TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const octet of buf) c = TABLE[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Lit un zip et renvoie une Map nom -> Buffer (fichiers seulement)
export function lireZip(chemin) {
  const z = readFileSync(chemin);
  // Fin du repertoire central : signature 0x06054b50, cherchee depuis la fin
  let fin = -1;
  for (let i = z.length - 22; i >= Math.max(0, z.length - 65557); i--) {
    if (z.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error(`zip illisible : ${chemin}`);
  const nb = z.readUInt16LE(fin + 10);
  let p = z.readUInt32LE(fin + 16);
  const fichiers = new Map();
  for (let i = 0; i < nb; i++) {
    if (z.readUInt32LE(p) !== 0x02014b50) throw new Error(`zip illisible (repertoire central) : ${chemin}`);
    const methode = z.readUInt16LE(p + 10);
    const tailleComp = z.readUInt32LE(p + 20);
    const lgNom = z.readUInt16LE(p + 28);
    const lgExtra = z.readUInt16LE(p + 30);
    const lgCom = z.readUInt16LE(p + 32);
    const local = z.readUInt32LE(p + 42);
    const nom = z.toString("utf8", p + 46, p + 46 + lgNom);
    p += 46 + lgNom + lgExtra + lgCom;
    if (nom.endsWith("/")) continue;
    // En-tete local : sa longueur de nom et d'extra peut differer du repertoire central
    const debut = local + 30 + z.readUInt16LE(local + 26) + z.readUInt16LE(local + 28);
    const brut = z.subarray(debut, debut + tailleComp);
    if (methode === 0) fichiers.set(nom, Buffer.from(brut));
    else if (methode === 8) fichiers.set(nom, inflateRawSync(brut));
    else throw new Error(`methode de compression ${methode} non geree (${nom})`);
  }
  return fichiers;
}

// Ecrit un zip a partir d'une liste [{ nom: "dossier/fichier.html", contenu: Buffer }] ; renvoie un Buffer
export function creerZip(entrees) {
  const locaux = [];
  const central = [];
  let decalage = 0;
  // Date DOS fixe (1er janvier 2026) : zips reproductibles
  const heure = 0;
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const { nom, contenu } of entrees) {
    const nomBuf = Buffer.from(nom, "utf8");
    const comp = deflateRawSync(contenu, { level: 9 });
    const stocke = comp.length >= contenu.length;
    const donnees = stocke ? contenu : comp;
    const crc = crc32(contenu);
    const tete = Buffer.alloc(30);
    tete.writeUInt32LE(0x04034b50, 0);
    tete.writeUInt16LE(20, 4);
    tete.writeUInt16LE(0x0800, 6); // noms en UTF-8
    tete.writeUInt16LE(stocke ? 0 : 8, 8);
    tete.writeUInt16LE(heure, 10);
    tete.writeUInt16LE(date, 12);
    tete.writeUInt32LE(crc, 14);
    tete.writeUInt32LE(donnees.length, 18);
    tete.writeUInt32LE(contenu.length, 22);
    tete.writeUInt16LE(nomBuf.length, 26);
    tete.writeUInt16LE(0, 28);
    locaux.push(tete, nomBuf, donnees);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(0x0314, 4); // cree sous Unix, version 2.0
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(stocke ? 0 : 8, 10);
    c.writeUInt16LE(heure, 12);
    c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(contenu.length, 24);
    c.writeUInt16LE(nomBuf.length, 28);
    c.writeUInt32LE((0o100644 << 16) >>> 0, 38); // permissions lisibles par le serveur web
    c.writeUInt32LE(decalage, 42);
    central.push(c, nomBuf);
    decalage += 30 + nomBuf.length + donnees.length;
  }
  const tailleCentral = central.reduce((n, b) => n + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...central, fin]);
}
