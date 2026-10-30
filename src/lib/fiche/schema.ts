/**
 * Fiche projet : la structure que l'IA remplit à partir du texte du client,
 * que le moteur de prix lit, que la 3D dessine et que HubSpot reçoit.
 * Tout champ hors de ces listes est refusé : c'est la garantie que l'IA ne « invente » pas.
 */
import { z } from "zod";

export const Gamme = z.enum(["essentiel", "confort", "premium"]);

/**
 * Finition (teinte ou essence) des façades et caissons. Chaque gamme a ses finitions (voir FINITIONS dans libelles.ts) ;
 * le choix de finition est compris dans le prix de la gamme. Absente = finition standard de la gamme.
 */
export const Finition = z.enum([
  // essentiel (mélaminé)
  "blanc",
  "gris_clair",
  "decor_chene",
  // confort (laqué)
  "blanc_laque",
  "lin",
  "sauge",
  "bleu_nuit",
  "anthracite",
  "terracotta",
  // premium (bois)
  "chene_naturel",
  "chene_fume",
  "noyer",
  "frene",
]);

/** Style de poignées des façades. Sans effet sur le prix. */
export const Poignees = z.enum(["barre_noire", "barre_inox", "barre_laiton", "sans"]);

/** Champs présents sur toutes les familles. */
const Commun = {
  /** Nombre d'exemplaires identiques. */
  quantite: z.number().int().min(1).max(20).default(1),
  /** Pièce concernée, texte libre court (chambre, entrée, sous les combles…). Sans effet sur le prix. */
  piece: z.string().max(80).optional(),
  /** Tout ce que le client a dit et qui ne rentre pas dans les cases. Transmis tel quel à HubSpot. */
  commentaire: z.string().max(2000).optional(),
  /** Précisions saisies par le client sur l'écran 3D (« niche pour la TV », « tuyau à contourner »). Transmis à HubSpot. */
  precisions: z.string().max(600).optional(),
  /** Champs remplis par une valeur standard faute d'information (« je ne sais pas »). */
  defautsAppliques: z.array(z.string()).default([]),
};

/** Style de façade : lisse (moderne) ou à cadre (type shaker, plus classique). Sans effet sur le prix. */
export const FacadeStyle = z.enum(["lisse", "cadre"]);
/** Intérieur des caissons : mélaminé blanc (standard) ou assorti aux façades. Sans effet sur le prix. */
export const Interieur = z.enum(["blanc", "assorti"]);

/** Champs communs aux meubles (dressing, placard, cuisine). */
const Meuble = {
  finition: Finition.optional(),
  poignees: Poignees.default("barre_noire"),
  facadeStyle: FacadeStyle.default("lisse"),
  interieur: Interieur.default("assorti"),
};

export const FicheDressing = z.object({
  famille: z.literal("dressing"),
  largeurM: z.number().min(0.6).max(8),
  hauteurM: z.number().min(1.8).max(3.5),
  profondeurM: z.number().min(0.35).max(1),
  gamme: Gamme,
  facade: z.enum(["ouvert", "battant", "coulissant"]),
  tiroirs: z.number().int().min(0).max(20).default(0),
  eclairageLed: z.boolean().default(false),
  /** Nombre de portes équipées d'un miroir. */
  miroirPortes: z.number().int().min(0).max(8).default(0),
  penderieDouble: z.boolean().default(false),
  /** Répartition intérieure : alternance penderie / étagères, tout en penderie, ou tout en étagères. */
  amenagement: z.enum(["mixte", "penderie", "etageres"]).default("mixte"),
  ...Meuble,
  ...Commun,
});

export const FichePlacard = z.object({
  famille: z.literal("placard"),
  largeurM: z.number().min(0.4).max(6),
  hauteurM: z.number().min(0.6).max(3.5),
  profondeurM: z.number().min(0.3).max(1),
  gamme: Gamme,
  portes: z.enum(["battant", "coulissant", "pliant"]),
  configuration: z.enum(["standard", "sous_pente", "sous_escalier"]).default("standard"),
  etageresSupplementaires: z.number().int().min(0).max(20).default(0),
  tiroirs: z.number().int().min(0).max(20).default(0),
  penderie: z.boolean().default(false),
  amenagement: z.enum(["mixte", "penderie", "etageres"]).default("mixte"),
  ...Meuble,
  ...Commun,
});

export const FicheCuisine = z.object({
  famille: z.literal("cuisine"),
  /** Longueur cumulée des meubles bas, en mètres linéaires. */
  longueurBasM: z.number().min(1).max(15),
  /** Longueur cumulée des meubles hauts ; 0 si aucun. */
  longueurHautM: z.number().min(0).max(15).default(0),
  implantation: z.enum(["lineaire", "L", "U", "ilot"]),
  gamme: Gamme,
  planTravail: z.enum(["stratifie", "bois", "quartz"]),
  colonnes: z.number().int().min(0).max(6).default(0),
  tiroirs: z.number().int().min(0).max(20).default(0),
  /** Crédence entre plan et meubles hauts : assortie au plan, blanche, ou carreaux. Sans effet sur le prix. */
  credence: z.enum(["assortie", "blanche", "carreaux"]).default("assortie"),
  /** Hauteur du plan de travail fini, en mètres (standard 0,90 ; adaptée à la taille des utilisateurs). */
  hauteurPlanM: z.number().min(0.82).max(0.98).default(0.9),
  ...Meuble,
  // en cuisine l'intérieur standard est blanc (caissons mélaminés), les façades portent la finition
  interieur: Interieur.default("blanc"),
  ...Commun,
});

export const FicheFenetre = z.object({
  famille: z.literal("fenetre"),
  largeurM: z.number().min(0.3).max(4),
  hauteurM: z.number().min(0.3).max(3),
  materiau: z.enum(["pvc", "aluminium", "bois"]),
  ouverture: z.enum(["fixe", "battant", "oscillo_battant", "coulissant"]),
  vitrage: z.enum(["double", "triple"]).default("double"),
  vantaux: z.union([z.literal(1), z.literal(2)]).default(1),
  /** Teinte des profils (PVC et aluminium) ; une teinte autre que blanc implique couleurHorsBlanc. */
  teinte: z.enum(["blanc", "gris", "anthracite", "noir", "bronze"]).default("blanc"),
  couleurHorsBlanc: z.boolean().default(false),
  /** Petits-bois (croisillons) dans le vitrage : option à chiffrer par l'atelier. */
  petitsBois: z.boolean().default(false),
  depose: z.boolean().default(false),
  voletRoulant: z.boolean().default(false),
  ...Commun,
});

export const FicheProjet = z.discriminatedUnion("famille", [
  FicheDressing,
  FichePlacard,
  FicheCuisine,
  FicheFenetre,
]);

export type FicheProjet = z.infer<typeof FicheProjet>;
export type FicheDressing = z.infer<typeof FicheDressing>;
export type FichePlacard = z.infer<typeof FichePlacard>;
export type FicheCuisine = z.infer<typeof FicheCuisine>;
export type FicheFenetre = z.infer<typeof FicheFenetre>;
export type Famille = FicheProjet["famille"];
export type Gamme = z.infer<typeof Gamme>;
export type Finition = z.infer<typeof Finition>;
export type Poignees = z.infer<typeof Poignees>;
export type FacadeStyle = z.infer<typeof FacadeStyle>;
export type Interieur = z.infer<typeof Interieur>;

/**
 * Met la fiche en cohérence après saisie : une teinte de fenêtre autre que blanc vaut « couleur hors blanc »
 * (c'est elle qui est chiffrée), une finition qui n'appartient pas à la gamme choisie est retirée.
 */
export function normaliser(brut: Record<string, unknown>): Record<string, unknown> {
  const f = { ...brut };
  if (f.famille === "fenetre") {
    if (typeof f.teinte === "string" && f.teinte !== "blanc") f.couleurHorsBlanc = true;
    if (f.teinte === "blanc" && f.couleurHorsBlanc === true) f.teinte = undefined; // couleur demandée sans teinte précise : on laisse le choix
  }
  if (typeof f.finition === "string" && typeof f.gamme === "string" && !FINITIONS_PAR_GAMME[f.gamme as Gamme]?.includes(f.finition as Finition)) {
    delete f.finition;
  }
  return f;
}

/** Finitions autorisées par gamme (les libellés et couleurs sont dans libelles.ts). */
export const FINITIONS_PAR_GAMME: Record<Gamme, Finition[]> = {
  essentiel: ["blanc", "gris_clair", "decor_chene"],
  confort: ["blanc_laque", "lin", "sauge", "bleu_nuit", "anthracite", "terracotta"],
  premium: ["chene_naturel", "chene_fume", "noyer", "frene"],
};

/** Finition effective : celle choisie si elle est de la gamme, sinon la première de la gamme. */
export const finitionEffective = (gamme: Gamme, finition?: Finition): Finition => (finition && FINITIONS_PAR_GAMME[gamme].includes(finition) ? finition : FINITIONS_PAR_GAMME[gamme][0]);

/** Valeurs standard appliquées quand le client répond « je ne sais pas ». */
export const DEFAUTS: Record<Famille, Partial<FicheProjet>> = {
  dressing: { largeurM: 2.4, hauteurM: 2.5, profondeurM: 0.6, gamme: "confort", facade: "coulissant" },
  placard: { largeurM: 1.8, hauteurM: 2.5, profondeurM: 0.6, gamme: "confort", portes: "battant" },
  cuisine: { longueurBasM: 3, longueurHautM: 2, implantation: "lineaire", gamme: "confort", planTravail: "stratifie" },
  fenetre: { largeurM: 1.2, hauteurM: 1.4, materiau: "pvc", ouverture: "oscillo_battant", vantaux: 2, vitrage: "double" },
};

/** Libellés pour l'affichage client. */
export const LIBELLES: Record<Famille, string> = {
  dressing: "Dressing",
  placard: "Placard",
  cuisine: "Cuisine",
  fenetre: "Fenêtre",
};
