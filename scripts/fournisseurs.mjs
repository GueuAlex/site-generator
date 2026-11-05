// Fournisseurs d'IA qui construisent les sites (API compatibles OpenAI) : Kimi par defaut, DeepSeek en option.
// Utilise par scripts/kimi.mjs (appels) et scripts/conso.mjs (soldes et couts).
//   Kimi     : https://platform.kimi.ai/docs (tarifs : /docs/pricing/chat)
//   DeepSeek : https://api-docs.deepseek.com (tarifs : /quick_start/pricing, solde : /api/get-user-balance)
// Prix en USD par million de tokens ; ils peuvent changer : verifier les pages de tarifs.

const nombre = (v) => (v ? Number(v) : null);

// Prix publics de DeepSeek en heures pleines, par modele ; les heures creuses divisent tout par deux
const PRIX_DEEPSEEK = {
  "deepseek-v4-pro": { entree: 1.32, cache: 0.044, sortie: 3.96 },
  "deepseek-flash": { entree: 0.3, cache: 0.006, sortie: 1.2 },
};

// Heures pleines DeepSeek : 1 h - 4 h et 6 h - 10 h UTC, du lundi au vendredi (jours feries chinois ignores)
function heuresPleinesDeepSeek(date) {
  const jour = date.getUTCDay();
  const h = date.getUTCHours();
  return jour >= 1 && jour <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}

export const FOURNISSEURS = {
  kimi: {
    nom: "Kimi",
    cleEnv: "MOONSHOT_API_KEY",
    modeleEnv: "KIMI_MODEL",
    modele: () => process.env.KIMI_MODEL,
    baseURL: () => process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
    maxTokens: () => Number(process.env.KIMI_MAX_TOKENS || 131072),
    effort: () => process.env.KIMI_REASONING_EFFORT || "low",
    // Nom du parametre de longueur maximale de la reponse
    paramLongueur: "max_completion_tokens",
    vision: () => true,
    prix: () => ({
      entree: nombre(process.env.KIMI_PRICE_IN) ?? 2,
      cache: nombre(process.env.KIMI_PRICE_CACHE_IN) ?? 0.2,
      sortie: nombre(process.env.KIMI_PRICE_OUT) ?? 10,
      remise: null,
    }),
    // GET /users/me/balance -> { data: { available_balance, cash_balance, voucher_balance } }
    async solde(cle) {
      const json = await lireJson(`${this.baseURL()}/users/me/balance`, cle);
      if (json.code !== 0) throw new Error("réponse inattendue");
      const d = json.data;
      return { disponible: d.available_balance, detail: `espèces ${d.cash_balance.toFixed(2)} $, bons ${d.voucher_balance.toFixed(2)} $`, devise: "USD" };
    },
  },
  deepseek: {
    nom: "DeepSeek",
    cleEnv: "DEEPSEEK_API_KEY",
    modeleEnv: "DEEPSEEK_MODEL",
    modele: () => process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    baseURL: () => process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    // Par defaut, DeepSeek coupe a 64 000 tokens en mode raisonnement : trop court pour un site entier (maximum 393 216)
    maxTokens: () => Number(process.env.DEEPSEEK_MAX_TOKENS || 200000),
    effort: () => process.env.DEEPSEEK_REASONING_EFFORT || "low",
    paramLongueur: "max_tokens",
    // Seul deepseek-flash lit les images (le logo en PNG ou JPG n'est alors pas envoye)
    vision: () => (process.env.DEEPSEEK_MODEL || "deepseek-v4-pro") === "deepseek-flash",
    prix(modele, date = new Date()) {
      const base = PRIX_DEEPSEEK[modele] || PRIX_DEEPSEEK["deepseek-v4-pro"];
      const p = {
        entree: nombre(process.env.DEEPSEEK_PRICE_IN) ?? base.entree,
        cache: nombre(process.env.DEEPSEEK_PRICE_CACHE_IN) ?? base.cache,
        sortie: nombre(process.env.DEEPSEEK_PRICE_OUT) ?? base.sortie,
      };
      if (heuresPleinesDeepSeek(date)) return { ...p, remise: null };
      return { entree: p.entree / 2, cache: p.cache / 2, sortie: p.sortie / 2, remise: "heures creuses, -50 %" };
    },
    // GET /user/balance -> { is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
    async solde(cle) {
      const json = await lireJson(`${this.baseURL()}/user/balance`, cle);
      const b = json.balance_infos?.find((x) => x.currency === "USD") || json.balance_infos?.[0];
      if (!b) throw new Error("réponse inattendue");
      return {
        disponible: Number(b.total_balance),
        detail: `rechargé ${b.topped_up_balance}, offert ${b.granted_balance}${json.is_available ? "" : ", appels bloqués"}`,
        devise: b.currency,
      };
    },
  },
};

async function lireJson(url, cle) {
  const rep = await fetch(url, { headers: { Authorization: `Bearer ${cle}` } });
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(`HTTP ${rep.status}${json.error?.message ? `, ${json.error.message}` : ""}`);
  return json;
}

export function fournisseur(id) {
  const f = FOURNISSEURS[id];
  if (!f) throw new Error(`Fournisseur « ${id} » inconnu. Disponibles : ${Object.keys(FOURNISSEURS).join(", ")}.`);
  return f;
}

// Cout d'un appel (tokens : entree, entree_cache, sortie), au tarif du fournisseur a la date de l'appel
export function cout(id, modele, tokens, date = new Date()) {
  const p = fournisseur(id).prix(modele, date);
  const cache = tokens.entree_cache || 0;
  const usd = ((tokens.entree - cache) * p.entree + cache * p.cache + tokens.sortie * p.sortie) / 1_000_000;
  return { usd: Math.round(usd * 10000) / 10000, prix: p };
}
