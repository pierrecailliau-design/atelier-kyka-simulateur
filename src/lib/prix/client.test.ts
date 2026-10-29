import { describe, expect, it } from "vitest";
import { FicheProjet } from "../fiche/schema";
import { grilleDeTest } from "../grille/fixture";
import { pourClient } from "./client";
import { estimer } from "./engine";

const fiche = FicheProjet.parse({ famille: "dressing", largeurM: 2.4, hauteurM: 2.8, profondeurM: 0.6, gamme: "confort", facade: "coulissant", tiroirs: 4, eclairageLed: true, quantite: 2, defautsAppliques: [] });
const estimation = estimer(fiche, grilleDeTest());

describe("estimation côté client", () => {
  it("ne contient aucun montant par ligne ni tarif unitaire", () => {
    const c = pourClient(estimation, true);
    const texte = JSON.stringify(c);
    expect(texte).not.toMatch(/×/); // « 2,4 ml × 700 € » reste côté serveur
    expect(texte).not.toMatch(/"montant"/);
    expect(texte).not.toMatch(/sousTotal|prixCalcule|prixExemplaire|prixAvantMinimum/);
    expect(c.lignes.map((l) => l.quantite)).toEqual(["2,4 ml", "2,4 ml", "4 unités", "2,4 ml"]);
    expect(c.majorations.map((l) => l.code)).toEqual(["hauteur"]);
    expect(c.quantite).toBe(2);
  });

  it("ne donne la fourchette qu'après le contact", () => {
    expect(pourClient(estimation, false).fourchette).toBeUndefined();
    expect(pourClient(estimation, true).fourchette).toEqual(estimation.fourchette);
  });
});
