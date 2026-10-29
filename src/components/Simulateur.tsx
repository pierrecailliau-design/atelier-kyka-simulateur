"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Famille, FicheProjet } from "@/lib/fiche/schema";
import { LIBELLES } from "@/lib/fiche/schema";
import { OPTIONS_FAMILLE, libelleChamp } from "@/lib/fiche/libelles";
import type { Question, ReponseIA, Tour } from "@/lib/ia/types";
import type { Estimation } from "@/lib/prix/engine";
import Controles from "./Controles";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-stone-400">Chargement de la 3D…</div> });

type Etape = "accueil" | "questions" | "configurateur" | "contact" | "estimation";
type ReponseApi = ReponseIA & { mode?: string };

const euros = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";

export default function Simulateur() {
  const [etape, setEtape] = useState<Etape>("accueil");
  const [texte, setTexte] = useState("");
  const [famille, setFamille] = useState<Famille | undefined>();
  const [tours, setTours] = useState<Tour[]>([]);
  const [reponse, setReponse] = useState<ReponseApi | null>(null);
  const [reponses, setReponses] = useState<Record<string, unknown>>({});
  const [precision, setPrecision] = useState("");
  const [fiche, setFiche] = useState<FicheProjet | null>(null);
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [contact, setContact] = useState({ prenom: "", email: "", telephone: "", consentement: false });
  const [rappel, setRappel] = useState(false);
  const capture = useRef<(() => string) | null>(null);

  /* ---------------------------------------------------------- appels API */
  async function appelFiche(corps: Record<string, unknown>) {
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch("/api/fiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      const data = (await res.json()) as ReponseApi & { erreur?: string };
      if (!res.ok) throw new Error(data.erreur ?? "Erreur");
      traiter(data);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Une erreur est survenue, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  function traiter(data: ReponseApi) {
    setReponse(data);
    setReponses({});
    if (data.statut === "fiche") {
      setFiche(data.fiche);
      setFamille(data.fiche.famille);
      setEtape("configurateur");
      return;
    }
    if (data.statut === "questions" && data.famille) setFamille(data.famille);
    setEtape("questions");
  }

  function envoyerTexte(t: string) {
    const contenu = t.trim();
    if (!contenu) return;
    const nouveaux: Tour[] = [...tours, { role: "user", content: contenu }];
    setTours(nouveaux);
    appelFiche({ tours: nouveaux, famille });
  }

  function choisirFamille(f: Famille) {
    setFamille(f);
    setTours([]);
    appelFiche({ brut: { famille: f } });
  }

  function repondreQuestions() {
    if (!reponse || reponse.statut !== "questions") return;
    const brut: Record<string, unknown> = { ...(reponse.ficheProvisoire ?? {}), famille: reponse.famille ?? famille, ...reponses };
    // Les champs laissés à « je ne sais pas » prennent leur défaut et sont notés.
    const defauts = new Set<string>(Array.isArray(brut.defautsAppliques) ? (brut.defautsAppliques as string[]) : []);
    for (const q of reponse.questions) {
      if (brut[q.champ] === undefined && q.defaut !== undefined) {
        brut[q.champ] = q.defaut;
        defauts.add(q.champ);
      }
    }
    brut.defautsAppliques = [...defauts];
    appelFiche({ brut });
  }

  // Prix recalculé (et gardé caché) à chaque changement de la fiche
  useEffect(() => {
    if (!fiche) return;
    const t = setTimeout(async () => {
      const res = await fetch("/api/prix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fiche }) });
      if (res.ok) setEstimation((await res.json()).estimation as Estimation);
    }, 250);
    return () => clearTimeout(t);
  }, [fiche]);

  async function envoyerContact(e: React.FormEvent) {
    e.preventDefault();
    if (!fiche) return;
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact, fiche }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur ?? "Formulaire invalide");
      setEstimation(data.estimation as Estimation);
      if (!data.hubspot?.ok) console.warn("Lead non transmis :", data.hubspot?.raison);
      setEtape("estimation");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setChargement(false);
    }
  }

  const onSceneReady = useCallback((fn: () => string) => {
    capture.current = fn;
  }, []);

  /* ---------------------------------------------------------- rendu */
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8a5a2b]">Atelier Kyka · Porto</div>
          <h1 className="text-xl font-semibold text-stone-900">Simulateur de menuiserie sur mesure</h1>
        </div>
        <Etapes etape={etape} />
      </header>

      {erreur && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erreur}</div>}

      {etape === "accueil" && (
        <section className="mx-auto w-full max-w-2xl">
          <h2 className="text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">Décrivez votre projet, nous le dessinons et l’estimons.</h2>
          <p className="mt-3 text-stone-600">Dressing, placard, cuisine ou fenêtres : écrivez comme vous le diriez à un artisan. Deux ou trois questions, puis votre projet en 3D.</p>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              envoyerTexte(texte);
            }}
          >
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={4}
              placeholder="Par exemple : un dressing de 2,40 m avec portes coulissantes en chêne et quatre tiroirs…"
              className="w-full resize-none rounded-2xl border border-stone-300 bg-white p-4 text-base text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:border-[#8a5a2b]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {OPTIONS_FAMILLE.map((f) => (
                <button key={f.valeur} type="button" onClick={() => setTexte(f.exemple)} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:border-[#8a5a2b] hover:text-[#8a5a2b]">
                  {f.exemple.length > 48 ? f.exemple.slice(0, 46) + "…" : f.exemple}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={chargement || !texte.trim()} className="rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white shadow-sm transition hover:bg-[#75491f] disabled:opacity-40">
                {chargement ? "Je lis votre projet…" : "Dessiner mon projet"}
              </button>
              <span className="text-sm text-stone-500">ou</span>
              <div className="flex flex-wrap gap-2">
                {OPTIONS_FAMILLE.map((f) => (
                  <button key={f.valeur} type="button" disabled={chargement} onClick={() => choisirFamille(f.valeur)} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:border-stone-500">
                    {f.libelle}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </section>
      )}

      {etape === "questions" && reponse && (
        <section className="mx-auto w-full max-w-2xl">
          <p className="text-lg text-stone-800">{reponse.message}</p>
          {reponse.statut === "hors_sujet" && (
            <button type="button" onClick={() => setEtape("accueil")} className="mt-6 rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white">
              Reformuler
            </button>
          )}
          {reponse.statut === "questions" && (
            <>
              <div className="mt-6 space-y-6">
                {reponse.questions.map((q) => (
                  <QuestionBloc key={q.champ} question={q} valeur={reponses[q.champ]} onChange={(v) => setReponses((r) => ({ ...r, [q.champ]: v }))} />
                ))}
                {reponse.questions.length === 0 && <p className="text-stone-600">Je n’ai pas tout compris. Précisez votre projet ci-dessous.</p>}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" disabled={chargement} onClick={repondreQuestions} className="rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white hover:bg-[#75491f] disabled:opacity-40">
                  {chargement ? "Un instant…" : "Continuer"}
                </button>
                <span className="text-xs text-stone-500">Les questions sans réponse prennent la valeur standard, signalée sur votre estimation.</span>
              </div>
              <form
                className="mt-8 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  envoyerTexte(precision);
                  setPrecision("");
                }}
              >
                <input value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="Ou précisez librement…" className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-[#8a5a2b]" />
                <button type="submit" disabled={chargement || !precision.trim()} className="rounded-full border border-stone-300 px-4 py-2 text-sm hover:border-stone-500 disabled:opacity-40">
                  Envoyer
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {(etape === "configurateur" || etape === "contact" || etape === "estimation") && fiche && (
        <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-3xl border border-stone-200 bg-[#f7f4ef] shadow-inner lg:h-auto lg:min-h-[560px]">
            <Scene3D fiche={fiche} onReady={onSceneReady} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-xs text-stone-600 backdrop-blur">{LIBELLES[fiche.famille]} · faites tourner la vue</div>
            {fiche.defautsAppliques.length > 0 && (
              <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-amber-50/90 px-3 py-1 text-xs text-amber-800 backdrop-blur">Valeurs standard appliquées : {fiche.defautsAppliques.map(libelleChamp).join(", ")}</div>
            )}
          </div>

          <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            {etape === "configurateur" && (
              <>
                <h2 className="text-lg font-semibold text-stone-900">Ajustez votre projet</h2>
                <p className="mb-5 mt-1 text-sm text-stone-500">Chaque réglage met à jour le dessin et l’estimation.</p>
                <Controles fiche={fiche} onChange={setFiche} />
                <button type="button" onClick={() => setEtape("contact")} className="mt-6 w-full rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white hover:bg-[#75491f]">
                  Voir mon estimation
                </button>
                {estimation && estimation.optionsNonChiffrees.length > 0 && <p className="mt-3 text-xs text-stone-400">Non compris dans l’estimation : {estimation.optionsNonChiffrees.join(", ")}.</p>}
              </>
            )}

            {etape === "contact" && (
              <form onSubmit={envoyerContact} className="space-y-4">
                <h2 className="text-lg font-semibold text-stone-900">Où envoyer votre estimation ?</h2>
                <p className="text-sm text-stone-500">Votre fourchette de prix s’affiche juste après, et nous vous rappelons pour affiner.</p>
                <Champ label="Prénom" valeur={contact.prenom} onChange={(v) => setContact({ ...contact, prenom: v })} />
                <Champ label="E-mail" type="email" valeur={contact.email} onChange={(v) => setContact({ ...contact, email: v })} />
                <Champ label="Téléphone" type="tel" valeur={contact.telephone} onChange={(v) => setContact({ ...contact, telephone: v })} />
                <label className="flex items-start gap-2 text-xs text-stone-600">
                  <input type="checkbox" checked={contact.consentement} onChange={(e) => setContact({ ...contact, consentement: e.target.checked })} className="mt-0.5 accent-[#8a5a2b]" required />
                  <span>J’accepte qu’Atelier Kyka me contacte au sujet de ce projet. Vos données servent uniquement à ce suivi.</span>
                </label>
                <button type="submit" disabled={chargement || !contact.consentement} className="w-full rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white hover:bg-[#75491f] disabled:opacity-40">
                  {chargement ? "Envoi…" : "Afficher mon estimation"}
                </button>
                <button type="button" onClick={() => setEtape("configurateur")} className="w-full text-sm text-stone-500 hover:text-stone-800">
                  ← Modifier mon projet
                </button>
              </form>
            )}

            {etape === "estimation" && estimation && (
              <div>
                <div className="text-xs uppercase tracking-wider text-stone-500">Estimation indicative</div>
                <div className="mt-1 text-3xl font-semibold text-stone-900">
                  {euros(estimation.fourchette.basse)} <span className="text-stone-400">à</span> {euros(estimation.fourchette.haute)}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {estimation.regles.tvaIncluse ? "TTC" : "HT"}
                  {estimation.regles.poseIncluse ? ", pose incluse" : ", hors pose"} · valable {estimation.regles.validiteJours} jours · hors visite technique
                </div>
                <ul className="mt-5 divide-y divide-stone-100 text-sm">
                  <Ligne libelle={estimation.base.libelle} detail={estimation.base.detail} montant={estimation.base.montant} />
                  {estimation.optionsFixes.map((l) => (
                    <Ligne key={l.code} libelle={l.libelle} detail={l.detail} montant={l.montant} />
                  ))}
                  {estimation.pourcentages.map((l) => (
                    <Ligne key={l.code} libelle={l.libelle} detail={l.detail} montant={l.montant} />
                  ))}
                  {estimation.quantite > 1 && <Ligne libelle={`× ${estimation.quantite} exemplaires`} detail="" montant={estimation.prixAvantMinimum} />}
                  {estimation.minimumApplique && <Ligne libelle="Minimum de commande appliqué" detail="" montant={estimation.prixCalcule} />}
                </ul>
                {estimation.optionsNonChiffrees.length > 0 && <p className="mt-3 text-xs text-stone-500">À chiffrer lors de la visite : {estimation.optionsNonChiffrees.join(", ")}.</p>}
                                <div className="mt-6 space-y-2">
                  {rappel ? (
                    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Merci, nous vous rappelons sous 24 h ouvrées.</div>
                  ) : (
                    <button type="button" onClick={() => setRappel(true)} className="w-full rounded-full bg-[#8a5a2b] px-6 py-3 font-medium text-white hover:bg-[#75491f]">
                      Être rappelé
                    </button>
                  )}
                  <button type="button" onClick={() => setEtape("configurateur")} className="w-full rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 hover:border-stone-500">
                    Modifier mon projet
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      <footer className="mt-8 text-center text-xs text-stone-400">Estimation indicative calculée à partir de votre description, sans engagement. Le devis définitif suit la visite technique.</footer>
    </main>
  );
}

/* ---------------------------------------------------------- sous-composants */
function Etapes({ etape }: { etape: Etape }) {
  const ordre: Etape[] = ["accueil", "questions", "configurateur", "contact", "estimation"];
  const i = ordre.indexOf(etape);
  return (
    <div className="flex items-center gap-1.5" aria-label={`Étape ${i + 1} sur 5`}>
      {ordre.map((e, k) => (
        <span key={e} className={`h-1.5 rounded-full transition-all ${k <= i ? "w-6 bg-[#8a5a2b]" : "w-3 bg-stone-200"}`} />
      ))}
    </div>
  );
}

function QuestionBloc({ question, valeur, onChange }: { question: Question; valeur: unknown; onChange: (v: unknown) => void }) {
  const [libre, setLibre] = useState("");
  const options = question.options ?? [];
  return (
    <div>
      <div className="font-medium text-stone-900">{question.question}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.valeur)}
            type="button"
            onClick={() => onChange(o.valeur)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${valeur === o.valeur ? "border-[#8a5a2b] bg-[#8a5a2b] text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`}
          >
            {o.libelle}
          </button>
        ))}
        {options.length === 0 && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.05"
              inputMode="decimal"
              value={libre}
              onChange={(e) => {
                setLibre(e.target.value);
                onChange(e.target.value === "" ? undefined : Number(e.target.value.replace(",", ".")));
              }}
              placeholder={question.defaut !== undefined ? `standard : ${question.defaut}` : ""}
              className="w-40 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm outline-none focus:border-[#8a5a2b]"
            />
            {question.unite && <span className="text-sm text-stone-500">{question.unite}</span>}
          </div>
        )}
        {question.defaut !== undefined && (
          <button
            type="button"
            onClick={() => {
              setLibre("");
              onChange(question.defaut);
            }}
            className={`rounded-full border border-dashed px-3 py-1.5 text-sm ${valeur === question.defaut && options.length === 0 ? "border-[#8a5a2b] text-[#8a5a2b]" : "border-stone-300 text-stone-500 hover:border-stone-500"}`}
          >
            Je ne sais pas
          </button>
        )}
      </div>
    </div>
  );
}

function Champ({ label, valeur, onChange, type = "text" }: { label: string; valeur: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-stone-700">{label}</span>
      <input type={type} value={valeur} onChange={(e) => onChange(e.target.value)} required className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-[#8a5a2b]" />
    </label>
  );
}

function Ligne({ libelle, detail, montant }: { libelle: string; detail: string; montant: number }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <div>
        <div className="text-stone-800">{libelle}</div>
        {detail && <div className="text-xs text-stone-400">{detail}</div>}
      </div>
      <div className="tabular-nums text-stone-700">{euros(montant)}</div>
    </li>
  );
}
