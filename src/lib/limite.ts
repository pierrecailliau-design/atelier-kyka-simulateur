/**
 * Limite de débit en mémoire, par adresse IP : protège les routes qui coûtent (appel IA, HubSpot).
 * Sur Vercel chaque instance a sa propre mémoire : c'est un garde-fou contre un script bête,
 * pas une défense absolue. Suffisant pour un simulateur grand public.
 */
const fenetres = new Map<string, { debut: number; appels: number }>();

export function adresseIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "inconnue";
}

/** Vrai si l'appel est autorisé ; faux si le quota (max appels par fenêtre de `dureeS` secondes) est dépassé. */
export function autoriser(cle: string, max: number, dureeS: number): boolean {
  const maintenant = Date.now();
  const f = fenetres.get(cle);
  if (!f || maintenant - f.debut > dureeS * 1000) {
    fenetres.set(cle, { debut: maintenant, appels: 1 });
    if (fenetres.size > 5000) {
      for (const [k, v] of fenetres) if (maintenant - v.debut > dureeS * 1000) fenetres.delete(k);
    }
    return true;
  }
  f.appels += 1;
  return f.appels <= max;
}

export const reponseTropDAppels = () => Response.json({ erreur: "Trop de demandes d’un coup, réessayez dans quelques minutes." }, { status: 429 });
