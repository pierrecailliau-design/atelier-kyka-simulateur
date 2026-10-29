import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerTacheRappel, envoyerLead, joindreVisuel } from "./hubspot";
import { FicheProjet } from "./fiche/schema";
import { grilleDeTest } from "./grille/fixture";
import { estimer } from "./prix/engine";

const fiche = FicheProjet.parse({ famille: "dressing", largeurM: 2.4, hauteurM: 2.5, profondeurM: 0.6, gamme: "confort", facade: "coulissant", tiroirs: 4, defautsAppliques: [] });
const estimation = estimer(fiche, grilleDeTest());
const contact = { prenom: "Ana", email: "ana@example.pt", telephone: "+351 910 000 000", consentement: true as const };
// 1×1 px PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type Appel = { url: string; init: RequestInit };
let appels: Appel[];

function simulerHubSpot(reponses: Record<string, { status: number; body: unknown }>) {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      const cle = Object.keys(reponses).find((k) => url.includes(k));
      const r = cle ? reponses[cle] : { status: 404, body: {} };
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "pat-test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("envoyerLead", () => {
  it("crée le contact puis la transaction associée, avec les propriétés simu_*", async () => {
    simulerHubSpot({ "/contacts": { status: 201, body: { id: "101" } }, "/deals": { status: 201, body: { id: "202" } } });
    const r = await envoyerLead(contact, fiche, estimation);
    expect(r).toEqual({ ok: true, contactId: "101", dealId: "202" });
    const deal = JSON.parse(String(appels[1].init.body));
    expect(deal.properties.dealname).toBe("Dressing — Ana (simulateur)");
    expect(deal.properties.simu_fourchette_basse).toBe(String(estimation.fourchette.basse));
    expect(deal.associations[0]).toEqual({ to: { id: "101" }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] });
  });

  it("réutilise un contact existant (409) et le met à jour", async () => {
    simulerHubSpot({ "/contacts/777": { status: 200, body: {} }, "/contacts": { status: 409, body: { message: "Contact already exists. Existing ID: 777" } }, "/deals": { status: 201, body: { id: "9" } } });
    const r = await envoyerLead(contact, fiche, estimation);
    expect(r.contactId).toBe("777");
    expect(appels.map((a) => a.init.method)).toEqual(["POST", "PATCH", "POST"]);
  });

  it("sans jeton, renvoie ok:false sans appeler HubSpot", async () => {
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "");
    simulerHubSpot({});
    const r = await envoyerLead(contact, fiche, estimation);
    expect(r.ok).toBe(false);
    expect(appels).toHaveLength(0);
  });
});

describe("joindreVisuel", () => {
  it("téléverse l'image puis crée une note liée à la transaction et au contact", async () => {
    simulerHubSpot({ "/files/v3/files": { status: 201, body: { id: "f1" } }, "/notes": { status: 201, body: { id: "n1" } } });
    const ok = await joindreVisuel(PNG, { dealId: "202", contactId: "101" }, fiche);
    expect(ok).toBe(true);
    expect(appels[0].init.body).toBeInstanceOf(FormData);
    const form = appels[0].init.body as FormData;
    expect(form.get("folderPath")).toBe("/simulateur");
    expect((form.get("file") as File).name).toBe("simulateur-dressing-202.png");
    const note = JSON.parse(String(appels[1].init.body));
    expect(note.properties.hs_attachment_ids).toBe("f1");
    expect(note.associations.map((a: { types: { associationTypeId: number }[] }) => a.types[0].associationTypeId)).toEqual([214, 202]);
  });

  it("ne lève jamais : data URL invalide → false", async () => {
    simulerHubSpot({});
    expect(await joindreVisuel("data:text/plain;base64,QUJD", { dealId: "1", contactId: "2" }, fiche)).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("ne lève jamais : HubSpot en erreur → false", async () => {
    simulerHubSpot({ "/files/v3/files": { status: 500, body: { message: "boom" } } });
    expect(await joindreVisuel(PNG, { dealId: "1", contactId: "2" }, fiche)).toBe(false);
  });
});

describe("creerTacheRappel", () => {
  it("crée une tâche d'appel HIGH, échéance un jour ouvré, liée à la transaction et au contact", async () => {
    simulerHubSpot({ "/tasks": { status: 201, body: { id: "t1" } } });
    const r = await creerTacheRappel({ dealId: "202", contactId: "101", prenom: "Ana", telephone: "+351 910", famille: "dressing", creneau: "matin" });
    expect(r).toEqual({ ok: true, tacheId: "t1" });
    const tache = JSON.parse(String(appels[0].init.body));
    expect(tache.properties.hs_task_subject).toBe("Rappeler Ana — dressing (simulateur)");
    expect(tache.properties.hs_task_type).toBe("CALL");
    expect(tache.properties.hs_task_body).toContain("le matin");
    const echeance = new Date(tache.properties.hs_timestamp);
    expect(echeance.getTime()).toBeGreaterThan(Date.now());
    expect([0, 6]).not.toContain(echeance.getUTCDay());
    expect(tache.associations.map((a: { types: { associationTypeId: number }[] }) => a.types[0].associationTypeId)).toEqual([216, 204]);
  });
});
