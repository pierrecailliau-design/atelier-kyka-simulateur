/**
 * Moteur de prix déterministe.
 * Entrée : une fiche projet validée + la grille. Sortie : le détail du calcul et la fourchette.
 * Aucune IA ici : deux fiches identiques donnent toujours le même résultat.
 *
 * Ordre du calcul, par exemplaire :
 *   1. base            = unité d'œuvre × tarif de la gamme
 *   2. options fixes   = par_ml / par_unite / par_porte / par_vantail
 *   3. sous-total      = base + options fixes
 *   4. pourcentages    = options en % du sous-total + majoration hauteur
 *   5. prix exemplaire = sous-total + pourcentages
 * puis × quantité, minimum de commande, fourchette arrondie à la dizaine.
 */
import type { FicheProjet } from "../fiche/schema";
import type { Gamme, Grille, OptionTarif, TarifBase } from "../grille/types";

export interface LigneEstimation {
  code: string;
  libelle: string;
  /** Lecture humaine du calcul, ex. « 2,4 ml × 700 € ». Usage interne (HubSpot, tests) : expose le tarif unitaire. */
  detail: string;
  /** Quantité seule, sans prix, ex. « 2,4 ml », « 4 unités », « +15 % » : c'est ce que voit le client. */
  quantite: string;
  montant: number;
}

export interface Estimation {
  famille: FicheProjet["famille"];
  base: LigneEstimation;
  optionsFixes: LigneEstimation[];
  sousTotal: number;
  pourcentages: LigneEstimation[];
  prixExemplaire: number;
  quantite: number;
  prixAvantMinimum: number;
  minimumApplique: boolean;
  /** Prix central, arrondi à l'euro. */
  prixCalcule: number;
  fourchette: { basse: number; haute: number };
  /** Options demandées dans la fiche mais absentes de la grille : à chiffrer par l'équipe. */
  optionsNonChiffrees: string[];
  grilleVersion: string;
  regles: { tvaIncluse: boolean; poseIncluse: boolean; validiteJours: number };
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const euros = (n: number) => `${fmt(n)} €`;

/** Contexte de calcul d'une option : quelles quantités multiplier selon son type. */
interface ContexteOption {
  ml: number;
  unites?: number;
  portes?: number;
  vantaux?: number;
}

class Calcul {
  optionsFixes: LigneEstimation[] = [];
  pourcentages: LigneEstimation[] = [];
  nonChiffrees: string[] = [];

  constructor(
    private grille: Grille,
    private famille: string,
  ) {}

  tarif(famille: TarifBase["famille"]): TarifBase {
    const t = this.grille.tarifs.find((x) => x.famille === famille);
    if (!t) throw new Error(`Tarif de base absent pour ${famille}`);
    return t;
  }

  private trouver(code: string): OptionTarif | undefined {
    const opt = this.grille.options.find((o) => o.code === code);
    if (!opt || !opt.familles.includes(this.famille)) {
      this.nonChiffrees.push(code);
      return undefined;
    }
    return opt;
  }

  /** Ajoute une option fixe si elle existe dans la grille pour cette famille. */
  fixe(code: string, ctx: ContexteOption) {
    const opt = this.trouver(code);
    if (!opt) return;
    let qte: number;
    let unite: string;
    switch (opt.type) {
      case "par_ml":
        qte = ctx.ml;
        unite = "ml";
        break;
      case "par_unite":
        qte = ctx.unites ?? 1;
        unite = qte > 1 ? "unités" : "unité";
        break;
      case "par_porte":
        qte = ctx.portes ?? 0;
        unite = qte > 1 ? "portes" : "porte";
        break;
      case "par_vantail":
        qte = ctx.vantaux ?? 0;
        unite = qte > 1 ? "vantaux" : "vantail";
        break;
      case "pourcentage":
        // Une option en % se range avec les pourcentages, quel que soit l'appel.
        this.pct(code);
        return;
    }
    if (qte <= 0) return;
    this.optionsFixes.push({
      code,
      libelle: opt.libelle,
      detail: `${fmt(qte)} ${unite} × ${euros(opt.montant)}`,
      quantite: `${fmt(qte)} ${unite}`,
      montant: arrondi(qte * opt.montant),
    });
  }

  /** Enregistre une option en pourcentage ; le montant est calculé une fois le sous-total connu. */
  pct(code: string) {
    const opt = this.trouver(code);
    if (!opt) return;
    this.pourcentages.push({ code, libelle: opt.libelle, detail: `+${fmt(opt.montant)} %`, quantite: "", montant: opt.montant });
  }

  /** Majoration conditionnelle de hauteur (règle, pas option). */
  majorationHauteur(hauteurM: number) {
    const r = this.grille.regles;
    if (hauteurM > r.hauteurMajorationSeuilM && r.hauteurMajorationPct > 0) {
      this.pourcentages.push({
        code: "hauteur",
        libelle: `Hauteur supérieure à ${fmt(r.hauteurMajorationSeuilM)} m`,
        detail: `+${fmt(r.hauteurMajorationPct)} %`,
        quantite: "",
        montant: r.hauteurMajorationPct,
      });
    }
  }
}

const arrondi = (n: number) => Math.round(n * 100) / 100;
const dizaine = (n: number) => Math.round(n / 10) * 10;

function baseLigne(t: TarifBase, gamme: Gamme, quantiteUnite: number, libelle?: string): LigneEstimation {
  const q = Math.max(quantiteUnite, t.minimumUnite);
  const prixUnite = t.prix[gamme];
  const unite = t.unite === "m2" ? "m²" : "ml";
  const minimum = q > quantiteUnite ? ` (minimum ${fmt(t.minimumUnite)} ${unite})` : "";
  return {
    code: t.famille,
    libelle: libelle ?? t.libelle,
    detail: `${fmt(q)} ${unite}${minimum} × ${euros(prixUnite)}`,
    quantite: `${fmt(q)} ${unite}${minimum}`,
    montant: arrondi(q * prixUnite),
  };
}

const MATERIAU_VERS_GAMME: Record<"pvc" | "aluminium" | "bois", Gamme> = {
  pvc: "essentiel",
  aluminium: "confort",
  bois: "premium",
};
const LIBELLE_MATERIAU = { pvc: "PVC", aluminium: "aluminium", bois: "bois" } as const;

export function estimer(fiche: FicheProjet, grille: Grille): Estimation {
  const c = new Calcul(grille, fiche.famille);
  let base: LigneEstimation;

  switch (fiche.famille) {
    case "dressing": {
      const t = c.tarif("dressing");
      base = baseLigne(t, fiche.gamme, fiche.largeurM);
      const ml = Math.max(fiche.largeurM, t.minimumUnite);
      if (fiche.facade === "coulissant") c.fixe("portes_coulissantes", { ml });
      if (fiche.facade === "battant") c.fixe("portes_battantes", { ml });
      if (fiche.tiroirs > 0) c.fixe("tiroir", { ml, unites: fiche.tiroirs });
      if (fiche.eclairageLed) c.fixe("eclairage_led", { ml });
      if (fiche.miroirPortes > 0) c.fixe("miroir", { ml, portes: fiche.miroirPortes });
      if (fiche.penderieDouble) c.fixe("penderie_double", { ml });
      c.majorationHauteur(fiche.hauteurM);
      break;
    }
    case "placard": {
      const t = c.tarif("placard");
      base = baseLigne(t, fiche.gamme, fiche.largeurM);
      const ml = Math.max(fiche.largeurM, t.minimumUnite);
      if (fiche.portes === "coulissant") c.fixe("portes_coulissantes", { ml });
      if (fiche.portes === "pliant") c.fixe("portes_pliantes", { ml });
      // Portes battantes : comprises dans le tarif de base du placard.
      if (fiche.tiroirs > 0) c.fixe("tiroir", { ml, unites: fiche.tiroirs });
      if (fiche.etageresSupplementaires > 0) c.fixe("etagere_supplementaire", { ml, unites: fiche.etageresSupplementaires });
      if (fiche.penderie) c.fixe("penderie", { ml });
      if (fiche.configuration !== "standard") c.pct("sous_pente");
      c.majorationHauteur(fiche.hauteurM);
      break;
    }
    case "cuisine": {
      const tBas = c.tarif("cuisine_bas");
      const tHaut = c.tarif("cuisine_haut");
      base = baseLigne(tBas, fiche.gamme, fiche.longueurBasM);
      const mlBas = Math.max(fiche.longueurBasM, tBas.minimumUnite);
      if (fiche.longueurHautM > 0) {
        const haut = baseLigne(tHaut, fiche.gamme, fiche.longueurHautM);
        c.optionsFixes.push(haut);
      }
      c.fixe(`plan_${fiche.planTravail}`, { ml: mlBas });
      if (fiche.implantation === "ilot") c.fixe("ilot", { ml: mlBas, unites: 1 });
      if (fiche.colonnes > 0) c.fixe("colonne", { ml: mlBas, unites: fiche.colonnes });
      if (fiche.tiroirs > 0) c.fixe("tiroir", { ml: mlBas, unites: fiche.tiroirs });
      break;
    }
    case "fenetre": {
      const t = c.tarif("fenetre");
      const surface = arrondi(fiche.largeurM * fiche.hauteurM);
      base = baseLigne(t, MATERIAU_VERS_GAMME[fiche.materiau], surface, `Fenêtre ${LIBELLE_MATERIAU[fiche.materiau]}`);
      const ctx = { ml: surface, vantaux: fiche.vantaux, unites: 1 };
      if (fiche.ouverture === "oscillo_battant") c.fixe("oscillo_battant", ctx);
      if (fiche.ouverture === "coulissant") c.pct("coulissant_fenetre");
      if (fiche.vitrage === "triple") c.pct("triple_vitrage");
      if (fiche.couleurHorsBlanc) c.pct("couleur_hors_blanc");
      if (fiche.depose) c.fixe("depose", ctx);
      if (fiche.voletRoulant) c.fixe("volet_roulant", ctx);
      break;
    }
  }

  const sousTotal = arrondi(base.montant + c.optionsFixes.reduce((s, l) => s + l.montant, 0));
  const pourcentages = c.pourcentages.map((p) => ({
    ...p,
    detail: `${p.detail} de ${euros(sousTotal)}`,
    montant: arrondi((sousTotal * p.montant) / 100),
  }));
  const prixExemplaire = arrondi(sousTotal + pourcentages.reduce((s, l) => s + l.montant, 0));
  const quantite = fiche.quantite;
  const prixAvantMinimum = arrondi(prixExemplaire * quantite);
  const minimumApplique = prixAvantMinimum < grille.regles.minimumCommande;
  const prixCalcule = Math.round(minimumApplique ? grille.regles.minimumCommande : prixAvantMinimum);

  return {
    famille: fiche.famille,
    base,
    optionsFixes: c.optionsFixes,
    sousTotal,
    pourcentages,
    prixExemplaire,
    quantite,
    prixAvantMinimum,
    minimumApplique,
    prixCalcule,
    fourchette: {
      basse: dizaine(prixCalcule * grille.regles.fourchetteBasse),
      haute: dizaine(prixCalcule * grille.regles.fourchetteHaute),
    },
    optionsNonChiffrees: c.nonChiffrees,
    grilleVersion: grille.version,
    regles: {
      tvaIncluse: grille.regles.tvaIncluse,
      poseIncluse: grille.regles.poseIncluse,
      validiteJours: grille.regles.validiteJours,
    },
  };
}
