import { z } from "zod";
import { extraireFiche, iaDisponible, valider } from "@/lib/ia/extraire";
import { extraireHeuristique } from "@/lib/ia/fallback";
import type { Famille } from "@/lib/fiche/schema";

const Corps = z.union([
  // Texte libre du client (premier message, ou relance en texte) → IA ou heuristique
  z.object({
    tours: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(20),
    famille: z.enum(["dressing", "placard", "cuisine", "fenetre"]).optional(),
  }),
  // Réponses à des questions : on fusionne et on valide, sans appel IA
  z.object({ brut: z.record(z.string(), z.unknown()) }),
]);

export async function POST(req: Request) {
  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Requête invalide" }, { status: 400 });

  if ("brut" in corps.data) {
    return Response.json({ ...valider(corps.data.brut, "Merci, je complète la fiche."), mode: "validation" });
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
