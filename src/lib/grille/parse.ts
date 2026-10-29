import {
  FAMILLES_TARIF,
  GAMMES,
  OPTION_TYPES,
  type FamilleTarif,
  type Grille,
  type OptionTarif,
  type OptionType,
  type Regles,
  type TarifBase,
} from "./types";

/** Une feuille telle que la renvoie l'API Sheets : première ligne = en-têtes. */
export type Feuille = (string | number | boolean | null)[][];

export class GrilleInvalide extends Error {
  constructor(message: string) {
    super(`Grille de prix invalide : ${message}`);
    this.name = "GrilleInvalide";
  }
}

function enObjets(feuille: Feuille): Record<string, string>[] {
  if (feuille.length < 2) return [];
  const entetes = feuille[0].map((h) => String(h ?? "").trim().toLowerCase());
  return feuille
    .slice(1)
    .filter((ligne) => ligne.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))
    .map((ligne) => {
      const obj: Record<string, string> = {};
      entetes.forEach((h, i) => {
        obj[h] = String(ligne[i] ?? "").trim();
      });
      return obj;
    })
    .filter((obj) => obj[entetes[0]] !== "");
}

function nombre(valeur: string, contexte: string): number {
  const n = Number(String(valeur).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new GrilleInvalide(`${contexte} : « ${valeur} » n'est pas un nombre`);
  return n;
}

function booleen(valeur: string): boolean {
  return ["oui", "true", "1", "yes", "vrai"].includes(valeur.toLowerCase());
}

export function parseTarifs(feuille: Feuille): TarifBase[] {
  return enObjets(feuille).map((r) => {
    const famille = r.famille as FamilleTarif;
    if (!FAMILLES_TARIF.includes(famille)) {
      throw new GrilleInvalide(`famille inconnue dans Tarifs de base : « ${r.famille} »`);
    }
    const unite = r.unite === "m2" ? "m2" : "ml";
    const prix = Object.fromEntries(
      GAMMES.map((g) => [g, nombre(r[g], `Tarifs de base / ${famille} / ${g}`)]),
    ) as TarifBase["prix"];
    return {
      famille,
      libelle: r.libelle || famille,
      unite,
      prix,
      minimumUnite: r.minimum_unite ? nombre(r.minimum_unite, `Tarifs de base / ${famille} / minimum_unite`) : 0,
    };
  });
}

export function parseOptions(feuille: Feuille): OptionTarif[] {
  const vus = new Set<string>();
  return enObjets(feuille).map((r) => {
    const code = r.code.toLowerCase();
    if (vus.has(code)) throw new GrilleInvalide(`option en double : « ${code} »`);
    vus.add(code);
    const type = r.type as OptionType;
    if (!OPTION_TYPES.includes(type)) {
      throw new GrilleInvalide(`type inconnu pour l'option « ${code} » : « ${r.type} »`);
    }
    return {
      code,
      libelle: r.libelle || code,
      familles: r.familles
        .split(",")
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean),
      type,
      montant: nombre(r.montant, `Options / ${code} / montant`),
    };
  });
}

export function parseRegles(feuille: Feuille): Regles {
  const map = new Map(enObjets(feuille).map((r) => [r.cle.toLowerCase(), r.valeur]));
  const lire = (cle: string) => {
    const v = map.get(cle);
    if (v === undefined || v === "") throw new GrilleInvalide(`règle manquante : « ${cle} »`);
    return v;
  };
  return {
    fourchetteBasse: nombre(lire("fourchette_basse"), "Règles / fourchette_basse"),
    fourchetteHaute: nombre(lire("fourchette_haute"), "Règles / fourchette_haute"),
    minimumCommande: nombre(lire("minimum_commande"), "Règles / minimum_commande"),
    hauteurMajorationSeuilM: nombre(lire("hauteur_majoration_seuil_m"), "Règles / hauteur_majoration_seuil_m"),
    hauteurMajorationPct: nombre(lire("hauteur_majoration_pct"), "Règles / hauteur_majoration_pct"),
    tvaIncluse: booleen(lire("tva_incluse")),
    poseIncluse: booleen(lire("pose_incluse")),
    validiteJours: nombre(lire("validite_jours"), "Règles / validite_jours"),
  };
}

export function parseGrille(
  feuilles: { tarifs: Feuille; options: Feuille; regles: Feuille },
  version: string,
): Grille {
  const grille: Grille = {
    tarifs: parseTarifs(feuilles.tarifs),
    options: parseOptions(feuilles.options),
    regles: parseRegles(feuilles.regles),
    version,
  };
  for (const f of FAMILLES_TARIF) {
    if (!grille.tarifs.some((t) => t.famille === f)) {
      throw new GrilleInvalide(`tarif de base manquant pour « ${f} »`);
    }
  }
  return grille;
}
