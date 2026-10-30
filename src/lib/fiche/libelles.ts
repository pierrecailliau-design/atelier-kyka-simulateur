/** Libellés et options des champs de la fiche, partagés entre le serveur (IA) et le navigateur (curseurs, 3D). */
import type { Question } from "../ia/types";
import { FINITIONS_PAR_GAMME, type Finition, type Gamme, type Poignees } from "./schema";

/**
 * Finitions par gamme : libellé client, couleur de référence (hex) et, pour le bois, un veinage.
 * `teinteBois` multiplie la texture de chêne procédurale ; `contraste` atténue le veinage (frêne, décor).
 */
export const FINITIONS: Record<Finition, { libelle: string; couleur: string; bois?: { teinte: string; contraste: number } }> = {
  blanc: { libelle: "Blanc", couleur: "#f4f2ed" },
  gris_clair: { libelle: "Gris clair", couleur: "#d7d6d2" },
  decor_chene: { libelle: "Décor chêne clair", couleur: "#e4d2b4", bois: { teinte: "#f1e4cf", contraste: 0.55 } },
  blanc_laque: { libelle: "Blanc laqué", couleur: "#f5f3ee" },
  lin: { libelle: "Lin", couleur: "#d8d1c4" },
  sauge: { libelle: "Vert sauge", couleur: "#a9b5a2" },
  bleu_nuit: { libelle: "Bleu nuit", couleur: "#30405a" },
  anthracite: { libelle: "Gris anthracite", couleur: "#4a4c50" },
  terracotta: { libelle: "Terracotta", couleur: "#b9704f" },
  chene_naturel: { libelle: "Chêne naturel", couleur: "#d9bf98", bois: { teinte: "#f6ecdc", contraste: 1 } },
  chene_fume: { libelle: "Chêne fumé", couleur: "#9c7a55", bois: { teinte: "#a88560", contraste: 1.1 } },
  noyer: { libelle: "Noyer", couleur: "#7a5538", bois: { teinte: "#8a6141", contraste: 1.3 } },
  frene: { libelle: "Frêne clair", couleur: "#ebe1cf", bois: { teinte: "#faf3e6", contraste: 0.6 } },
};

export const POIGNEES: Record<Poignees, { libelle: string; couleur: string; metal: number; rugosite: number }> = {
  barre_noire: { libelle: "Barre noire", couleur: "#26262a", metal: 0.7, rugosite: 0.35 },
  barre_inox: { libelle: "Barre inox", couleur: "#c9ccd0", metal: 0.95, rugosite: 0.25 },
  barre_laiton: { libelle: "Barre laiton", couleur: "#c9a35a", metal: 0.9, rugosite: 0.3 },
  sans: { libelle: "Sans poignée (ouverture par pression)", couleur: "#000000", metal: 0, rugosite: 1 },
};

export const TEINTES_FENETRE: Record<"blanc" | "gris" | "anthracite" | "noir" | "bronze", { libelle: string; couleur: string }> = {
  blanc: { libelle: "Blanc", couleur: "#f5f5f3" },
  gris: { libelle: "Gris clair", couleur: "#b9bcbf" },
  anthracite: { libelle: "Gris anthracite", couleur: "#3d4247" },
  noir: { libelle: "Noir", couleur: "#1f2124" },
  bronze: { libelle: "Bronze", couleur: "#6b5a46" },
};

/** Options du moteur qui ne sont pas dans la grille de test : libellés lisibles pour « à chiffrer lors de la visite ». */
export const LIBELLE_OPTION: Record<string, string> = {
  penderie_double: "penderie double",
  penderie: "penderie",
  etagere_supplementaire: "étagères supplémentaires",
  petits_bois: "petits-bois (croisillons)",
  portes_battantes: "portes battantes",
  portes_coulissantes: "portes coulissantes",
  portes_pliantes: "portes pliantes",
  eclairage_led: "éclairage LED",
  miroir: "portes miroir",
  tiroir: "tiroirs",
  colonne: "colonnes",
  ilot: "îlot",
  depose: "dépose",
  volet_roulant: "volet roulant",
  oscillo_battant: "oscillo-battant",
};
export const libelleOption = (code: string) => LIBELLE_OPTION[code] ?? code.replace(/_/g, " ");

export const LIBELLE_QUESTION: Record<string, string> = {
  largeurM: "Quelle largeur, en mètres ?",
  hauteurM: "Quelle hauteur, en mètres ?",
  profondeurM: "Quelle profondeur, en mètres ?",
  longueurBasM: "Quelle longueur de meubles bas, en mètres ?",
  longueurHautM: "Quelle longueur de meubles hauts, en mètres (0 si aucun) ?",
  gamme: "Quelle gamme de finition ?",
  facade: "Quel type de façade ?",
  portes: "Quel type de portes ?",
  configuration: "Le placard est-il standard, sous pente ou sous escalier ?",
  implantation: "Quelle implantation de cuisine ?",
  planTravail: "Quel plan de travail ?",
  materiau: "Quel matériau pour la fenêtre ?",
  ouverture: "Quel type d'ouverture ?",
  vitrage: "Double ou triple vitrage ?",
  vantaux: "Un ou deux vantaux ?",
  quantite: "Combien d'exemplaires ?",
  finition: "Quelle finition (teinte ou essence) ?",
  poignees: "Quel style de poignées ?",
  amenagement: "Plutôt penderie, étagères, ou les deux ?",
  credence: "Quelle crédence ?",
  teinte: "Quelle teinte pour les profils ?",
};

export const OPTIONS_CHAMP: Record<string, Question["options"]> = {
  gamme: [
    { valeur: "essentiel", libelle: "Essentiel (mélaminé)" },
    { valeur: "confort", libelle: "Confort (MDF laqué)" },
    { valeur: "premium", libelle: "Premium (chêne, bois massif)" },
  ],
  facade: [
    { valeur: "ouvert", libelle: "Ouvert, sans portes" },
    { valeur: "battant", libelle: "Portes battantes" },
    { valeur: "coulissant", libelle: "Portes coulissantes" },
  ],
  portes: [
    { valeur: "battant", libelle: "Battantes" },
    { valeur: "coulissant", libelle: "Coulissantes" },
    { valeur: "pliant", libelle: "Pliantes" },
  ],
  configuration: [
    { valeur: "standard", libelle: "Standard" },
    { valeur: "sous_pente", libelle: "Sous pente" },
    { valeur: "sous_escalier", libelle: "Sous escalier" },
  ],
  implantation: [
    { valeur: "lineaire", libelle: "En ligne" },
    { valeur: "L", libelle: "En L" },
    { valeur: "U", libelle: "En U" },
    { valeur: "ilot", libelle: "Avec îlot" },
  ],
  planTravail: [
    { valeur: "stratifie", libelle: "Stratifié" },
    { valeur: "bois", libelle: "Bois" },
    { valeur: "quartz", libelle: "Quartz" },
  ],
  materiau: [
    { valeur: "pvc", libelle: "PVC" },
    { valeur: "aluminium", libelle: "Aluminium" },
    { valeur: "bois", libelle: "Bois" },
  ],
  ouverture: [
    { valeur: "fixe", libelle: "Fixe" },
    { valeur: "battant", libelle: "Battante" },
    { valeur: "oscillo_battant", libelle: "Oscillo-battante" },
    { valeur: "coulissant", libelle: "Coulissante" },
  ],
  vitrage: [
    { valeur: "double", libelle: "Double" },
    { valeur: "triple", libelle: "Triple" },
  ],
  vantaux: [
    { valeur: 1, libelle: "Un vantail" },
    { valeur: 2, libelle: "Deux vantaux" },
  ],
  finition: (Object.keys(FINITIONS) as Finition[]).map((f) => ({ valeur: f, libelle: FINITIONS[f].libelle })),
  poignees: (Object.keys(POIGNEES) as Poignees[]).map((p) => ({ valeur: p, libelle: POIGNEES[p].libelle })),
  amenagement: [
    { valeur: "mixte", libelle: "Penderie et étagères" },
    { valeur: "penderie", libelle: "Surtout de la penderie" },
    { valeur: "etageres", libelle: "Surtout des étagères" },
  ],
  credence: [
    { valeur: "assortie", libelle: "Assortie au plan" },
    { valeur: "blanche", libelle: "Blanche" },
    { valeur: "carreaux", libelle: "Carreaux" },
  ],
  teinte: (Object.keys(TEINTES_FENETRE) as (keyof typeof TEINTES_FENETRE)[]).map((t) => ({ valeur: t, libelle: TEINTES_FENETRE[t].libelle })),
};

/** Options de finition restreintes à une gamme, pour les curseurs. */
export const optionsFinition = (gamme: Gamme) => FINITIONS_PAR_GAMME[gamme].map((f) => ({ valeur: f, libelle: FINITIONS[f].libelle, couleur: FINITIONS[f].couleur }));


/** Noms lisibles des champs, pour afficher « valeurs standard appliquées : profondeur ». */
export const LIBELLE_CHAMP: Record<string, string> = {
  largeurM: "largeur",
  hauteurM: "hauteur",
  profondeurM: "profondeur",
  longueurBasM: "meubles bas",
  longueurHautM: "meubles hauts",
  gamme: "gamme",
  facade: "façade",
  portes: "portes",
  configuration: "configuration",
  implantation: "implantation",
  planTravail: "plan de travail",
  materiau: "matériau",
  ouverture: "ouverture",
  vitrage: "vitrage",
  vantaux: "vantaux",
  quantite: "quantité",
  finition: "finition",
  poignees: "poignées",
  amenagement: "aménagement",
  credence: "crédence",
  teinte: "teinte",
  eclairageLed: "éclairage LED",
  miroirPortes: "portes miroir",
  penderieDouble: "penderie double",
  etageresSupplementaires: "étagères supplémentaires",
  penderie: "penderie",
  tiroirs: "tiroirs",
  colonnes: "colonnes",
  voletRoulant: "volet roulant",
  depose: "dépose de l'existant",
  couleurHorsBlanc: "couleur hors blanc",
  petitsBois: "petits-bois",
  piece: "pièce",
};
export const libelleChamp = (c: string) => LIBELLE_CHAMP[c] ?? c;

export const OPTIONS_FAMILLE = [
  { valeur: "dressing", libelle: "Dressing", exemple: "Un dressing de 2,40 m sur 2,50 m de haut avec portes coulissantes en chêne et 4 tiroirs" },
  { valeur: "placard", libelle: "Placard", exemple: "Un placard sous escalier de 1,80 m avec portes battantes laquées" },
  { valeur: "cuisine", libelle: "Cuisine", exemple: "Une cuisine en L, 3 m de meubles bas, 2 m de meubles hauts, plan de travail en quartz" },
  { valeur: "fenetre", libelle: "Fenêtre", exemple: "3 fenêtres PVC oscillo-battantes de 1,20 m sur 1,40 m, double vitrage" },
] as const;
