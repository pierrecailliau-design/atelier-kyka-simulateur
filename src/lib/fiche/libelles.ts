/** Libellés et options des champs de la fiche, partagés entre le serveur (IA) et le navigateur (curseurs). */
import type { Question } from "../ia/types";

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
};


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
};
export const libelleChamp = (c: string) => LIBELLE_CHAMP[c] ?? c;

export const OPTIONS_FAMILLE = [
  { valeur: "dressing", libelle: "Dressing", exemple: "Un dressing de 2,40 m sur 2,50 m de haut avec portes coulissantes en chêne et 4 tiroirs" },
  { valeur: "placard", libelle: "Placard", exemple: "Un placard sous escalier de 1,80 m avec portes battantes laquées" },
  { valeur: "cuisine", libelle: "Cuisine", exemple: "Une cuisine en L, 3 m de meubles bas, 2 m de meubles hauts, plan de travail en quartz" },
  { valeur: "fenetre", libelle: "Fenêtre", exemple: "3 fenêtres PVC oscillo-battantes de 1,20 m sur 1,40 m, double vitrage" },
] as const;
