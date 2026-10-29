/**
 * Lecture de la grille depuis le Google Sheet, avec cache en mémoire.
 *
 * Prérequis côté Google : une clé d'API (Sheets API activée) et le Sheet partagé en lecture
 * « Toute personne disposant du lien » ; ou bien un compte de service ajouté en lecteur sur
 * le Sheet (à brancher dans `lireFeuilles` si on préfère ne pas rendre le lien public).
 *
 * Variables d'environnement :
 *   GRILLE_SHEET_ID  — identifiant du Sheet (dans son URL)
 *   GOOGLE_API_KEY   — clé d'API Google
 *   GRILLE_CACHE_S   — durée du cache en secondes (défaut 600 = 10 min)
 */
import { grilleDeTest } from "./fixture";
import { parseGrille, type Feuille } from "./parse";
import type { Grille } from "./types";

const ONGLETS = {
  tarifs: "Tarifs de base",
  options: "Options",
  regles: "Règles",
} as const;

let cache: { grille: Grille; expire: number } | null = null;

async function lireFeuilles(sheetId: string, apiKey: string): Promise<Record<keyof typeof ONGLETS, Feuille>> {
  const ranges = Object.values(ONGLETS)
    .map((o) => `ranges=${encodeURIComponent(`'${o}'!A1:H200`)}`)
    .join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API ${res.status} : ${await res.text()}`);
  const data = (await res.json()) as { valueRanges: { values?: Feuille }[] };
  const [tarifs, options, regles] = data.valueRanges.map((v) => v.values ?? []);
  return { tarifs, options, regles };
}

/**
 * Renvoie la grille courante. Sans configuration (pas de GRILLE_SHEET_ID), renvoie la grille
 * de test, pour que le site tourne en local sans secret.
 */
export async function chargerGrille(): Promise<Grille> {
  const sheetId = process.env.GRILLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!sheetId || !apiKey) return grilleDeTest();

  const maintenant = Date.now();
  if (cache && cache.expire > maintenant) return cache.grille;

  const ttl = Number(process.env.GRILLE_CACHE_S ?? 600) * 1000;
  try {
    const feuilles = await lireFeuilles(sheetId, apiKey);
    const grille = parseGrille(feuilles, `sheet:${sheetId}@${new Date(maintenant).toISOString()}`);
    cache = { grille, expire: maintenant + ttl };
    return grille;
  } catch (err) {
    // Une grille périmée vaut mieux qu'un site en panne : on garde l'ancienne si on en a une.
    if (cache) return cache.grille;
    throw err;
  }
}
