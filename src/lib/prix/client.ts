/**
 * Version « client » de l'estimation : ce que le navigateur a le droit de voir.
 * Jamais de montant par ligne ni de tarif unitaire (la grille reste à l'atelier), et la fourchette
 * seulement une fois le contact laissé. L'estimation complète ne sort du serveur que vers HubSpot.
 */
import type { Estimation } from "./engine";

export interface LigneClient {
  code: string;
  libelle: string;
  /** Quantité lisible sans prix : « 2,4 ml », « 4 unités ». Vide pour une majoration. */
  quantite: string;
}

export interface EstimationClient {
  famille: Estimation["famille"];
  lignes: LigneClient[];
  majorations: LigneClient[];
  quantite: number;
  minimumApplique: boolean;
  /** Absente tant que le client n'a pas laissé ses coordonnées. */
  fourchette?: { basse: number; haute: number };
  optionsNonChiffrees: string[];
  regles: Estimation["regles"];
}

export function pourClient(e: Estimation, avecPrix: boolean): EstimationClient {
  const ligne = (l: Estimation["base"]): LigneClient => ({ code: l.code, libelle: l.libelle, quantite: l.quantite });
  return {
    famille: e.famille,
    lignes: [ligne(e.base), ...e.optionsFixes.map(ligne)],
    majorations: e.pourcentages.map((l) => ({ code: l.code, libelle: l.libelle, quantite: "" })),
    quantite: e.quantite,
    minimumApplique: e.minimumApplique,
    ...(avecPrix ? { fourchette: e.fourchette } : {}),
    optionsNonChiffrees: e.optionsNonChiffrees,
    regles: e.regles,
  };
}
