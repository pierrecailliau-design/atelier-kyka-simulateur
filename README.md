# Simulateur Atelier Kyka

Site où un client décrit son projet de menuiserie (dressing, placard, cuisine, fenêtre), obtient une vue 3D et une fourchette de prix, et laisse son contact (→ HubSpot). Cadrage complet dans le doc « Cadrage Simulateur Atelier Kyka ».

## État

- [x] Grille de prix : types, lecture du Google Sheet avec cache 10 min, grille de test embarquée (`src/lib/grille`)
- [x] Fiche projet : schéma zod des quatre familles, valeurs par défaut (`src/lib/fiche`)
- [x] Moteur de prix déterministe + 15 tests (`src/lib/prix`)
- [x] Écran 1-2 : prompt, exemples, questions ; extraction de la fiche par Claude (`/api/fiche`, outil structuré) avec repli heuristique sans clé IA (`src/lib/ia`)
- [x] Écran 3 : 3D paramétrique React Three Fiber pour les 4 familles + curseurs (`src/components/Scene3D.tsx`, `Controles.tsx`). Rendu showroom : matières par gamme (mélaminé, laqué satiné, chêne à veinage procédural), lumière d'atelier (Environment + ombres douces), parquet, chants arrondis, poignées fines, aménagement (cintres, linge, évier, plaque, four). Portes, tiroirs et vantaux s'ouvrent au clic (animation amortie), boutons « Tout ouvrir / Tout fermer ». Rendu à la demande (`frameloop="demand"`), léger sur mobile.
- [x] Écran 4 : formulaire contact → `/api/lead` → HubSpot (contact + transaction, pipeline « Simulateur Atelier Kyka »), visuel 3D (JPEG ≈ 30-100 Ko) joint à la transaction en note
- [x] Écran 5 : fourchette + liste de ce qui est compris (sans montants ni tarifs unitaires : la grille ne sort jamais du serveur, `src/lib/prix/client.ts`), « Être rappelé » avec créneau → `/api/rappel` → tâche d'appel HubSpot (échéance prochain jour ouvré), « Modifier mon projet »
- [x] Guide « Comment mesurer ? » sur l'écran des questions, page `/mentions-legales` (réserves entre crochets à compléter), Vercel Analytics (un événement par étape), limite de débit par IP sur les routes API
- [x] Placard sous pente / sous escalier dessiné avec le dessus en pente et des portes trapézoïdales ; vantail oscillo-battant qui bascule
- [x] Personnalisation sur mesure (v5) : dimensions au centimètre (saisie directe), finitions par gamme (3 mélaminés, 6 laques, 4 essences), poignées (noire, inox, laiton, sans), aménagement intérieur (mixte / penderie / étagères), crédence (assortie, blanche, carreaux), teinte des profils de fenêtre (5), petits-bois, champ « précision pour l'atelier » transmis à HubSpot. Récap des choix sur l'écran estimation. Tout est dans la fiche (`src/lib/fiche/schema.ts`), lu par l'IA, dessiné en 3D, résumé en clair dans la transaction HubSpot ; seul ce qui est dans la grille change le prix.
- [x] Mobile : 3D collée en haut pendant le réglage, cadrage de caméra adapté au format de l'écran, en-tête et pastilles revus
- [x] Favicon, icône iOS, image d'aperçu pour le partage (`src/app/icon.svg`, `apple-icon.png`, `opengraph-image.png`), métadonnées Open Graph (`NEXT_PUBLIC_SITE_URL`)
- [x] `npm run test:ia` : 30 phrases clients avec attendus → score ; `--heuristique` pour le mode sans clé (23/30 ; l'objectif 25/30 se mesure avec Claude)
- [ ] E-mail de récapitulatif au client (workflow HubSpot, déclenché à la création de la transaction)
- [ ] Cloudflare Turnstile si les robots passent la limite de débit

## Lancer

```bash
npm install
npm test          # moteur de prix, HubSpot (simulé), limite de débit, estimation client — 27 tests
npm run test:ia   # lecture IA sur 30 phrases (clé dans .env.local) ; écrit scripts/resultats-ia.md
npm run dev       # http://localhost:3000
```

Copier `.env.example` en `.env.local` et remplir les clés :

| Variable | Rôle | Sans elle |
|---|---|---|
| `ANTHROPIC_API_KEY` | Écran 2 : Claude lit le texte du client | mode heuristique (mots-clés + dimensions), questions pour le reste |
| `GRILLE_SHEET_ID` + `GOOGLE_API_KEY` | Lecture du Google Sheet des tarifs (partagé en lecture par lien) | grille de test embarquée |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Écrans 4-5 : contact, transaction, visuel joint, tâche de rappel | lead non transmis (log serveur), estimation affichée quand même |
| `HUBSPOT_OWNER_ID` | Qui reçoit les tâches de rappel (id utilisateur HubSpot) | tâche créée sans responsable |

Scopes du jeton HubSpot (application privée) : `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.write`, `files`.

Déploiement : Vercel, projet `simulateur-atelier-kyka` (équipe Pierre - Kyka Group), déploiement automatique à chaque push sur `main`. Les variables ci-dessus se renseignent dans Vercel → Settings → Environment Variables. Activer Web Analytics dans l'onglet Analytics du projet Vercel pour voir les événements `etape_*`, `estimation_affichee`, `rappel_demande`.

## Principe

```
texte du client → Claude → FicheProjet (JSON validé par zod) → estimer(fiche, grille) → fourchette
                                                            └→ 3D (même fiche)
                                                            └→ HubSpot (même fiche)
```

L'IA ne calcule jamais un prix : elle remplit la fiche, le moteur fait le reste. Deux clients qui décrivent le même meuble obtiennent le même prix.

## Grille de prix

Google Sheet « Atelier Kyka — Grille de prix simulateur (TEST) », trois onglets lus par le site : `Tarifs de base`, `Options`, `Règles`. Les clés (colonne jaune) ne se renomment pas ; les montants (bleu) se modifient librement. Une option présente dans la fiche mais absente de la grille coûte 0 et remonte dans `optionsNonChiffrees`.
