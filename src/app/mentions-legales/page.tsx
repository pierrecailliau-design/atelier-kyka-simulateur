import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales — Simulateur Atelier Kyka",
  robots: { index: false },
};

/**
 * Page à compléter avant mise en ligne publique : les champs entre crochets sont des réserves.
 * Au Portugal, un site commercial doit indiquer la dénomination, le siège, le NIF/NIPC
 * et un contact ; le RGPD impose d'expliquer ce que deviennent les données du formulaire.
 */
const SOCIETE = {
  nom: "[Dénomination sociale d’Atelier Kyka, Lda.]",
  nipc: "[NIPC / NIF]",
  siege: "[Adresse du siège], Porto, Portugal",
  email: "[contact@atelierkyka.pt]",
  telephone: "[+351 …]",
  hebergeur: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com)",
};

export default function MentionsLegales() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-[#8a5a2b] hover:underline">
        ← Retour au simulateur
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-stone-900">Mentions légales et données personnelles</h1>

      <section className="mt-8 space-y-2 text-stone-700">
        <h2 className="text-lg font-semibold text-stone-900">Éditeur du site</h2>
        <p>
          {SOCIETE.nom}, société de menuiserie sur mesure, {SOCIETE.siege}. NIPC {SOCIETE.nipc}.
        </p>
        <p>
          Contact : {SOCIETE.email} · {SOCIETE.telephone}
        </p>
        <p>Hébergement : {SOCIETE.hebergeur}.</p>
      </section>

      <section className="mt-8 space-y-2 text-stone-700">
        <h2 className="text-lg font-semibold text-stone-900">Ce que fait le simulateur de vos données</h2>
        <p>
          La description de votre projet et vos réglages servent uniquement à dessiner le projet et à calculer une estimation indicative. Le texte que vous saisissez peut être analysé par un service d’intelligence artificielle (Anthropic) pour en extraire les
          dimensions et les options ; il n’est pas utilisé pour entraîner des modèles.
        </p>
        <p>
          Quand vous laissez votre prénom, votre e-mail et votre téléphone, nous les enregistrons avec votre projet, son estimation et le visuel 3D dans notre outil de gestion client (HubSpot), afin de vous rappeler et de préparer un devis. Nous ne les
          transmettons à personne d’autre et ne vous envoyons pas de publicité.
        </p>
        <p>Ces données sont conservées trois ans après notre dernier échange, puis supprimées.</p>
        <p>
          Vous pouvez à tout moment demander à consulter, corriger ou supprimer vos données en écrivant à {SOCIETE.email}. Vous pouvez aussi saisir la CNPD (Comissão Nacional de Proteção de Dados, cnpd.pt).
        </p>
        <p>Le site n’utilise pas de cookies publicitaires. Une mesure d’audience anonyme (Vercel Analytics, sans cookie) nous indique à quelle étape les visiteurs s’arrêtent.</p>
      </section>

      <section className="mt-8 space-y-2 text-stone-700">
        <h2 className="text-lg font-semibold text-stone-900">Portée de l’estimation</h2>
        <p>
          L’estimation affichée est indicative, calculée à partir de votre description et de notre grille tarifaire du moment. Elle ne vaut pas devis. Le prix définitif est établi après visite technique et figure sur le devis signé.
        </p>
      </section>
    </main>
  );
}
