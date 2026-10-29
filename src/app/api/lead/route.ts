import { z } from "zod";
import { FicheProjet } from "@/lib/fiche/schema";
import { chargerGrille } from "@/lib/grille/sheets";
import { envoyerLead, joindreVisuel } from "@/lib/hubspot";
import { adresseIp, autoriser, reponseTropDAppels } from "@/lib/limite";
import { estimer } from "@/lib/prix/engine";

const Corps = z.object({
  contact: z.object({
    prenom: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    telephone: z.string().trim().min(6).max(30),
    consentement: z.literal(true),
  }),
  fiche: FicheProjet,
  // Capture JPEG/PNG de la vue 3D (data URL), jointe à la transaction HubSpot. Facultative.
  visuel: z.string().startsWith("data:image/").max(2_800_000).optional(),
});

export async function POST(req: Request) {
  if (!autoriser(`lead:${adresseIp(req)}`, 10, 600)) return reponseTropDAppels();

  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success) {
    return Response.json({ erreur: "Formulaire invalide", details: corps.error.issues }, { status: 400 });
  }
  const { contact, fiche, visuel } = corps.data;
  // Le prix est recalculé côté serveur : le client ne l'envoie jamais.
  const estimation = estimer(fiche, await chargerGrille());

  try {
    const resultat = await envoyerLead(contact, fiche, estimation);
    if (!resultat.ok) console.warn("Lead non envoyé :", resultat.raison);
    if (resultat.ok && resultat.dealId && resultat.contactId && visuel) {
      resultat.visuelJoint = await joindreVisuel(visuel, { dealId: resultat.dealId, contactId: resultat.contactId }, fiche);
    }
    return Response.json({ estimation, hubspot: resultat });
  } catch (err) {
    // Le client doit toujours voir son estimation, même si HubSpot tousse.
    console.error("HubSpot :", err);
    return Response.json({ estimation, hubspot: { ok: false, raison: "Erreur HubSpot, lead à ressaisir" } });
  }
}
