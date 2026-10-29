/**
 * Types de la grille de prix.
 * La grille vit dans un Google Sheet à trois onglets (Tarifs de base, Options, Règles)
 * et est relue par le site. Ces types en sont la représentation en mémoire.
 */

export const GAMMES = ["essentiel", "confort", "premium"] as const;
export type Gamme = (typeof GAMMES)[number];

export const FAMILLES_TARIF = [
  "dressing",
  "placard",
  "cuisine_bas",
  "cuisine_haut",
  "fenetre",
] as const;
export type FamilleTarif = (typeof FAMILLES_TARIF)[number];

export type Unite = "ml" | "m2";

export interface TarifBase {
  famille: FamilleTarif;
  libelle: string;
  unite: Unite;
  /** Prix par unité d'œuvre, par gamme. Pour la fenêtre : PVC / aluminium / bois. */
  prix: Record<Gamme, number>;
  /** Quantité minimale facturée (ex. 1 m² par fenêtre). 0 = pas de minimum. */
  minimumUnite: number;
}

export const OPTION_TYPES = [
  "par_ml",
  "par_unite",
  "par_porte",
  "par_vantail",
  "pourcentage",
] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

export interface OptionTarif {
  code: string;
  libelle: string;
  /** Familles où l'option s'applique : dressing, placard, cuisine, fenetre. */
  familles: string[];
  type: OptionType;
  /** Montant en € (ou en % pour le type pourcentage). */
  montant: number;
}

export interface Regles {
  fourchetteBasse: number;
  fourchetteHaute: number;
  minimumCommande: number;
  hauteurMajorationSeuilM: number;
  hauteurMajorationPct: number;
  tvaIncluse: boolean;
  poseIncluse: boolean;
  validiteJours: number;
}

export interface Grille {
  tarifs: TarifBase[];
  options: OptionTarif[];
  regles: Regles;
  /** Horodatage ou identifiant de la version lue, pour tracer d'où vient un prix. */
  version: string;
}
