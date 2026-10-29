/**
 * Copie de la grille de TEST (valeurs fictives) telle qu'elle est dans le Google Sheet
 * « Atelier Kyka — Grille de prix simulateur (TEST) ». Sert aux tests et au mode hors-ligne.
 * Si le Sheet change, ce fichier n'a pas à suivre : il fige la version de référence des tests.
 */
import { parseGrille, type Feuille } from "./parse";
import type { Grille } from "./types";

export const FEUILLE_TARIFS: Feuille = [
  ["famille", "libelle", "unite", "essentiel", "confort", "premium", "minimum_unite", "notes"],
  ["dressing", "Dressing", "ml", 450, 700, 1100, 0.6, ""],
  ["placard", "Placard", "ml", 400, 600, 950, 0.6, ""],
  ["cuisine_bas", "Cuisine — meubles bas", "ml", 900, 1300, 2000, 1, ""],
  ["cuisine_haut", "Cuisine — meubles hauts", "ml", 500, 750, 1100, 0, ""],
  ["fenetre", "Fenêtre", "m2", 450, 700, 950, 1, ""],
];

export const FEUILLE_OPTIONS: Feuille = [
  ["code", "libelle", "familles", "type", "montant", "notes"],
  ["portes_coulissantes", "Portes coulissantes", "dressing,placard", "par_ml", 180, ""],
  ["portes_battantes", "Portes battantes", "dressing", "par_ml", 120, ""],
  ["portes_pliantes", "Portes pliantes", "placard", "par_ml", 100, ""],
  ["tiroir", "Tiroir", "dressing,placard,cuisine", "par_unite", 90, ""],
  ["eclairage_led", "Éclairage LED", "dressing,placard", "par_ml", 60, ""],
  ["miroir", "Miroir sur porte", "dressing", "par_porte", 150, ""],
  ["sous_pente", "Sous pente ou sous escalier", "placard", "pourcentage", 15, ""],
  ["plan_stratifie", "Plan de travail stratifié", "cuisine", "par_ml", 120, ""],
  ["plan_bois", "Plan de travail bois", "cuisine", "par_ml", 300, ""],
  ["plan_quartz", "Plan de travail quartz", "cuisine", "par_ml", 450, ""],
  ["ilot", "Îlot central", "cuisine", "par_unite", 1500, ""],
  ["colonne", "Colonne", "cuisine", "par_unite", 600, ""],
  ["oscillo_battant", "Oscillo-battant", "fenetre", "par_vantail", 80, ""],
  ["coulissant_fenetre", "Coulissant", "fenetre", "pourcentage", 20, ""],
  ["triple_vitrage", "Triple vitrage", "fenetre", "pourcentage", 25, ""],
  ["couleur_hors_blanc", "Couleur hors blanc", "fenetre", "pourcentage", 10, ""],
  ["depose", "Dépose de l'ancienne fenêtre", "fenetre", "par_unite", 90, ""],
  ["volet_roulant", "Volet roulant", "fenetre", "par_unite", 350, ""],
];

export const FEUILLE_REGLES: Feuille = [
  ["cle", "valeur", "description"],
  ["fourchette_basse", 0.85, ""],
  ["fourchette_haute", 1.15, ""],
  ["minimum_commande", 800, ""],
  ["hauteur_majoration_seuil_m", 2.6, ""],
  ["hauteur_majoration_pct", 10, ""],
  ["tva_incluse", "oui", ""],
  ["pose_incluse", "oui", ""],
  ["validite_jours", 30, ""],
];

export function grilleDeTest(): Grille {
  return parseGrille(
    { tarifs: FEUILLE_TARIFS, options: FEUILLE_OPTIONS, regles: FEUILLE_REGLES },
    "fixture-test-2026-10-29",
  );
}
