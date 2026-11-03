import { describe, expect, it } from "vitest";
import { FicheProjet } from "../fiche/schema";
import { extraireHeuristique, modifierHeuristique } from "./fallback";

const dressing = FicheProjet.parse({ famille: "dressing", largeurM: 2.4, hauteurM: 2.5, profondeurM: 0.6, gamme: "confort", facade: "coulissant", tiroirs: 4, finition: "sauge" });
const fenetre = FicheProjet.parse({ famille: "fenetre", largeurM: 1.2, hauteurM: 1.4, materiau: "pvc", ouverture: "oscillo_battant", quantite: 3 });

const fiche = (r: ReturnType<typeof modifierHeuristique>) => {
  if (r.statut !== "fiche") throw new Error(`statut ${r.statut} : ${r.message}`);
  return r.fiche as unknown as Record<string, unknown>;
};

describe("modification par écrit depuis la 3D (mode sans IA)", () => {
  it("« ajoute 2 tiroirs » s'ajoute aux tiroirs existants et ne touche à rien d'autre", () => {
    const f = fiche(modifierHeuristique(dressing, "ajoute 2 tiroirs"));
    expect(f.tiroirs).toBe(6);
    expect(f.largeurM).toBe(2.4);
    expect(f.finition).toBe("sauge");
    expect(f.facade).toBe("coulissant");
  });

  it("« passe en chêne » change la gamme et la finition, garde les dimensions", () => {
    const f = fiche(modifierHeuristique(dressing, "passe le tout en chêne"));
    expect(f.gamme).toBe("premium");
    expect(f.finition).toBe("chene_naturel");
    expect(f.hauteurM).toBe(2.5);
  });

  it("« enlève les portes » ouvre le dressing ; « plus large » ajoute 20 cm", () => {
    expect(fiche(modifierHeuristique(dressing, "enlève les portes")).facade).toBe("ouvert");
    expect(fiche(modifierHeuristique(dressing, "un peu plus large")).largeurM).toBe(2.6);
    expect(fiche(modifierHeuristique(dressing, "plus bas")).hauteurM).toBe(2.3);
  });

  it("fenêtre : « en anthracite » pose la teinte et la couleur hors blanc sans toucher au reste", () => {
    const f = fiche(modifierHeuristique(fenetre, "plutôt en anthracite"));
    expect(f.teinte).toBe("anthracite");
    expect(f.couleurHorsBlanc).toBe(true);
    expect(f.quantite).toBe(3);
    expect(f.ouverture).toBe("oscillo_battant");
    // une demande sans couleur ne remet pas la teinte à blanc
    const g = fiche(modifierHeuristique(FicheProjet.parse({ ...fenetre, teinte: "anthracite", couleurHorsBlanc: true }), "triple vitrage"));
    expect(g.teinte).toBe("anthracite");
    expect(g.vitrage).toBe("triple");
  });

  it("une demande incompréhensible renvoie une question avec la fiche actuelle, jamais une fiche vide", () => {
    const r = modifierHeuristique(dressing, "bonjour merci");
    expect(r.statut).toBe("questions");
    expect(r.statut === "questions" && r.ficheProvisoire?.largeurM).toBe(2.4);
  });

  it("la lecture initiale reste inchangée", () => {
    const r = extraireHeuristique("Un placard sous escalier de 1,80 m avec portes battantes laquées");
    expect(r.statut).toBe("questions");
    expect(r.statut === "questions" && r.ficheProvisoire?.configuration).toBe("sous_escalier");
  });
});
