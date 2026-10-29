# Simulateur Atelier Kyka

Site où un client décrit son projet de menuiserie (dressing, placard, cuisine, fenêtre), obtient une vue 3D et une fourchette de prix, et laisse son contact (→ HubSpot). Cadrage complet dans le doc « Cadrage Simulateur Atelier Kyka ».

## État

- [x] Grille de prix : types, lecture du Google Sheet avec cache 10 min, grille de test embarquée (`src/lib/grille`)
- [x] Fiche projet : schéma zod des quatre familles, valeurs par défaut (`src/lib/fiche`)
- [x] Moteur de prix déterministe + 15 tests (`src/lib/prix`)
- [x] Écran 1-2 : prompt, exemples, questions ; extraction de la fiche par Claude (`/api/fiche`, outil structuré) avec repli heuristique sans clé IA (`src/lib/ia`)
- [x] Écran 3 : 3D paramétrique React Three Fiber pour les 4 familles + curseurs (`src/components/Scene3D.tsx`, `Controles.tsx`)
- [x] Écran 4 : formulaire contact → `/api/lead` → HubSpot (contact + transaction, pipeline « Simulateur Atelier Kyka »)
- [x] Écran 5 : estimation détaillée, « Être rappelé », « Modifier mon projet »
- [ ] Capture PNG du visuel jointe à la transaction HubSpot (la capture existe côté client, l'envoi reste à brancher)
- [ ] E-mail de récapitulatif au client (workflow HubSpot)
- [ ] Analytics par écran, Cloudflare Turnstile, mentions légales

## Lancer

```bash
npm install
npm test          # moteur de prix
npm run dev       # http://localhost:3000
```

Copier `.env.example` en `.env.local` et remplir les clés :

| Variable | Rôle | Sans elle |
|---|---|---|
| `ANTHROPIC_API_KEY` | Écran 2 : Claude lit le texte du client | mode heuristique (mots-clés + dimensions), questions pour le reste |
| `GRILLE_SHEET_ID` + `GOOGLE_API_KEY` | Lecture du Google Sheet des tarifs (partagé en lecture par lien) | grille de test embarquée |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Écran 4 : création contact + transaction | lead non transmis (log serveur), estimation affichée quand même |

Déploiement : Vercel, projet `simulateur-atelier-kyka` (équipe Pierre - Kyka Group). Les variables ci-dessus se renseignent dans Vercel → Settings → Environment Variables.

## Principe

```
texte du client → Claude → FicheProjet (JSON validé par zod) → estimer(fiche, grille) → fourchette
                                                            └→ 3D (même fiche)
                                                            └→ HubSpot (même fiche)
```

L'IA ne calcule jamais un prix : elle remplit la fiche, le moteur fait le reste. Deux clients qui décrivent le même meuble obtiennent le même prix.

## Grille de prix

Google Sheet « Atelier Kyka — Grille de prix simulateur (TEST) », trois onglets lus par le site : `Tarifs de base`, `Options`, `Règles`. Les clés (colonne jaune) ne se renomment pas ; les montants (bleu) se modifient librement. Une option présente dans la fiche mais absente de la grille coûte 0 et remonte dans `optionsNonChiffrees`.
