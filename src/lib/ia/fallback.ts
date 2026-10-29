/**
 * Mode sans IA : lecture heuristique du texte du client (mots-clés et dimensions).
 * Sert quand ANTHROPIC_API_KEY est absente (tests, local) ou si l'API est en panne.
 * Volontairement simple : tout ce qui n'est pas reconnu devient une question.
 */
import type { Famille } from "../fiche/schema";
import { valider } from "./extraire";
import type { ReponseIA } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function detecterFamille(t: string): Famille | undefined {
  if (/fenetre|baie vitree|chassis|velux/.test(t)) return "fenetre";
  if (/cuisine/.test(t)) return "cuisine";
  if (/placard/.test(t)) return "placard";
  if (/dressing|armoire|penderie|rangement/.test(t)) return "dressing";
  return undefined;
}

/** Un nombre converti en mètres : 240 (sans unité) → 2,40 ; 2,4 → 2,4. */
const enMetres = (brut: string, unite?: string) => {
  const n = Number(brut.replace(",", "."));
  if (unite === "cm" || (!unite && n > 10)) return n / 100;
  if (unite === "mm") return n / 1000;
  return n;
};

/**
 * Extrait les longueurs du texte, converties en mètres, dans l'ordre où elles apparaissent,
 * plus celles qui sont nommées (« 40 de profondeur », « 130 de haut »).
 */
function dimensions(t: string): { ordre: number[]; nommees: Partial<Record<"largeur" | "hauteur" | "profondeur", number>> } {
  const trouvees: { index: number; valeur: number }[] = [];
  const pris = new Set<number>();
  const ajouter = (index: number, valeur: number) => {
    if (pris.has(index)) return;
    pris.add(index);
    trouvees.push({ index, valeur });
  };
  // 2m40, 2 m 40
  for (const m of t.matchAll(/(\d+)\s*m\s*(\d{1,2})(?!\d)/g)) ajouter(m.index, Number(m[1]) + Number(m[2]) / (m[2].length === 1 ? 10 : 100));
  // 2,40 m / 240 cm / 2.4 metres
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m|metres?)(?![a-z])/g)) ajouter(m.index, enMetres(m[1], m[2].startsWith("m") && m[2] !== "mm" ? "m" : m[2]));
  // 2,40 x 2,50 / 120 par 140 (sans unité)
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:x|×|\*|par|sur)\s*(\d+(?:[.,]\d+)?)/g)) {
    ajouter(m.index, enMetres(m[1]));
    ajouter(m.index + m[0].length - m[2].length, enMetres(m[2]));
  }
  // dimensions nommées : « 40 de profondeur », « 130 de haut », « 2m de large »
  const nommees: Partial<Record<"largeur" | "hauteur" | "profondeur", number>> = {};
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*(?:\d{1,2}\s*)?de\s+(large|largeur|long|longueur|haut|hauteur|profondeur|prof)\b/g)) {
    const precedent = trouvees.find((d) => d.index === m.index);
    const valeur = precedent ? precedent.valeur : enMetres(m[1], m[2]);
    const cle = /larg|long/.test(m[3]) ? "largeur" : /haut/.test(m[3]) ? "hauteur" : "profondeur";
    nommees[cle] = valeur;
    if (!precedent) ajouter(m.index, valeur);
  }
  const ordre = trouvees
    .sort((a, b) => a.index - b.index)
    .map((d) => d.valeur)
    .filter((n) => n > 0.2 && n < 20);
  return { ordre, nommees };
}

function gamme(t: string): string | undefined {
  if (/chene|noyer|massif|placage|premium|haut de gamme/.test(t)) return "premium";
  if (/laque|mat\b|couleur|confort|mdf/.test(t)) return "confort";
  if (/melamine|essentiel|basique|economique|pas cher|moins cher|budget|premier prix/.test(t)) return "essentiel";
  return undefined;
}

export function extraireHeuristique(texte: string, familleChoisie?: Famille): ReponseIA {
  const t = norm(texte);
  const famille = familleChoisie ?? detecterFamille(t);
  const { ordre, nommees } = dimensions(t);
  // Les dimensions nommées priment ; les autres se lisent dans l'ordre largeur, hauteur, profondeur.
  const restantes = ordre.filter((v) => !Object.values(nommees).includes(v));
  const dims = [nommees.largeur ?? restantes.shift(), nommees.hauteur ?? restantes.shift(), nommees.profondeur ?? restantes.shift()];
  const brut: Record<string, unknown> = { famille, commentaire: texte.slice(0, 2000) };
  const g = gamme(t);
  if (g) brut.gamme = g;
  const tiroirs = t.match(/(\d+)\s*tiroirs?/);
  if (tiroirs) brut.tiroirs = Number(tiroirs[1]);
  const quantite = t.match(/(\d+)\s*(?:[a-z]+\s+)?(fenetres?|portes-fenetres?|exemplaires|pieces)/);

  switch (famille) {
    case "dressing":
    case "placard": {
      if (dims[0]) brut.largeurM = dims[0];
      if (dims[1]) brut.hauteurM = dims[1];
      if (dims[2]) brut.profondeurM = dims[2];
      else if (dims[0]) {
        brut.profondeurM = 0.6;
        brut.defautsAppliques = ["profondeurM"];
      }
      const porte = /coulissant/.test(t) ? "coulissant" : /pliant/.test(t) ? "pliant" : /battant/.test(t) ? "battant" : /sans porte|ouvert/.test(t) ? "ouvert" : undefined;
      if (famille === "dressing") {
        if (porte === "pliant") brut.facade = "battant";
        else if (porte) brut.facade = porte;
        if (/led|eclairage|lumiere/.test(t)) brut.eclairageLed = true;
        if (/miroir/.test(t)) brut.miroirPortes = 1;
      } else {
        if (porte && porte !== "ouvert") brut.portes = porte;
        if (/sous.?pente|combles|mansard/.test(t)) brut.configuration = "sous_pente";
        else if (/sous.?escalier/.test(t)) brut.configuration = "sous_escalier";
      }
      break;
    }
    case "cuisine": {
      if (dims[0]) brut.longueurBasM = dims[0];
      if (dims[1] !== undefined) brut.longueurHautM = dims[1];
      if (/sans (meubles? )?hauts?/.test(t)) brut.longueurHautM = 0;
      brut.implantation = /ilot/.test(t) ? "ilot" : /en u\b/.test(t) ? "U" : /en l\b/.test(t) ? "L" : /lineaire|en ligne|en longueur/.test(t) ? "lineaire" : undefined;
      brut.planTravail = /quartz|pierre|granit/.test(t) ? "quartz" : /bois|chene/.test(t) ? "bois" : /stratifie/.test(t) ? "stratifie" : undefined;
      const colonnes = t.match(/(\d+)\s*colonnes?/);
      if (colonnes) brut.colonnes = Number(colonnes[1]);
      if (brut.implantation === undefined) delete brut.implantation;
      if (brut.planTravail === undefined) delete brut.planTravail;
      break;
    }
    case "fenetre": {
      if (dims[0]) brut.largeurM = dims[0];
      if (dims[1]) brut.hauteurM = dims[1];
      brut.materiau = /\bpvc\b/.test(t) ? "pvc" : /alu/.test(t) ? "aluminium" : /bois|chene/.test(t) ? "bois" : undefined;
      brut.ouverture = /oscillo/.test(t) ? "oscillo_battant" : /coulissant/.test(t) ? "coulissant" : /fixe/.test(t) ? "fixe" : /battant/.test(t) ? "battant" : undefined;
      if (/triple/.test(t)) brut.vitrage = "triple";
      if (/deux vantaux|2 vantaux|double vantail/.test(t)) brut.vantaux = 2;
      else if (/un vantail|1 vantail/.test(t)) brut.vantaux = 1;
      if (/volet/.test(t)) brut.voletRoulant = true;
      if (/depose|remplac|changer|anciennes?/.test(t)) brut.depose = true;
      if (/couleur|gris|anthracite|noir/.test(t)) brut.couleurHorsBlanc = true;
      if (quantite) brut.quantite = Number(quantite[1]);
      if (brut.materiau === undefined) delete brut.materiau;
      if (brut.ouverture === undefined) delete brut.ouverture;
      break;
    }
    default:
      break;
  }
  if (quantite && famille !== "fenetre") brut.quantite = Number(quantite[1]);

  const resultat = valider(brut, famille ? "Voici ce que j'ai compris. Il me manque quelques précisions." : "Je n'ai pas reconnu le type de projet.");
  if (resultat.statut === "fiche") resultat.message = "Voici votre projet. Ajustez-le à votre goût.";
  return resultat;
}
