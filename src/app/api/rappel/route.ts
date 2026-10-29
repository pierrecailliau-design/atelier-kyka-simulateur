/**
 * Écran 5 : « Être rappelé ». Crée une tâche d'appel dans HubSpot reliée à la transaction du lead.
 * Les identifiants viennent de la réponse de /api/lead ; sans eux (HubSpot absent), on répond ok
 * quand même pour ne pas bloquer le client, et on journalise la demande.
 */
import { z } from "zod";
import { creerTacheRappel, hubspotConfigure } from "@/lib/hubspot";
import { adresseIp, autoriser, reponseTropDAppels } from "@/lib/limite";

const Corps = z.object({
  dealId: z.string().regex(/^\d+$/).optional(),
  contactId: z.string().regex(/^\d+$/).optional(),
  prenom: z.string().trim().min(1).max(80),
  telephone: z.string().trim().min(6).max(30),
  famille: z.enum(["dressing", "placard", "cuisine", "fenetre"]),
  creneau: z.enum(["matin", "apres_midi", "indifferent"]),
});

export async function POST(req: Request) {
  if (!autoriser(`rappel:${adresseIp(req)}`, 10, 600)) return reponseTropDAppels();

  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success) return Response.json({ erreur: "Demande invalide" }, { status: 400 });
  const d = corps.data;

  if (!hubspotConfigure() || !d.dealId || !d.contactId) {
    console.warn("Rappel demandé sans HubSpot :", { prenom: d.prenom, telephone: d.telephone, famille: d.famille, creneau: d.creneau });
    return Response.json({ ok: true, hubspot: false });
  }
  try {
    const resultat = await creerTacheRappel({ dealId: d.dealId, contactId: d.contactId, prenom: d.prenom, telephone: d.telephone, famille: d.famille, creneau: d.creneau });
    return Response.json({ ok: true, hubspot: resultat.ok, tacheId: resultat.tacheId });
  } catch (err) {
    console.error("Tâche de rappel :", err);
    return Response.json({ ok: true, hubspot: false });
  }
}
