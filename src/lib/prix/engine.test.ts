import { describe, expect, it } from "vitest";
import { FicheProjet } from "../fiche/schema";
import { grilleDeTest } from "../grille/fixture";
import { GrilleInvalide, parseOptions, parseRegles } from "../grille/parse";
import { estimer } from "./engine";

const grille = grilleDeTest();

describe("moteur de prix — exemples du cadrage", () => {
  it("dressing 2,40 m Confort, coulissant, 4 tiroirs, LED → 2 616 €, fourchette 2 220–3 010", () => {
    const fiche = FicheProjet.parse({
      famille: "dressing",
      largeurM: 2.4,
      hauteurM: 2.5,
      profondeurM: 0.6,
      gamme: "confort",
      facade: "coulissant",
      tiroirs: 4,
      eclairageLed: true,
    });
    const e = estimer(fiche, grille);
    expect(e.base.montant).toBe(1680);
    expect(e.optionsFixes.map((l) => [l.code, l.montant])).toEqual([
      ["portes_coulissantes", 432],
      ["tiroir", 360],
      ["eclairage_led", 144],
    ]);
    expect(e.sousTotal).toBe(2616);
    expect(e.pourcentages).toEqual([]);
    expect(e.prixCalcule).toBe(2616);
    expect(e.fourchette).toEqual({ basse: 2220, haute: 3010 });
    expect(e.minimumApplique).toBe(false);
    expect(e.optionsNonChiffrees).toEqual([]);
  });

  it("même dressing en 2,80 m de haut → +10 %", () => {
    const fiche = FicheProjet.parse({
      famille: "dressing",
      largeurM: 2.4,
      hauteurM: 2.8,
      profondeurM: 0.6,
      gamme: "confort",
      facade: "coulissant",
      tiroirs: 4,
      eclairageLed: true,
    });
    const e = estimer(fiche, grille);
    expect(e.pourcentages).toHaveLength(1);
    expect(e.pourcentages[0].montant).toBe(261.6);
    expect(e.prixCalcule).toBe(2878);
    expect(e.fourchette).toEqual({ basse: 2450, haute: 3310 });
  });

  it("placard 1,80 m Confort battant sous escalier → base 1 080 + 15 %", () => {
    const fiche = FicheProjet.parse({
      famille: "placard",
      largeurM: 1.8,
      hauteurM: 2.5,
      profondeurM: 0.6,
      gamme: "confort",
      portes: "battant",
      configuration: "sous_escalier",
    });
    const e = estimer(fiche, grille);
    expect(e.base.montant).toBe(1080);
    expect(e.optionsFixes).toEqual([]);
    expect(e.pourcentages.map((p) => [p.code, p.montant])).toEqual([["sous_pente", 162]]);
    expect(e.prixCalcule).toBe(1242);
    expect(e.fourchette).toEqual({ basse: 1060, haute: 1430 });
    expect(e.optionsNonChiffrees).toEqual([]);
  });

  it("cuisine 3 m bas + 2 m hauts, Confort, stratifié, 1 colonne → 6 360 €", () => {
    const fiche = FicheProjet.parse({
      famille: "cuisine",
      longueurBasM: 3,
      longueurHautM: 2,
      implantation: "lineaire",
      gamme: "confort",
      planTravail: "stratifie",
      colonnes: 1,
    });
    const e = estimer(fiche, grille);
    expect(e.base.montant).toBe(3900);
    expect(e.optionsFixes.map((l) => [l.code, l.montant])).toEqual([
      ["cuisine_haut", 1500],
      ["plan_stratifie", 360],
      ["colonne", 600],
    ]);
    expect(e.prixCalcule).toBe(6360);
    expect(e.fourchette).toEqual({ basse: 5410, haute: 7310 });
  });

  it("fenêtre PVC 1,20 × 1,40 oscillo-battant 2 vantaux, dépose → 1 006 € ; × 3 → 3 018 €", () => {
    const base = {
      famille: "fenetre" as const,
      largeurM: 1.2,
      hauteurM: 1.4,
      materiau: "pvc" as const,
      ouverture: "oscillo_battant" as const,
      vantaux: 2 as const,
      depose: true,
    };
    const une = estimer(FicheProjet.parse(base), grille);
    expect(une.base.montant).toBe(756);
    expect(une.optionsFixes.map((l) => [l.code, l.montant])).toEqual([
      ["oscillo_battant", 160],
      ["depose", 90],
    ]);
    expect(une.prixCalcule).toBe(1006);
    expect(une.fourchette).toEqual({ basse: 860, haute: 1160 });

    const trois = estimer(FicheProjet.parse({ ...base, quantite: 3 }), grille);
    expect(trois.prixExemplaire).toBe(1006);
    expect(trois.prixCalcule).toBe(3018);
    expect(trois.fourchette).toEqual({ basse: 2570, haute: 3470 });
  });

  it("fenêtre alu coulissante, triple vitrage, couleur → trois pourcentages cumulés sur le sous-total", () => {
    const fiche = FicheProjet.parse({
      famille: "fenetre",
      largeurM: 1.2,
      hauteurM: 1.4,
      materiau: "aluminium",
      ouverture: "coulissant",
      vitrage: "triple",
      couleurHorsBlanc: true,
    });
    const e = estimer(fiche, grille);
    expect(e.sousTotal).toBe(1176);
    expect(e.pourcentages.map((p) => p.montant)).toEqual([235.2, 294, 117.6]);
    expect(e.prixCalcule).toBe(1823);
    expect(e.fourchette).toEqual({ basse: 1550, haute: 2100 });
  });

  it("petite fenêtre fixe → minimum 1 m² puis minimum de commande 800 €", () => {
    const fiche = FicheProjet.parse({
      famille: "fenetre",
      largeurM: 0.5,
      hauteurM: 0.5,
      materiau: "pvc",
      ouverture: "fixe",
    });
    const e = estimer(fiche, grille);
    expect(e.base.detail).toContain("minimum 1 m²");
    expect(e.base.montant).toBe(450);
    expect(e.prixAvantMinimum).toBe(450);
    expect(e.minimumApplique).toBe(true);
    expect(e.prixCalcule).toBe(800);
    expect(e.fourchette).toEqual({ basse: 680, haute: 920 });
  });

  it("une option absente de la grille coûte 0 et est signalée à chiffrer", () => {
    const fiche = FicheProjet.parse({
      famille: "dressing",
      largeurM: 2,
      hauteurM: 2.5,
      profondeurM: 0.6,
      gamme: "essentiel",
      facade: "ouvert",
      penderieDouble: true,
    });
    const e = estimer(fiche, grille);
    expect(e.prixCalcule).toBe(900);
    expect(e.optionsNonChiffrees).toEqual(["penderie_double"]);
  });

  it("est déterministe", () => {
    const fiche = FicheProjet.parse({
      famille: "placard",
      largeurM: 2.2,
      hauteurM: 2.4,
      profondeurM: 0.6,
      gamme: "premium",
      portes: "coulissant",
      tiroirs: 2,
    });
    expect(estimer(fiche, grille)).toEqual(estimer(fiche, grille));
  });
});

describe("fiche projet — validation", () => {
  it("refuse une valeur hors liste", () => {
    const r = FicheProjet.safeParse({
      famille: "dressing",
      largeurM: 2,
      hauteurM: 2.5,
      profondeurM: 0.6,
      gamme: "luxe",
      facade: "coulissant",
    });
    expect(r.success).toBe(false);
  });

  it("refuse une dimension absurde", () => {
    const r = FicheProjet.safeParse({
      famille: "fenetre",
      largeurM: 12,
      hauteurM: 1.4,
      materiau: "pvc",
      ouverture: "fixe",
    });
    expect(r.success).toBe(false);
  });

  it("applique les valeurs par défaut des champs optionnels", () => {
    const f = FicheProjet.parse({
      famille: "cuisine",
      longueurBasM: 3,
      implantation: "L",
      gamme: "confort",
      planTravail: "bois",
    });
    expect(f.quantite).toBe(1);
    expect(f.famille === "cuisine" && f.longueurHautM).toBe(0);
    expect(f.defautsAppliques).toEqual([]);
  });
});

describe("grille — lecture du Sheet", () => {
  it("refuse une option en double", () => {
    expect(() =>
      parseOptions([
        ["code", "libelle", "familles", "type", "montant"],
        ["tiroir", "Tiroir", "dressing", "par_unite", 90],
        ["tiroir", "Tiroir bis", "dressing", "par_unite", 95],
      ]),
    ).toThrow(GrilleInvalide);
  });

  it("refuse une règle manquante", () => {
    expect(() => parseRegles([["cle", "valeur"], ["fourchette_basse", 0.85]])).toThrow(GrilleInvalide);
  });

  it("accepte les nombres écrits à la française", () => {
    const opts = parseOptions([
      ["code", "libelle", "familles", "type", "montant"],
      ["led", "LED", "dressing", "par_ml", "1 250,5"],
    ]);
    expect(opts[0].montant).toBe(1250.5);
  });
});
