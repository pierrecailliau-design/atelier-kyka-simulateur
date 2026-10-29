"use client";

import type { Famille } from "@/lib/fiche/schema";

/** Mini-guide replié « Comment mesurer ? », affiché quand une question porte sur une dimension. */
const GUIDES: Record<Famille, { titre: string; etapes: string[]; astuce: string }> = {
  dressing: {
    titre: "Mesurer l’emplacement du dressing",
    etapes: [
      "Largeur : d’un mur à l’autre (ou entre les deux limites prévues), au niveau du sol.",
      "Hauteur : du sol au plafond, au point le plus bas si le plafond n’est pas droit.",
      "Profondeur : l’espace disponible devant le mur. 60 cm est le standard pour des cintres.",
    ],
    astuce: "Mesurez en deux points et gardez la plus petite valeur : un mur est rarement parfaitement droit.",
  },
  placard: {
    titre: "Mesurer l’emplacement du placard",
    etapes: [
      "Largeur : entre les deux murs ou cloisons qui l’encadrent, au niveau du sol.",
      "Hauteur : du sol au plafond. Sous pente ou sous escalier, prenez la hauteur la plus haute et la plus basse.",
      "Profondeur : du fond du renfoncement jusqu’au nu du mur.",
    ],
    astuce: "Un placard sous escalier : notez aussi la longueur au sol, c’est elle qui compte pour le prix.",
  },
  cuisine: {
    titre: "Mesurer une cuisine",
    etapes: [
      "Meubles bas : additionnez la longueur de chaque pan de mur qui recevra des meubles, au sol.",
      "Meubles hauts : même chose pour les murs qui recevront des éléments en hauteur (0 si aucun).",
      "Pour un L ou un U, additionnez simplement les longueurs des côtés.",
    ],
    astuce: "Comptez l’emplacement du frigo et du four dans les longueurs : ils font partie de la cuisine.",
  },
  fenetre: {
    titre: "Mesurer une fenêtre",
    etapes: [
      "Largeur : d’un bord à l’autre de l’ouverture dans le mur (le « tableau »), à l’intérieur.",
      "Hauteur : du rebord (appui) jusqu’au haut de l’ouverture.",
      "Si vous remplacez une fenêtre existante, mesurez le cadre actuel, bord extérieur à bord extérieur.",
    ],
    astuce: "À 1 cm près, c’est suffisant pour l’estimation : nous relevons les cotes exactes lors de la visite.",
  },
};

export default function GuideMesure({ famille }: { famille?: Famille }) {
  const g = GUIDES[famille ?? "dressing"];
  return (
    <details className="group mt-5 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-[#8a5a2b] marker:text-stone-400">Comment mesurer ?</summary>
      <div className="mt-3 text-stone-700">
        <div className="font-medium text-stone-900">{g.titre}</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {g.etapes.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
        <p className="mt-3 rounded-xl bg-[#faf8f5] px-3 py-2 text-xs text-stone-600">{g.astuce}</p>
      </div>
    </details>
  );
}
