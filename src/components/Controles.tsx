"use client";

/** Écran 3 : curseurs et sélecteurs reliés à la fiche. Chaque changement met à jour la 3D et le prix. */
import { useState } from "react";
import { finitionEffective, type FicheProjet } from "@/lib/fiche/schema";
import { OPTIONS_CHAMP, TEINTES_FENETRE, optionsFinition } from "@/lib/fiche/libelles";

type Props = { fiche: FicheProjet; onChange: (fiche: FicheProjet) => void };

/** Curseur + saisie au centimètre : le sur-mesure se joue à 2,37 m, pas à 2,40. */
function Curseur({ label, valeur, min, max, pas = 0.01, onChange }: { label: string; valeur: number; min: number; max: number; pas?: number; onChange: (v: number) => void }) {
  const [texte, setTexte] = useState(valeur.toFixed(2));
  const [valeurVue, setValeurVue] = useState(valeur);
  if (valeurVue !== valeur) {
    // la fiche a changé ailleurs (curseur, IA) : on réaligne le champ texte pendant le rendu
    setValeurVue(valeur);
    setTexte(valeur.toFixed(2));
  }
  const valider = () => {
    const v = Number(texte.replace(",", "."));
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
    else setTexte(valeur.toFixed(2));
  };
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-stone-700">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={texte.replace(".", ",")}
            onChange={(e) => setTexte(e.target.value)}
            onBlur={valider}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label={`${label} en mètres`}
            className="w-16 rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-right font-medium tabular-nums text-stone-900 outline-none focus:border-[#8a5a2b]"
          />
          <span className="text-stone-500">m</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#8a5a2b]" />
    </div>
  );
}

function Choix<T extends string | number>({ label, valeur, options, onChange }: { label: string; valeur: T; options: { valeur: T; libelle: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="text-sm text-stone-700">{label}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.valeur)}
            type="button"
            onClick={() => onChange(o.valeur)}
            className={`rounded-full border px-3 py-1 text-sm transition ${o.valeur === valeur ? "border-[#8a5a2b] bg-[#8a5a2b] text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pastilles de couleur, avec le nom de la teinte choisie. */
function Nuancier<T extends string>({ label, valeur, options, onChange }: { label: string; valeur: T; options: { valeur: T; libelle: string; couleur: string }[]; onChange: (v: T) => void }) {
  const actif = options.find((o) => o.valeur === valeur);
  return (
    <div>
      <div className="flex justify-between text-sm text-stone-700">
        <span>{label}</span>
        <span className="font-medium text-stone-900">{actif?.libelle}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            title={o.libelle}
            aria-label={o.libelle}
            aria-pressed={o.valeur === valeur}
            onClick={() => onChange(o.valeur)}
            className={`h-8 w-8 rounded-full border-2 shadow-sm transition ${o.valeur === valeur ? "border-[#8a5a2b] ring-2 ring-[#8a5a2b]/30" : "border-white hover:scale-105"}`}
            style={{ background: o.couleur }}
          />
        ))}
      </div>
    </div>
  );
}

function Nombre({ label, valeur, min = 0, max = 20, onChange }: { label: string; valeur: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-stone-700">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Moins de ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, valeur - 1))} className="h-8 w-8 rounded-full border border-stone-300 bg-white text-lg leading-none hover:border-stone-500">
          −
        </button>
        <span className="w-6 text-center font-medium tabular-nums">{valeur}</span>
        <button type="button" aria-label={`Plus de ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, valeur + 1))} className="h-8 w-8 rounded-full border border-stone-300 bg-white text-lg leading-none hover:border-stone-500">
          +
        </button>
      </div>
    </div>
  );
}

function Bascule({ label, valeur, onChange, note }: { label: string; valeur: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-stone-700">
        {label}
        {note && <span className="block text-xs text-stone-400">{note}</span>}
      </span>
      <button type="button" role="switch" aria-checked={valeur} onClick={() => onChange(!valeur)} className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition ${valeur ? "bg-[#8a5a2b]" : "bg-stone-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${valeur ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function Precisions({ valeur, onChange }: { valeur?: string; onChange: (v: string) => void }) {
  return (
    <label className="block border-t border-stone-100 pt-4">
      <span className="text-sm text-stone-700">Une précision pour l’atelier ?</span>
      <span className="block text-xs text-stone-400">Niche à prévoir, tuyau à contourner, prise à garder accessible… tout ce qui compte pour vous.</span>
      <textarea value={valeur ?? ""} onChange={(e) => onChange(e.target.value.slice(0, 600))} rows={2} placeholder="Facultatif" className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-[#8a5a2b]" />
    </label>
  );
}

const opt = (champ: string) => (OPTIONS_CHAMP[champ] ?? []) as { valeur: never; libelle: string }[];

const Titre = ({ children }: { children: string }) => <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-stone-400">{children}</div>;

export default function Controles({ fiche, onChange }: Props) {
  const maj = (patch: Partial<FicheProjet>) => onChange({ ...fiche, ...patch } as FicheProjet);

  switch (fiche.famille) {
    case "dressing":
      return (
        <div className="space-y-5">
          <Titre>Dimensions</Titre>
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.6} max={6} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={1.8} max={3.2} onChange={(v) => maj({ hauteurM: v })} />
          <Curseur label="Profondeur" valeur={fiche.profondeurM} min={0.35} max={0.8} onChange={(v) => maj({ profondeurM: v })} />
          <Titre>Style</Titre>
          <Choix label="Gamme" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v, finition: undefined })} />
          <Nuancier label="Finition" valeur={finitionEffective(fiche.gamme, fiche.finition)} options={optionsFinition(fiche.gamme)} onChange={(v) => maj({ finition: v })} />
          <Choix label="Façade" valeur={fiche.facade} options={opt("facade")} onChange={(v) => maj({ facade: v })} />
          {fiche.facade !== "ouvert" && <Choix label="Poignées" valeur={fiche.poignees} options={opt("poignees")} onChange={(v) => maj({ poignees: v })} />}
          <Titre>Intérieur</Titre>
          <Choix label="Aménagement" valeur={fiche.amenagement} options={opt("amenagement")} onChange={(v) => maj({ amenagement: v })} />
          <Nombre label="Tiroirs" valeur={fiche.tiroirs} onChange={(v) => maj({ tiroirs: v })} />
          {fiche.facade !== "ouvert" && <Nombre label="Portes avec miroir" valeur={fiche.miroirPortes} max={8} onChange={(v) => maj({ miroirPortes: v })} />}
          <Bascule label="Éclairage LED" valeur={fiche.eclairageLed} onChange={(v) => maj({ eclairageLed: v })} />
          <Bascule label="Penderie double" note="Deux tringles superposées · chiffrée lors de la visite" valeur={fiche.penderieDouble} onChange={(v) => maj({ penderieDouble: v })} />
          <Precisions valeur={fiche.precisions} onChange={(v) => maj({ precisions: v || undefined })} />
        </div>
      );
    case "placard":
      return (
        <div className="space-y-5">
          <Titre>Dimensions</Titre>
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.4} max={6} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={0.6} max={3.2} onChange={(v) => maj({ hauteurM: v })} />
          <Curseur label="Profondeur" valeur={fiche.profondeurM} min={0.3} max={0.8} onChange={(v) => maj({ profondeurM: v })} />
          <Choix label="Configuration" valeur={fiche.configuration} options={opt("configuration")} onChange={(v) => maj({ configuration: v })} />
          <Titre>Style</Titre>
          <Choix label="Gamme" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v, finition: undefined })} />
          <Nuancier label="Finition" valeur={finitionEffective(fiche.gamme, fiche.finition)} options={optionsFinition(fiche.gamme)} onChange={(v) => maj({ finition: v })} />
          <Choix label="Portes" valeur={fiche.portes} options={opt("portes")} onChange={(v) => maj({ portes: v })} />
          <Choix label="Poignées" valeur={fiche.poignees} options={opt("poignees")} onChange={(v) => maj({ poignees: v })} />
          <Titre>Intérieur</Titre>
          <Choix label="Aménagement" valeur={fiche.amenagement} options={opt("amenagement")} onChange={(v) => maj({ amenagement: v })} />
          <Nombre label="Tiroirs" valeur={fiche.tiroirs} onChange={(v) => maj({ tiroirs: v })} />
          <Precisions valeur={fiche.precisions} onChange={(v) => maj({ precisions: v || undefined })} />
        </div>
      );
    case "cuisine":
      return (
        <div className="space-y-5">
          <Titre>Dimensions</Titre>
          <Curseur label="Meubles bas" valeur={fiche.longueurBasM} min={1} max={10} onChange={(v) => maj({ longueurBasM: v })} />
          <Curseur label="Meubles hauts" valeur={fiche.longueurHautM} min={0} max={10} onChange={(v) => maj({ longueurHautM: v })} />
          <Choix label="Implantation" valeur={fiche.implantation} options={opt("implantation")} onChange={(v) => maj({ implantation: v })} />
          <Titre>Style</Titre>
          <Choix label="Gamme des façades" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v, finition: undefined })} />
          <Nuancier label="Finition des façades" valeur={finitionEffective(fiche.gamme, fiche.finition)} options={optionsFinition(fiche.gamme)} onChange={(v) => maj({ finition: v })} />
          <Choix label="Plan de travail" valeur={fiche.planTravail} options={opt("planTravail")} onChange={(v) => maj({ planTravail: v })} />
          <Choix label="Crédence" valeur={fiche.credence} options={opt("credence")} onChange={(v) => maj({ credence: v })} />
          <Choix label="Poignées" valeur={fiche.poignees} options={opt("poignees")} onChange={(v) => maj({ poignees: v })} />
          <Titre>Rangements</Titre>
          <Nombre label="Colonnes" valeur={fiche.colonnes} max={6} onChange={(v) => maj({ colonnes: v })} />
          <Nombre label="Meubles à tiroirs" valeur={fiche.tiroirs} max={10} onChange={(v) => maj({ tiroirs: v })} />
          <Precisions valeur={fiche.precisions} onChange={(v) => maj({ precisions: v || undefined })} />
        </div>
      );
    case "fenetre":
      return (
        <div className="space-y-5">
          <Titre>Dimensions</Titre>
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.3} max={3} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={0.3} max={2.5} onChange={(v) => maj({ hauteurM: v })} />
          <Nombre label="Nombre de fenêtres" valeur={fiche.quantite} min={1} max={20} onChange={(v) => maj({ quantite: v })} />
          <Titre>Menuiserie</Titre>
          <Choix label="Matériau" valeur={fiche.materiau} options={opt("materiau")} onChange={(v) => maj({ materiau: v })} />
          {fiche.materiau !== "bois" && (
            <Nuancier
              label="Teinte"
              valeur={fiche.teinte}
              options={(Object.keys(TEINTES_FENETRE) as (keyof typeof TEINTES_FENETRE)[]).map((t) => ({ valeur: t, libelle: TEINTES_FENETRE[t].libelle, couleur: TEINTES_FENETRE[t].couleur }))}
              onChange={(v) => maj({ teinte: v, couleurHorsBlanc: v !== "blanc" })}
            />
          )}
          <Choix label="Ouverture" valeur={fiche.ouverture} options={opt("ouverture")} onChange={(v) => maj({ ouverture: v })} />
          <Choix label="Vantaux" valeur={fiche.vantaux} options={opt("vantaux")} onChange={(v) => maj({ vantaux: v })} />
          <Choix label="Vitrage" valeur={fiche.vitrage} options={opt("vitrage")} onChange={(v) => maj({ vitrage: v })} />
          <Titre>Options</Titre>
          <Bascule label="Petits-bois (croisillons)" note="Chiffrés lors de la visite" valeur={fiche.petitsBois} onChange={(v) => maj({ petitsBois: v })} />
          <Bascule label="Volet roulant" valeur={fiche.voletRoulant} onChange={(v) => maj({ voletRoulant: v })} />
          <Bascule label="Dépose de l’ancienne fenêtre" valeur={fiche.depose} onChange={(v) => maj({ depose: v })} />
          <Precisions valeur={fiche.precisions} onChange={(v) => maj({ precisions: v || undefined })} />
        </div>
      );
  }
}
