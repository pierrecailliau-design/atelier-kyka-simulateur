/**
 * Écran 2 : l'IA transforme le texte du client en fiche projet, ou pose les questions manquantes.
 * Elle ne calcule jamais de prix : sa sortie est contrainte au schéma de la fiche (outil structuré),
 * puis revalidée par zod. Une valeur hors liste est transformée en question.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEFAUTS, FicheProjet, type Famille } from "../fiche/schema";
import type { Question, ReponseIA, Tour } from "./types";
import { LIBELLE_QUESTION, OPTIONS_CHAMP } from "../fiche/libelles";

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const SYSTEME = `Tu es l'assistant du simulateur d'Atelier Kyka, menuiserie sur mesure à Porto. Tu parles à un particulier, en français, simplement et chaleureusement, sans jargon.

Ta seule mission : transformer ce que le client décrit en une fiche projet structurée, pour l'une des quatre familles : dressing, placard, cuisine, fenêtre. Tu ne donnes JAMAIS de prix, d'ordre de grandeur ni de délai : le prix est calculé ensuite par un moteur à partir de la fiche.

Règles :
- N'invente aucune dimension. Si une dimension manque, pose la question. Si le client dit qu'il ne sait pas, applique la valeur standard et note le champ dans defautsAppliques.
- Pose au maximum trois questions par tour, les plus importantes d'abord (famille, puis dimensions, puis gamme, puis options). Propose des réponses à cliquer quand c'est possible, et toujours une valeur par défaut.
- Gammes des meubles : essentiel (mélaminé), confort (MDF laqué), premium (placage chêne ou bois massif). Si le client parle de chêne, noyer, bois massif → premium ; laqué, mat, couleur → confort ; blanc simple, budget serré → essentiel.
- Dimensions en mètres dans la fiche (2,40 m → 2.4 ; 240 cm → 2.4).
- Cuisine : les longueurs sont celles des meubles bas et des meubles hauts, l'électroménager est exclu. Fenêtre : largeur × hauteur d'une fenêtre, et la quantité.
- Si la demande n'est pas de la menuiserie (ou pas l'une des quatre familles), réponds avec statut hors_sujet et explique gentiment ce que tu sais faire.
- Réponds uniquement via l'outil repondre.`;

const Options = z.array(z.object({ valeur: z.union([z.string(), z.number(), z.boolean()]), libelle: z.string() }));
const QuestionSchema = z.object({
  champ: z.string(),
  question: z.string(),
  options: Options.optional(),
  defaut: z.union([z.string(), z.number(), z.boolean()]).optional(),
  unite: z.string().optional(),
});

/** Schéma JSON de l'outil : la fiche est laissée libre ici, c'est zod qui tranche ensuite. */
const OUTIL: Anthropic.Tool = {
  name: "repondre",
  description: "Répond au client : soit la fiche projet complète, soit des questions pour la compléter, soit hors sujet.",
  input_schema: {
    type: "object",
    properties: {
      statut: { type: "string", enum: ["fiche", "questions", "hors_sujet"] },
      message: { type: "string", description: "Une ou deux phrases pour le client, chaleureuses, sans prix." },
      famille: { type: "string", enum: ["dressing", "placard", "cuisine", "fenetre"] },
      fiche: {
        type: "object",
        description: "La fiche projet complète (statut fiche). Champs selon la famille : voir le schéma fourni dans le système.",
        additionalProperties: true,
      },
      ficheProvisoire: {
        type: "object",
        description: "Ce qui est déjà compris (statut questions).",
        additionalProperties: true,
      },
      questions: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            champ: { type: "string" },
            question: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: { valeur: {}, libelle: { type: "string" } },
                required: ["valeur", "libelle"],
              },
            },
            defaut: {},
            unite: { type: "string" },
          },
          required: ["champ", "question"],
        },
      },
    },
    required: ["statut", "message"],
  },
};

/** Schéma de la fiche, au format JSON, injecté dans le système pour que l'IA connaisse les champs. */
const SCHEMA_FICHE = JSON.stringify(z.toJSONSchema(FicheProjet, { unrepresentable: "any" }));

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export const iaDisponible = () => client() !== null;

/** Convertit les erreurs zod en questions compréhensibles. */
export function questionsDepuisErreurs(famille: Famille, issues: z.core.$ZodIssue[]): Question[] {
  const vus = new Set<string>();
  const questions: Question[] = [];
  for (const issue of issues) {
    const champ = String(issue.path[0] ?? "");
    if (!champ || vus.has(champ)) continue;
    vus.add(champ);
    const defaut = (DEFAUTS[famille] as Record<string, unknown>)[champ];
    questions.push({
      champ,
      question: LIBELLE_QUESTION[champ] ?? `Pouvez-vous préciser « ${champ} » ?`,
      defaut: defaut as Question["defaut"],
      unite: champ.endsWith("M") ? "m" : undefined,
      options: OPTIONS_CHAMP[champ],
    });
    if (questions.length === 3) break;
  }
  return questions;
}

/** Valide une fiche brute ; renvoie la fiche ou des questions. */
export function valider(brut: Record<string, unknown>, message: string): ReponseIA {
  const r = FicheProjet.safeParse(brut);
  if (r.success) return { statut: "fiche", message, fiche: r.data };
  const famille = brut.famille as Famille | undefined;
  if (!famille || !(famille in DEFAUTS)) {
    return {
      statut: "questions",
      message,
      questions: [
        {
          champ: "famille",
          question: "De quel type de projet s'agit-il ?",
          options: [
            { valeur: "dressing", libelle: "Dressing" },
            { valeur: "placard", libelle: "Placard" },
            { valeur: "cuisine", libelle: "Cuisine" },
            { valeur: "fenetre", libelle: "Fenêtre" },
          ],
        },
      ],
      ficheProvisoire: brut,
    };
  }
  return {
    statut: "questions",
    message,
    famille,
    questions: questionsDepuisErreurs(famille, r.error.issues),
    ficheProvisoire: brut,
  };
}

export async function extraireFiche(tours: Tour[], famille?: Famille): Promise<ReponseIA> {
  const anthropic = client();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY manquante");

  const systeme = `${SYSTEME}\n\nSchéma JSON de la fiche projet :\n${SCHEMA_FICHE}${
    famille ? `\n\nLe client a déjà choisi la famille : ${famille}.` : ""
  }`;

  const reponse = await anthropic.messages.create({
    model: MODELE,
    max_tokens: 1500,
    system: systeme,
    tools: [OUTIL],
    tool_choice: { type: "tool", name: "repondre" },
    messages: tours.map((t) => ({ role: t.role, content: t.content })),
  });

  const bloc = reponse.content.find((c) => c.type === "tool_use");
  if (!bloc || bloc.type !== "tool_use") throw new Error("Réponse IA sans outil");
  const sortie = bloc.input as Record<string, unknown>;
  const message = typeof sortie.message === "string" ? sortie.message : "";

  if (sortie.statut === "hors_sujet") return { statut: "hors_sujet", message };

  if (sortie.statut === "fiche" && sortie.fiche && typeof sortie.fiche === "object") {
    return valider(sortie.fiche as Record<string, unknown>, message);
  }

  const questions = z.array(QuestionSchema).safeParse(sortie.questions);
  return {
    statut: "questions",
    message,
    famille: (sortie.famille as Famille | undefined) ?? famille,
    questions: questions.success ? questions.data.slice(0, 3) : [],
    ficheProvisoire: (sortie.ficheProvisoire as Record<string, unknown>) ?? undefined,
  };
}
