/**
 * Écran 4 : envoi du lead dans HubSpot (contact + transaction dans le pipeline « Simulateur Atelier Kyka »).
 * Jeton d'application privée côté serveur uniquement. Scopes : crm.objects.contacts.write,
 * crm.objects.contacts.read, crm.objects.deals.write.
 *
 * Variables : HUBSPOT_PRIVATE_APP_TOKEN, HUBSPOT_PIPELINE_ID (953151656),
 * HUBSPOT_STAGE_ESTIMATION_RECUE (1472120102).
 */
import { LIBELLES, type FicheProjet } from "./fiche/schema";
import type { Estimation } from "./prix/engine";

export interface Contact {
  prenom: string;
  email: string;
  telephone: string;
  consentement: boolean;
}

export interface ResultatLead {
  ok: boolean;
  contactId?: string;
  dealId?: string;
  raison?: string;
}

const API = "https://api.hubapi.com";

export const hubspotConfigure = () => Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN);

async function appel<T>(chemin: string, init: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}${chemin}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

/** Crée le contact, ou le met à jour s'il existe déjà (HubSpot renvoie 409 avec son id). */
async function upsertContact(c: Contact): Promise<string> {
  const properties = { email: c.email, firstname: c.prenom, phone: c.telephone };
  const creation = await appel<{ id?: string; message?: string }>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  if (creation.status === 201 && creation.data.id) return creation.data.id;
  if (creation.status === 409) {
    const id = creation.data.message?.match(/ID: (\d+)/)?.[1];
    if (id) {
      await appel(`/crm/v3/objects/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ properties }) });
      return id;
    }
  }
  throw new Error(`HubSpot contact ${creation.status} : ${JSON.stringify(creation.data)}`);
}

function resumeFiche(fiche: FicheProjet): string {
  const f = fiche as unknown as Record<string, unknown>;
  const lignes = Object.entries(f)
    .filter(([k, v]) => !["famille", "commentaire", "defautsAppliques"].includes(k) && v !== undefined && v !== false && v !== 0)
    .map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  if (fiche.defautsAppliques.length) lignes.push(`valeurs par défaut : ${fiche.defautsAppliques.join(", ")}`);
  if (fiche.commentaire) lignes.push(`commentaire client : ${fiche.commentaire}`);
  return lignes.join("\n");
}

export async function envoyerLead(contact: Contact, fiche: FicheProjet, estimation: Estimation): Promise<ResultatLead> {
  if (!hubspotConfigure()) return { ok: false, raison: "HubSpot non configuré (HUBSPOT_PRIVATE_APP_TOKEN)" };
  const pipeline = process.env.HUBSPOT_PIPELINE_ID ?? "953151656";
  const dealstage = process.env.HUBSPOT_STAGE_ESTIMATION_RECUE ?? "1472120102";

  const contactId = await upsertContact(contact);
  const titre = `${LIBELLES[fiche.famille]} — ${contact.prenom} (simulateur)`;
  const deal = await appel<{ id?: string }>("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: titre,
        pipeline,
        dealstage,
        amount: String(estimation.prixCalcule),
        description: `Estimation simulateur : ${estimation.fourchette.basse} à ${estimation.fourchette.haute} € TTC.\n\n${resumeFiche(fiche)}`,
        simu_famille: fiche.famille,
        simu_fourchette_basse: String(estimation.fourchette.basse),
        simu_fourchette_haute: String(estimation.fourchette.haute),
        simu_fiche_json: JSON.stringify({ fiche, estimation: { prixCalcule: estimation.prixCalcule, fourchette: estimation.fourchette, grilleVersion: estimation.grilleVersion } }),
      },
      associations: [
        {
          to: { id: contactId },
          // 3 = transaction → contact (association HubSpot par défaut)
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ],
    }),
  });
  if (deal.status !== 201 || !deal.data.id) {
    throw new Error(`HubSpot transaction ${deal.status} : ${JSON.stringify(deal.data)}`);
  }
  return { ok: true, contactId, dealId: deal.data.id };
}
