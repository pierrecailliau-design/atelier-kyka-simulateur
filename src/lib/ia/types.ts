import type { Famille, FicheProjet } from "../fiche/schema";

/** Un échange du dialogue client ↔ IA. */
export interface Tour {
  role: "user" | "assistant";
  content: string;
}

/** Une question à poser au client pour compléter la fiche. */
export interface Question {
  /** Nom du champ de la fiche concerné (largeurM, gamme, portes…). */
  champ: string;
  /** La question, formulée pour un particulier. */
  question: string;
  /** Réponses proposées sous forme de boutons ; absent = saisie libre (nombre). */
  options?: { valeur: string | number | boolean; libelle: string }[];
  /** Valeur appliquée si le client répond « je ne sais pas ». */
  defaut?: string | number | boolean;
  /** Unité attendue pour une saisie libre (m, cm…). */
  unite?: string;
}

export type ReponseIA =
  | {
      statut: "questions";
      message: string;
      famille?: Famille;
      questions: Question[];
      /** Ce que l'IA a déjà compris, pour pré-remplir la suite. */
      ficheProvisoire?: Record<string, unknown>;
    }
  | {
      statut: "fiche";
      message: string;
      fiche: FicheProjet;
    }
  | {
      statut: "hors_sujet";
      message: string;
    };
