/**
 * Fiche projet : la structure que l'IA remplit à partir du texte du client,
 * que le moteur de prix lit, que la 3D dessine et que HubSpot reçoit.
 * Tout champ hors de ces listes est refusé : c'est la garantie que l'IA ne « invente » pas.
 */
import { z } from "zod";

export const Gamme = z.enum(["essentiel", "confort", "premium"]);

/** Champs présents sur toutes les familles. */
const Commun = {
  /** Nombre d'exemplaires identiques. */
  quantite: z.number().int().min(1).max(20).default(1),
  /** Pièce concernée, texte libre court (chambre, entrée, sous les combles…). Sans effet sur le prix. */
  piece: z.string().max(80).optional(),
  /** Tout ce que le client a dit et qui ne rentre pas dans les cases. Transmis tel quel à HubSpot. */
  commentaire: z.string().max(2000).optional(),
  /** Champs remplis par une valeur standard faute d'information (« je ne sais pas »). */
  defautsAppliques: z.array(z.string()).default([]),
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
  couleurHorsBlanc: z.boolean().default(false),
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
