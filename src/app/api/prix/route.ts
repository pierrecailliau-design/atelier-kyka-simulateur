import { FicheProjet } from "@/lib/fiche/schema";
import { chargerGrille } from "@/lib/grille/sheets";
import { pourClient } from "@/lib/prix/client";
import { estimer } from "@/lib/prix/engine";

/**
 * Écran 3 : aperçu pendant le réglage. Renvoie ce qui est compris et ce qui reste à chiffrer,
 * mais jamais la fourchette (elle n'arrive qu'avec /api/lead) ni les tarifs de la grille.
 */
export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  const fiche = FicheProjet.safeParse(corps?.fiche);
  if (!fiche.success) {
    return Response.json({ erreur: "Fiche invalide", details: fiche.error.issues }, { status: 400 });
  }
  const grille = await chargerGrille();
  return Response.json({ estimation: pourClient(estimer(fiche.data, grille), false) });
}
