/**
 * Écran 4 : envoi du lead dans HubSpot (contact + transaction dans le pipeline « Simulateur Atelier Kyka »),
 * puis visuel 3D joint en note, et tâche de rappel quand le client la demande.
 * Jeton d'application privée côté serveur uniquement. Scopes : crm.objects.contacts.read,
 * crm.objects.contacts.write, crm.objects.deals.write, files (visuel 3D).
 *
 * Variables : HUBSPOT_PRIVATE_APP_TOKEN, HUBSPOT_PIPELINE_ID (953151656),
 * HUBSPOT_STAGE_ESTIMATION_RECUE (1472120102), HUBSPOT_OWNER_ID (optionnel, qui reçoit les tâches).
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
  visuelJoint?: boolean;
  raison?: string;
}

const API = "https://api.hubapi.com";

/** Identifiants d'association HubSpot (catégorie HUBSPOT_DEFINED). */
const ASSOC = { dealVersContact: 3, noteVersContact: 202, noteVersDeal: 214, tacheVersContact: 204, tacheVersDeal: 216 } as const;

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

const association = (id: string, typeId: number) => ({
  to: { id },
  types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }],
});

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
      associations: [association(contactId, ASSOC.dealVersContact)],
    }),
  });
  if (deal.status !== 201 || !deal.data.id) {
    throw new Error(`HubSpot transaction ${deal.status} : ${JSON.stringify(deal.data)}`);
  }
  return { ok: true, contactId, dealId: deal.data.id };
}

/* ------------------------------------------------------------------ visuel 3D */

/** Lit une data URL image (jpeg/png) et renvoie le binaire + son type ; null si ce n'en est pas une. */
function decoderDataUrl(dataUrl: string): { octets: Uint8Array<ArrayBuffer>; type: string; extension: string } | null {
  const m = dataUrl.match(/^data:(image\/(png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[3], "base64");
  const octets = new Uint8Array(new ArrayBuffer(buf.byteLength));
  octets.set(buf);
  return { octets, type: m[1], extension: m[2] === "jpeg" ? "jpg" : "png" };
}

/** Envoie l'image dans le gestionnaire de fichiers HubSpot (dossier /simulateur, accès privé). Renvoie l'id du fichier. */
async function televerserVisuel(dataUrl: string, nom: string): Promise<string> {
  const image = decoderDataUrl(dataUrl);
  if (!image) throw new Error("visuel : data URL invalide");
  if (image.octets.byteLength > 2_000_000) throw new Error("visuel : image trop lourde");

  const form = new FormData();
  form.append("file", new Blob([image.octets], { type: image.type }), `${nom}.${image.extension}`);
  form.append("fileName", `${nom}.${image.extension}`);
  form.append("folderPath", "/simulateur");
  form.append("options", JSON.stringify({ access: "PRIVATE", overwrite: false, duplicateValidationStrategy: "NONE", duplicateValidationScope: "EXACT_FOLDER" }));

  const res = await fetch(`${API}/files/v3/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}` },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  if (res.status !== 201 || !data.id) throw new Error(`HubSpot fichier ${res.status} : ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Joint le visuel 3D à la transaction (et au contact) sous forme de note avec pièce jointe.
 * Ne lève jamais : si le fichier ou la note échoue, le lead reste bon et on renvoie false.
 */
export async function joindreVisuel(dataUrl: string, ids: { dealId: string; contactId: string }, fiche: FicheProjet): Promise<boolean> {
  if (!hubspotConfigure()) return false;
  try {
    const nom = `simulateur-${fiche.famille}-${ids.dealId}`;
    const fichierId = await televerserVisuel(dataUrl, nom);
    const note = await appel<{ id?: string }>("/crm/v3/objects/notes", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_timestamp: new Date().toISOString(),
          hs_note_body: `Visuel 3D du projet ${LIBELLES[fiche.famille].toLowerCase()} tel que configuré par le client sur le simulateur.`,
          hs_attachment_ids: fichierId,
        },
        associations: [association(ids.dealId, ASSOC.noteVersDeal), association(ids.contactId, ASSOC.noteVersContact)],
      }),
    });
    if (note.status !== 201) throw new Error(`HubSpot note ${note.status} : ${JSON.stringify(note.data)}`);
    return true;
  } catch (err) {
    console.error("Visuel non joint :", err);
    return false;
  }
}

/* ------------------------------------------------------------------ rappel */

export type Creneau = "matin" | "apres_midi" | "indifferent";

export const LIBELLE_CRENEAU: Record<Creneau, string> = { matin: "le matin (9 h – 12 h)", apres_midi: "l’après-midi (14 h – 18 h)", indifferent: "à tout moment" };

/** Prochain jour ouvré à 9 h (heure de Lisbonne, UTC+0/+1 : on prend 9 h UTC, assez proche). */
function echeanceRappel(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

/** Crée une tâche d'appel HubSpot « Rappeler {prénom} », échéance prochain jour ouvré, reliée à la transaction et au contact. */
export async function creerTacheRappel(args: { dealId: string; contactId: string; prenom: string; telephone: string; famille: FicheProjet["famille"]; creneau: Creneau }): Promise<{ ok: boolean; tacheId?: string; raison?: string }> {
  if (!hubspotConfigure()) return { ok: false, raison: "HubSpot non configuré" };
  const properties: Record<string, string> = {
    hs_timestamp: echeanceRappel().toISOString(),
    hs_task_subject: `Rappeler ${args.prenom} — ${LIBELLES[args.famille].toLowerCase()} (simulateur)`,
    hs_task_body: `Le client demande à être rappelé ${LIBELLE_CRENEAU[args.creneau]}.\nTéléphone : ${args.telephone}\nEstimation et visuel 3D sur la transaction.`,
    hs_task_status: "NOT_STARTED",
    hs_task_priority: "HIGH",
    hs_task_type: "CALL",
  };
  if (process.env.HUBSPOT_OWNER_ID) properties.hubspot_owner_id = process.env.HUBSPOT_OWNER_ID;

  const tache = await appel<{ id?: string }>("/crm/v3/objects/tasks", {
    method: "POST",
    body: JSON.stringify({ properties, associations: [association(args.dealId, ASSOC.tacheVersDeal), association(args.contactId, ASSOC.tacheVersContact)] }),
  });
  if (tache.status !== 201 || !tache.data.id) throw new Error(`HubSpot tâche ${tache.status} : ${JSON.stringify(tache.data)}`);
  return { ok: true, tacheId: tache.data.id };
}
