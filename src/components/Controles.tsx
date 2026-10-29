"use client";

/** Écran 3 : curseurs et sélecteurs reliés à la fiche. Chaque changement met à jour la 3D et le prix. */
import type { FicheProjet } from "@/lib/fiche/schema";
import { OPTIONS_CHAMP } from "@/lib/fiche/libelles";

type Props = { fiche: FicheProjet; onChange: (fiche: FicheProjet) => void };

function Curseur({ label, valeur, min, max, pas = 0.1, unite = "m", onChange }: { label: string; valeur: number; min: number; max: number; pas?: number; unite?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm text-stone-700">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {unite === "m" ? valeur.toFixed(2).replace(".", ",") : valeur} {unite}
        </span>
      </div>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#8a5a2b]" />
    </label>
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

function Nombre({ label, valeur, min = 0, max = 20, onChange }: { label: string; valeur: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-stone-700">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, valeur - 1))} className="h-8 w-8 rounded-full border border-stone-300 bg-white text-lg leading-none hover:border-stone-500">−</button>
        <span className="w-6 text-center font-medium tabular-nums">{valeur}</span>
        <button type="button" onClick={() => onChange(Math.min(max, valeur + 1))} className="h-8 w-8 rounded-full border border-stone-300 bg-white text-lg leading-none hover:border-stone-500">+</button>
      </div>
    </div>
  );
}

function Bascule({ label, valeur, onChange }: { label: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm text-stone-700">{label}</span>
      <span onClick={() => onChange(!valeur)} className={`relative inline-block h-6 w-11 rounded-full transition ${valeur ? "bg-[#8a5a2b]" : "bg-stone-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${valeur ? "left-5.5" : "left-0.5"}`} />
      </span>
    </label>
  );
}

const opt = (champ: string) => (OPTIONS_CHAMP[champ] ?? []) as { valeur: never; libelle: string }[];

export default function Controles({ fiche, onChange }: Props) {
  const maj = (patch: Partial<FicheProjet>) => onChange({ ...fiche, ...patch } as FicheProjet);

  switch (fiche.famille) {
    case "dressing":
      return (
        <div className="space-y-5">
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.6} max={6} pas={0.1} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={1.8} max={3.2} pas={0.05} onChange={(v) => maj({ hauteurM: v })} />
          <Curseur label="Profondeur" valeur={fiche.profondeurM} min={0.35} max={0.8} pas={0.05} onChange={(v) => maj({ profondeurM: v })} />
          <Choix label="Gamme" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v })} />
          <Choix label="Façade" valeur={fiche.facade} options={opt("facade")} onChange={(v) => maj({ facade: v })} />
          <Nombre label="Tiroirs" valeur={fiche.tiroirs} onChange={(v) => maj({ tiroirs: v })} />
          {fiche.facade !== "ouvert" && <Nombre label="Portes avec miroir" valeur={fiche.miroirPortes} max={8} onChange={(v) => maj({ miroirPortes: v })} />}
          <Bascule label="Éclairage LED" valeur={fiche.eclairageLed} onChange={(v) => maj({ eclairageLed: v })} />
        </div>
      );
    case "placard":
      return (
        <div className="space-y-5">
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.4} max={6} pas={0.1} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={0.6} max={3.2} pas={0.05} onChange={(v) => maj({ hauteurM: v })} />
          <Curseur label="Profondeur" valeur={fiche.profondeurM} min={0.3} max={0.8} pas={0.05} onChange={(v) => maj({ profondeurM: v })} />
          <Choix label="Gamme" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v })} />
          <Choix label="Portes" valeur={fiche.portes} options={opt("portes")} onChange={(v) => maj({ portes: v })} />
          <Choix label="Configuration" valeur={fiche.configuration} options={opt("configuration")} onChange={(v) => maj({ configuration: v })} />
          <Nombre label="Tiroirs" valeur={fiche.tiroirs} onChange={(v) => maj({ tiroirs: v })} />
        </div>
      );
    case "cuisine":
      return (
        <div className="space-y-5">
          <Curseur label="Meubles bas" valeur={fiche.longueurBasM} min={1} max={10} pas={0.1} onChange={(v) => maj({ longueurBasM: v })} />
          <Curseur label="Meubles hauts" valeur={fiche.longueurHautM} min={0} max={10} pas={0.1} onChange={(v) => maj({ longueurHautM: v })} />
          <Choix label="Implantation" valeur={fiche.implantation} options={opt("implantation")} onChange={(v) => maj({ implantation: v })} />
          <Choix label="Gamme des façades" valeur={fiche.gamme} options={opt("gamme")} onChange={(v) => maj({ gamme: v })} />
          <Choix label="Plan de travail" valeur={fiche.planTravail} options={opt("planTravail")} onChange={(v) => maj({ planTravail: v })} />
          <Nombre label="Colonnes" valeur={fiche.colonnes} max={6} onChange={(v) => maj({ colonnes: v })} />
          <Nombre label="Meubles à tiroirs" valeur={fiche.tiroirs} max={10} onChange={(v) => maj({ tiroirs: v })} />
        </div>
      );
    case "fenetre":
      return (
        <div className="space-y-5">
          <Curseur label="Largeur" valeur={fiche.largeurM} min={0.3} max={3} pas={0.05} onChange={(v) => maj({ largeurM: v })} />
          <Curseur label="Hauteur" valeur={fiche.hauteurM} min={0.3} max={2.5} pas={0.05} onChange={(v) => maj({ hauteurM: v })} />
          <Nombre label="Nombre de fenêtres" valeur={fiche.quantite} min={1} max={20} onChange={(v) => maj({ quantite: v })} />
          <Choix label="Matériau" valeur={fiche.materiau} options={opt("materiau")} onChange={(v) => maj({ materiau: v })} />
          <Choix label="Ouverture" valeur={fiche.ouverture} options={opt("ouverture")} onChange={(v) => maj({ ouverture: v })} />
          <Choix label="Vantaux" valeur={fiche.vantaux} options={opt("vantaux")} onChange={(v) => maj({ vantaux: v })} />
          <Choix label="Vitrage" valeur={fiche.vitrage} options={opt("vitrage")} onChange={(v) => maj({ vitrage: v })} />
          <Bascule label="Couleur hors blanc" valeur={fiche.couleurHorsBlanc} onChange={(v) => maj({ couleurHorsBlanc: v })} />
          <Bascule label="Dépose de l'ancienne fenêtre" valeur={fiche.depose} onChange={(v) => maj({ depose: v })} />
          <Bascule label="Volet roulant" valeur={fiche.voletRoulant} onChange={(v) => maj({ voletRoulant: v })} />
        </div>
      );
  }
}
