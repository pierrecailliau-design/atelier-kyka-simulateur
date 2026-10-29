import { FicheProjet } from "@/lib/fiche/schema";
import { chargerGrille } from "@/lib/grille/sheets";
import { estimer } from "@/lib/prix/engine";

export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  const fiche = FicheProjet.safeParse(corps?.fiche);
  if (!fiche.success) {
    return Response.json({ erreur: "Fiche invalide", details: fiche.error.issues }, { status: 400 });
  }
  const grille = await chargerGrille();
  return Response.json({ estimation: estimer(fiche.data, grille) });
}
