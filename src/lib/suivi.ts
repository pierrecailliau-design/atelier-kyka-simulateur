/**
 * Suivi d'usage anonyme (Vercel Web Analytics) : un événement par étape franchie, pour voir où
 * les visiteurs décrochent. Jamais de donnée personnelle ni de prix dans les propriétés.
 * Hors Vercel (local, tests), `track` ne fait rien.
 */
import { track } from "@vercel/analytics";

type Valeur = string | number | boolean;

export function suivre(evenement: string, proprietes?: Record<string, Valeur | undefined>) {
  try {
    const propres: Record<string, Valeur> = {};
    for (const [k, v] of Object.entries(proprietes ?? {})) if (v !== undefined) propres[k] = v;
    track(evenement, propres);
  } catch {
    // Le suivi ne doit jamais casser le parcours.
  }
}
