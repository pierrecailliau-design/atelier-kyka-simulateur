import { z } from "zod";
import { extraireFiche, iaDisponible, modifierFiche, valider } from "@/lib/ia/extraire";
import { extraireHeuristique, modifierHeuristique } from "@/lib/ia/fallback";
import { FicheProjet, type Famille } from "@/lib/fiche/schema";
import type { ReponseIA } from "@/lib/ia/types";
import { adresseIp, autoriser, reponseTropDAppels } from "@/lib/limite";

const Corps = z.union([
  // Texte libre du client (premier message, ou relance en texte) → IA ou heuristique
  z.object({
    tours: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(20),
    famille: z.enum(["dressing", "placard", "cuisine", "fenetre"]).optional(),
  }),
  // Réponses à des questions : on fusionne et on valide, sans appel IA
  z.object({ brut: z.record(z.string(), z.unknown()) }),
  // Le client est devant sa 3D et demande un changement par écrit → fiche mise à jour
  z.object({ fiche: z.record(z.string(), z.unknown()), demande: z.string().trim().min(2).max(600) }),
]);

/** Garde la trace de chaque demande écrite dans le commentaire transmis à l'atelier. */
function journaliser(reponse: ReponseIA, demande: string): ReponseIA {
  if (reponse.statut !== "fiche") return reponse;
  const avant = reponse.fiche.commentaire ?? "";
  reponse.fiche.commentaire = `${avant}${avant ? "\n" : ""}Puis : ${demande}`.slice(-2000);
  return reponse;
}

export async function POST(req: Request) {
  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });

  if ("brut" in corps.data) {
    return Response.json({ ...valider(corps.data.brut, "Merci, je complète la fiche."), mode: "validation" });
  }

  // 30 lectures IA par IP et par 10 minutes : largement assez pour un vrai client, pas pour un robot.
  if (!autoriser(`fiche:${adresseIp(req)}`, 30, 600)) return reponseTropDAppels();

  if ("demande" in corps.data) {
    const fiche = FicheProjet.safeParse(corps.data.fiche);
    if (!fiche.success) return Response.json({ erreur: "Fiche invalide" }, { status: 400 });
    const { demande } = corps.data;
    if (iaDisponible()) {
      try {
        return Response.json({ ...journaliser(await modifierFiche(fiche.data, demande), demande), mode: "ia" });
      } catch (err) {
        console.error("IA indisponible, bascule heuristique :", err);
      }
    }
    return Response.json({ ...journaliser(modifierHeuristique(fiche.data, demande), demande), mode: "heuristique" });
  }

  const { tours, famille } = corps.data;
  const dernier = [...tours].reverse().find((t) => t.role === "user")?.content ?? "";

  if (iaDisponible()) {
    try {
      const reponse = await extraireFiche(tours, famille as Famille | undefined);
      return Response.json({ ...reponse, mode: "ia" });
    } catch (err) {
      console.error("IA indisponible, bascule heuristique :", err);
    }
  }
  return Response.json({ ...extraireHeuristique(dernier, famille as Famille | undefined), mode: "heuristique" });
}
