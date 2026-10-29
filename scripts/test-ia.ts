/**
 * Test de lecture IA : 30 phrases de clients réalistes → fiche ou questions, comparées à l'attendu.
 *
 *   npm run test:ia            # avec ANTHROPIC_API_KEY dans .env.local → Claude ; sinon mode heuristique
 *   npm run test:ia -- --heuristique   # force le mode sans IA pour comparer
 *
 * Imprime un tableau et un score, et écrit scripts/resultats-ia.md (à coller dans la conversation pour analyse).
 * Critère de réussite retenu au cadrage : 25 phrases sur 30 justes, sans question inutile.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Famille } from "../src/lib/fiche/schema";
import { extraireHeuristique } from "../src/lib/ia/fallback";
import type { ReponseIA } from "../src/lib/ia/types";

// .env.local → process.env (sans dépendance)
try {
  for (const ligne of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* pas de .env.local : mode heuristique ou variables déjà posées */
}

type Attendu = {
  /** « fiche » : tout est là ; « questions » : il manque quelque chose et l'IA doit demander ; « hors_sujet » */
  statut: ReponseIA["statut"];
  famille?: Famille;
  /** champs dont on vérifie la valeur (nombres à ±0,02 m près) */
  champs?: Record<string, unknown>;
  /** champs qui doivent faire l'objet d'une question (statut questions) */
  questions?: string[];
};

const CAS: { phrase: string; attendu: Attendu }[] = [
  // --- dressing : phrases complètes
  { phrase: "Un dressing de 2,40 m sur 2,50 m de haut avec portes coulissantes en chêne et 4 tiroirs", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 2.4, hauteurM: 2.5, facade: "coulissant", gamme: "premium", tiroirs: 4 } } },
  { phrase: "je voudrais un dressing 3m de large, 2m60 de haut, 60 de profondeur, portes battantes laquées blanches, avec de la led", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 3, hauteurM: 2.6, profondeurM: 0.6, facade: "battant", gamme: "confort", eclairageLed: true } } },
  { phrase: "Dressing ouvert sans portes, 180 cm de large et 240 de haut, le moins cher possible, 2 tiroirs", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 1.8, hauteurM: 2.4, facade: "ouvert", gamme: "essentiel", tiroirs: 2 } } },
  { phrase: "dressing 2 mètres quarante de large, deux mètres cinquante de haut, portes coulissantes dont une avec miroir, finition chêne", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 2.4, hauteurM: 2.5, facade: "coulissant", miroirPortes: 1, gamme: "premium" } } },
  { phrase: "Armoire penderie pour la chambre, 2m x 2m50, portes coulissantes, mdf laqué gris", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 2, hauteurM: 2.5, facade: "coulissant", gamme: "confort" } } },
  // --- dressing : incomplet → questions
  { phrase: "Un dressing avec portes coulissantes en chêne", attendu: { statut: "questions", famille: "dressing", questions: ["largeurM"] } },
  { phrase: "Je veux un dressing", attendu: { statut: "questions", famille: "dressing" } },
  { phrase: "dressing 2m40 de large", attendu: { statut: "questions", famille: "dressing", questions: ["hauteurM"] } },
  // --- placard
  { phrase: "Un placard sous escalier de 1,80 m avec portes battantes laquées", attendu: { statut: "questions", famille: "placard", champs: { largeurM: 1.8, configuration: "sous_escalier", portes: "battant", gamme: "confort" }, questions: ["hauteurM"] } },
  { phrase: "placard sous pente dans les combles, 2,10 m de long, 1,90 m au plus haut, portes coulissantes, mélaminé blanc", attendu: { statut: "fiche", famille: "placard", champs: { largeurM: 2.1, hauteurM: 1.9, configuration: "sous_pente", portes: "coulissant", gamme: "essentiel" } } },
  { phrase: "Placard d'entrée 120 cm sur 250 cm, 40 de profondeur, portes pliantes, en chêne", attendu: { statut: "fiche", famille: "placard", champs: { largeurM: 1.2, hauteurM: 2.5, profondeurM: 0.4, portes: "pliant", gamme: "premium" } } },
  { phrase: "un placard de 1m50 avec 3 tiroirs, portes battantes", attendu: { statut: "questions", famille: "placard", champs: { largeurM: 1.5, tiroirs: 3, portes: "battant" } } },
  { phrase: "Placard mural standard 2 m de large, 2,50 m de haut, laqué", attendu: { statut: "questions", famille: "placard", champs: { largeurM: 2, hauteurM: 2.5, gamme: "confort" }, questions: ["portes"] } },
  // --- cuisine
  { phrase: "Une cuisine en L, 3 m de meubles bas, 2 m de meubles hauts, plan de travail en quartz, finition laquée", attendu: { statut: "fiche", famille: "cuisine", champs: { implantation: "L", longueurBasM: 3, longueurHautM: 2, planTravail: "quartz", gamme: "confort" } } },
  { phrase: "cuisine linéaire de 4 mètres de meubles bas sans meubles hauts, plan stratifié, mélaminé, 2 colonnes", attendu: { statut: "fiche", famille: "cuisine", champs: { implantation: "lineaire", longueurBasM: 4, longueurHautM: 0, planTravail: "stratifie", gamme: "essentiel", colonnes: 2 } } },
  { phrase: "Cuisine avec îlot central, 3,5 m de bas, 2,5 m de hauts, plan en bois massif, façades chêne", attendu: { statut: "fiche", famille: "cuisine", champs: { implantation: "ilot", longueurBasM: 3.5, longueurHautM: 2.5, planTravail: "bois", gamme: "premium" } } },
  { phrase: "Je refais ma cuisine, elle fait environ 3 mètres", attendu: { statut: "questions", famille: "cuisine" } },
  { phrase: "cuisine en U 5m de bas 3m de hauts quartz", attendu: { statut: "questions", famille: "cuisine", champs: { implantation: "U", longueurBasM: 5, longueurHautM: 3, planTravail: "quartz" }, questions: ["gamme"] } },
  // --- fenêtre
  { phrase: "3 fenêtres PVC oscillo-battantes de 1,20 m sur 1,40 m, double vitrage", attendu: { statut: "fiche", famille: "fenetre", champs: { quantite: 3, materiau: "pvc", ouverture: "oscillo_battant", largeurM: 1.2, hauteurM: 1.4, vitrage: "double" } } },
  { phrase: "une fenêtre alu gris anthracite coulissante 2m x 2m10 triple vitrage", attendu: { statut: "fiche", famille: "fenetre", champs: { materiau: "aluminium", couleurHorsBlanc: true, ouverture: "coulissant", largeurM: 2, hauteurM: 2.1, vitrage: "triple" } } },
  { phrase: "Remplacer 5 vieilles fenêtres bois par des fenêtres bois à deux vantaux, 100 cm de large, 130 de haut, avec volets roulants", attendu: { statut: "questions", famille: "fenetre", champs: { quantite: 5, materiau: "bois", vantaux: 2, largeurM: 1, hauteurM: 1.3, voletRoulant: true, depose: true }, questions: ["ouverture"] } },
  { phrase: "fenêtre fixe 80 x 60 pvc blanc", attendu: { statut: "fiche", famille: "fenetre", champs: { ouverture: "fixe", largeurM: 0.8, hauteurM: 0.6, materiau: "pvc" } } },
  { phrase: "Je voudrais changer mes fenêtres", attendu: { statut: "questions", famille: "fenetre" } },
  { phrase: "2 fenetres de 120 par 140", attendu: { statut: "questions", famille: "fenetre", champs: { quantite: 2, largeurM: 1.2, hauteurM: 1.4 } } },
  // --- fautes, mélanges, portugais
  { phrase: "dressin 2m40 de larje 2m50 de hau porte coulisante chene 4 tiroir", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 2.4, hauteurM: 2.5, facade: "coulissant", gamme: "premium", tiroirs: 4 } } },
  { phrase: "um roupeiro de 2,40 m por 2,50 m com portas de correr em carvalho", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 2.4, hauteurM: 2.5, facade: "coulissant", gamme: "premium" } } },
  { phrase: "J'ai un mur de 3,20 m dans la chambre, du sol au plafond (2,55 m), je veux tout fermer avec des portes coulissantes et un miroir sur une porte, budget serré", attendu: { statut: "fiche", famille: "dressing", champs: { largeurM: 3.2, hauteurM: 2.55, facade: "coulissant", miroirPortes: 1, gamme: "essentiel" } } },
  // --- hors sujet
  { phrase: "Pouvez-vous refaire ma salle de bain complète avec carrelage et plomberie ?", attendu: { statut: "hors_sujet" } },
  { phrase: "Combien coûte une table en chêne de 2 m ?", attendu: { statut: "hors_sujet" } },
  { phrase: "Bonjour, vous êtes ouverts le samedi ?", attendu: { statut: "hors_sujet" } },
];

const proche = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 0.021 : a === b);

function evaluer(r: ReponseIA, a: Attendu): { ok: boolean; ecarts: string[] } {
  const ecarts: string[] = [];
  if (r.statut !== a.statut) ecarts.push(`statut ${r.statut} ≠ ${a.statut}`);
  const famille = r.statut === "fiche" ? r.fiche.famille : r.statut === "questions" ? r.famille : undefined;
  if (a.famille && famille !== a.famille) ecarts.push(`famille ${famille ?? "?"} ≠ ${a.famille}`);
  const valeurs: Record<string, unknown> = r.statut === "fiche" ? (r.fiche as unknown as Record<string, unknown>) : r.statut === "questions" ? ((r.ficheProvisoire ?? {}) as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(a.champs ?? {})) {
    if (!proche(valeurs[k], v)) ecarts.push(`${k}=${JSON.stringify(valeurs[k])} ≠ ${JSON.stringify(v)}`);
  }
  if (r.statut === "questions") {
    const posees = r.questions.map((q) => q.champ);
    for (const q of a.questions ?? []) if (!posees.includes(q)) ecarts.push(`question manquante : ${q}`);
    if (r.questions.length > 3) ecarts.push(`${r.questions.length} questions (max 3)`);
    // question inutile : un champ déjà donné dans la phrase
    for (const q of posees) if (a.champs && q in a.champs) ecarts.push(`question inutile : ${q}`);
  }
  return { ok: ecarts.length === 0, ecarts };
}

function resume(r: ReponseIA): string {
  if (r.statut === "hors_sujet") return "hors sujet";
  if (r.statut === "fiche") {
    const f = r.fiche as unknown as Record<string, unknown>;
    return Object.entries(f)
      .filter(([k, v]) => !["commentaire", "defautsAppliques"].includes(k) && v !== undefined && v !== false)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
  }
  return `${r.famille ?? "?"} · questions : ${r.questions.map((q) => q.champ).join(", ") || "aucune"}`;
}

async function main() {
  const forcerHeuristique = process.argv.includes("--heuristique");
  const avecIA = !forcerHeuristique && Boolean(process.env.ANTHROPIC_API_KEY);
  const extraireFiche = avecIA ? (await import("../src/lib/ia/extraire")).extraireFiche : null;
  console.log(`Mode : ${avecIA ? `IA (${process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5"})` : "heuristique (pas de clé)"} · ${CAS.length} phrases\n`);

  const lignes: string[] = ["| # | Phrase | Résultat | Verdict |", "|---|---|---|---|"];
  let score = 0;
  for (const [i, cas] of CAS.entries()) {
    let r: ReponseIA;
    try {
      r = extraireFiche ? await extraireFiche([{ role: "user", content: cas.phrase }]) : extraireHeuristique(cas.phrase);
    } catch (e) {
      r = { statut: "hors_sujet", message: `ERREUR ${e instanceof Error ? e.message : e}` };
    }
    const { ok, ecarts } = evaluer(r, cas.attendu);
    if (ok) score++;
    const verdict = ok ? "✅" : `❌ ${ecarts.join(" ; ")}`;
    console.log(`${String(i + 1).padStart(2)} ${ok ? "✅" : "❌"} ${cas.phrase.slice(0, 70)}${cas.phrase.length > 70 ? "…" : ""}`);
    if (!ok) console.log(`      → ${resume(r)}\n      ${ecarts.join(" ; ")}`);
    lignes.push(`| ${i + 1} | ${cas.phrase.replace(/\|/g, "/")} | ${resume(r).replace(/\|/g, "/")} | ${verdict.replace(/\|/g, "/")} |`);
  }
  const bilan = `Score : ${score}/${CAS.length} (objectif 25/30) · mode ${avecIA ? "IA" : "heuristique"} · ${new Date().toISOString().slice(0, 16)}`;
  console.log(`\n${bilan}`);
  writeFileSync(resolve(process.cwd(), "scripts/resultats-ia.md"), `# Test de lecture IA\n\n${bilan}\n\n${lignes.join("\n")}\n`);
  console.log("Détail écrit dans scripts/resultats-ia.md");
}

main();
