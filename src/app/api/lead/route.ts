import { z } from "zod";
import { FicheProjet } from "@/lib/fiche/schema";
import { chargerGrille } from "@/lib/grille/sheets";
import { envoyerLead } from "@/lib/hubspot";
import { estimer } from "@/lib/prix/engine";

const Corps = z.object({
  contact: z.object({
    prenom: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    telephone: z.string().trim().min(6).max(30),
    consentement: z.literal(true),
  }),
  fiche: FicheProjet,
});

export async function POST(req: Request) {
  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success) {
    return Response.json({ erreur: "Formulaire invalide", details: corps.error.issues }, { status: 400 });
  }
  const { contact, fiche } = corps.data;
  // Le prix est recalculé côté serveur : le client ne l'envoie jamais.
  const estimation = estimer(fiche, await chargerGrille());

  try {
    const resultat = await envoyerLead(contact, fiche, estimation);
    if (!resultat.ok) console.warn("Lead non envoyé :", resultat.raison);
    return Response.json({ estimation, hubspot: resultat });
  } catch (err) {
    // Le client doit toujours voir son estimation, même si HubSpot tousse.
    console.error("HubSpot :", err);
    return Response.json({ estimation, hubspot: { ok: false, raison: "Erreur HubSpot, lead à ressaisir" } });
  }
}
