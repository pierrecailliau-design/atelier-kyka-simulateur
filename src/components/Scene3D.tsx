"use client";

/**
 * Écran 3 : vue 3D paramétrique. Même fiche que le moteur de prix : rien n'apparaît ici qui ne soit pas chiffré.
 * Géométrie volontairement « schéma propre » : caissons, portes, aménagement, pas de photoréalisme (phase 4).
 */
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import type { FicheCuisine, FicheDressing, FicheFenetre, FichePlacard, FicheProjet } from "@/lib/fiche/schema";

const E = 0.019; // épaisseur de panneau

const COULEUR_GAMME = { essentiel: "#f1efe9", confort: "#d9d3c8", premium: "#d2a877" } as const;
const COULEUR_PLAN = { stratifie: "#cfcbc3", bois: "#a86f3f", quartz: "#f2f1ed" } as const;
const COULEUR_FENETRE = { pvc: "#f4f4f2", aluminium: "#8d9298", bois: "#b4804c" } as const;

function Panneau({
  position,
  taille,
  couleur,
  rugosite = 0.55,
  metal = 0,
}: {
  position: [number, number, number];
  taille: [number, number, number];
  couleur: string;
  rugosite?: number;
  metal?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={taille} />
      <meshStandardMaterial color={couleur} roughness={rugosite} metalness={metal} />
    </mesh>
  );
}

function Poignee({ position, vertical = true }: { position: [number, number, number]; vertical?: boolean }) {
  return (
    <mesh position={position} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.006, 0.006, 0.16, 12]} />
      <meshStandardMaterial color="#6b6b6b" metalness={0.8} roughness={0.3} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ dressing / placard */
function Rangement({ fiche }: { fiche: FicheDressing | FichePlacard }) {
  const W = fiche.largeurM;
  const H = fiche.hauteurM;
  const P = fiche.profondeurM;
  const couleur = COULEUR_GAMME[fiche.gamme];
  const portes = fiche.famille === "dressing" ? fiche.facade : fiche.portes;
  const miroirs = fiche.famille === "dressing" ? fiche.miroirPortes : 0;
  const led = fiche.famille === "dressing" ? fiche.eclairageLed : false;
  const tiroirs = fiche.tiroirs;

  const n = Math.max(1, Math.round(W / 0.6));
  const sw = (W - 2 * E) / n;
  const plinthe = 0.08;

  const interieur = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let tiroirsRestants = tiroirs;
    for (let i = 0; i < n; i++) {
      const cx = -W / 2 + E + sw * (i + 0.5);
      if (i > 0) {
        elements.push(<Panneau key={`div${i}`} position={[-W / 2 + E + sw * i, H / 2, 0]} taille={[E, H - 2 * E, P - E]} couleur={couleur} />);
      }
      const penderie = i % 2 === 0;
      if (penderie) {
        elements.push(
          <mesh key={`tringle${i}`} position={[cx, H * 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, sw - E, 16]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.7} roughness={0.3} />
          </mesh>,
        );
        elements.push(<Panneau key={`tab${i}`} position={[cx, H * 0.78 + 0.1, 0]} taille={[sw - E, E, P - 2 * E]} couleur={couleur} />);
      } else {
        const nb = 4;
        for (let k = 1; k <= nb; k++) {
          elements.push(<Panneau key={`etag${i}-${k}`} position={[cx, plinthe + ((H - plinthe - 0.2) * k) / (nb + 1) + 0.2, 0]} taille={[sw - E, E, P - 2 * E]} couleur={couleur} />);
        }
      }
      // tiroirs en bas de section, 0.18 de haut, jusqu'à 3 par section
      const dansSection = Math.min(3, tiroirsRestants);
      for (let t = 0; t < dansSection; t++) {
        elements.push(
          <group key={`tiroir${i}-${t}`}>
            <Panneau position={[cx, plinthe + 0.09 + t * 0.19, P / 2 - E * 2]} taille={[sw - E - 0.01, 0.17, E]} couleur={couleur} rugosite={0.4} />
            <Poignee position={[cx, plinthe + 0.09 + t * 0.19, P / 2 - E]} vertical={false} />
          </group>,
        );
      }
      tiroirsRestants -= dansSection;
    }
    return elements;
  }, [W, H, P, n, sw, couleur, tiroirs]);

  const facades = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const zPorte = P / 2 + E / 2;
    const hPorte = H - plinthe - E;
    const yPorte = plinthe + hPorte / 2;
    const materiauPorte = (index: number) =>
      index < miroirs
        ? { couleur: "#dde6ee", rugosite: 0.05, metal: 0.9 }
        : { couleur, rugosite: 0.45, metal: 0 };

    // La première porte est montrée ouverte : le client voit l'aménagement qu'il paie.
    if (portes === "battant") {
      for (let i = 0; i < n; i++) {
        const cx = -W / 2 + E + sw * (i + 0.5);
        const m = materiauPorte(i);
        if (i === 0) {
          // charnière à gauche, porte ouverte à ~75°
          const charniere = -W / 2 + E;
          elements.push(
            <group key={`pb${i}`} position={[charniere, 0, zPorte]} rotation={[0, -1.3, 0]}>
              <Panneau position={[(sw - 0.006) / 2, yPorte, 0]} taille={[sw - 0.006, hPorte, E]} {...m} />
              <Poignee position={[sw - 0.05, H * 0.5, E]} />
            </group>,
          );
          continue;
        }
        elements.push(<Panneau key={`pb${i}`} position={[cx, yPorte, zPorte]} taille={[sw - 0.006, hPorte, E]} {...m} />);
        const cote = i % 2 === 0 ? 1 : -1;
        elements.push(<Poignee key={`pg${i}`} position={[cx + cote * (sw / 2 - 0.05), H * 0.5, zPorte + E]} />);
      }
    } else if (portes === "coulissant") {
      const np = W > 2.4 ? 3 : 2;
      const pas = (W - 2 * E) / np;
      const wp = pas + 0.03;
      for (let i = 0; i < np; i++) {
        // le premier panneau est glissé devant le deuxième : la première section apparaît
        const decalage = i === 0 ? pas * 0.9 : 0;
        const cx = -W / 2 + E + pas * (i + 0.5) + decalage;
        const z = zPorte + (i % 2 === 0 ? E + 0.006 : 0);
        const m = materiauPorte(i);
        elements.push(<Panneau key={`pc${i}`} position={[cx, yPorte, z]} taille={[wp, hPorte, E]} {...m} />);
        elements.push(<Poignee key={`pcg${i}`} position={[cx + (i % 2 === 0 ? -1 : 1) * (wp / 2 - 0.06), H * 0.5, z + E]} />);
      }
      elements.push(<Panneau key="rail" position={[0, H - E / 2, zPorte + E]} taille={[W, E, 2 * E + 0.012]} couleur="#8f8f8f" metal={0.6} rugosite={0.3} />);
    } else if (portes === "pliant") {
      for (let i = 0; i < n; i++) {
        const cx = -W / 2 + E + sw * (i + 0.5);
        const m = materiauPorte(i);
        const demi = (sw - 0.012) / 2;
        elements.push(<Panneau key={`pp${i}a`} position={[cx - demi / 2 - 0.003, yPorte, zPorte]} taille={[demi, hPorte, E]} {...m} />);
        elements.push(<Panneau key={`pp${i}b`} position={[cx + demi / 2 + 0.003, yPorte, zPorte]} taille={[demi, hPorte, E]} {...m} />);
        elements.push(<Poignee key={`ppg${i}`} position={[cx + demi - 0.05, H * 0.5, zPorte + E]} />);
      }
    }
    return elements;
  }, [portes, n, sw, W, H, P, couleur, miroirs]);

  return (
    <group>
      {/* caisson */}
      <Panneau position={[-W / 2 + E / 2, H / 2, 0]} taille={[E, H, P]} couleur={couleur} />
      <Panneau position={[W / 2 - E / 2, H / 2, 0]} taille={[E, H, P]} couleur={couleur} />
      <Panneau position={[0, H - E / 2, 0]} taille={[W, E, P]} couleur={couleur} />
      <Panneau position={[0, plinthe + E / 2, 0]} taille={[W - 2 * E, E, P]} couleur={couleur} />
      <Panneau position={[0, plinthe / 2, -0.03]} taille={[W - 2 * E, plinthe, P - 0.06]} couleur="#3b3734" />
      <Panneau position={[0, H / 2, -P / 2 + E / 2]} taille={[W - 2 * E, H - 2 * E, E]} couleur={couleur} />
      {interieur}
      {facades}
      {led && (
        <>
          <mesh position={[0, H - E - 0.01, P / 2 - 0.05]}>
            <boxGeometry args={[W - 2 * E, 0.012, 0.02]} />
            <meshStandardMaterial color="#fff2cc" emissive="#ffd98a" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0, H - 0.1, P / 2]} intensity={1.2} distance={2.5} color="#ffe2a8" />
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ cuisine */
function RangeeCuisine({
  longueur,
  longueurHaut,
  gamme,
  plan,
  tiroirs,
}: {
  longueur: number;
  longueurHaut: number;
  gamme: FicheCuisine["gamme"];
  plan: FicheCuisine["planTravail"];
  tiroirs: number;
}) {
  const couleur = COULEUR_GAMME[gamme];
  const nb = Math.max(1, Math.round(longueur / 0.6));
  const w = longueur / nb;
  const hBas = 0.85;
  const prof = 0.6;
  const nbHaut = Math.max(0, Math.round(longueurHaut / 0.6));
  const wHaut = nbHaut ? longueurHaut / nbHaut : 0;
  return (
    <group>
      <Panneau position={[longueur / 2, 0.05, -0.03]} taille={[longueur, 0.1, prof - 0.06]} couleur="#3b3734" />
      {Array.from({ length: nb }, (_, i) => {
        const cx = w * (i + 0.5);
        const tiroir = i < tiroirs;
        return (
          <group key={`bas${i}`}>
            <Panneau position={[cx, 0.1 + (hBas - 0.1) / 2, 0]} taille={[w - 0.004, hBas - 0.1, prof]} couleur={couleur} />
            {tiroir ? (
              [0, 1, 2].map((t) => (
                <group key={t}>
                  <Panneau position={[cx, 0.1 + 0.125 + t * 0.25, prof / 2 + E / 2]} taille={[w - 0.012, 0.24, E]} couleur={couleur} rugosite={0.4} />
                  <Poignee position={[cx, 0.1 + 0.125 + t * 0.25 + 0.08, prof / 2 + E * 1.2]} vertical={false} />
                </group>
              ))
            ) : (
              <>
                <Panneau position={[cx, 0.1 + (hBas - 0.1) / 2, prof / 2 + E / 2]} taille={[w - 0.012, hBas - 0.11, E]} couleur={couleur} rugosite={0.4} />
                <Poignee position={[cx + (i % 2 === 0 ? 1 : -1) * (w / 2 - 0.05), hBas - 0.12, prof / 2 + E * 1.2]} vertical={false} />
              </>
            )}
          </group>
        );
      })}
      <Panneau position={[longueur / 2, hBas + 0.02, 0.015]} taille={[longueur + 0.02, 0.04, prof + 0.03]} couleur={COULEUR_PLAN[plan]} rugosite={plan === "quartz" ? 0.15 : 0.6} />
      {Array.from({ length: nbHaut }, (_, i) => {
        const cx = wHaut * (i + 0.5);
        return (
          <group key={`haut${i}`}>
            <Panneau position={[cx, 1.8, -prof / 2 + 0.175]} taille={[wHaut - 0.004, 0.7, 0.35]} couleur={couleur} />
            <Panneau position={[cx, 1.8, -prof / 2 + 0.35 + E / 2]} taille={[wHaut - 0.012, 0.69, E]} couleur={couleur} rugosite={0.4} />
            <Poignee position={[cx + (i % 2 === 0 ? 1 : -1) * (wHaut / 2 - 0.05), 1.52, -prof / 2 + 0.35 + E * 1.2]} vertical={false} />
          </group>
        );
      })}
    </group>
  );
}

function Cuisine({ fiche }: { fiche: FicheCuisine }) {
  const L = fiche.longueurBasM;
  const LH = fiche.longueurHautM;
  const couleur = COULEUR_GAMME[fiche.gamme];
  const parts =
    fiche.implantation === "U" ? [0.4, 0.2, 0.4] : fiche.implantation === "L" ? [0.6, 0.4] : [1];
  const longueurs = parts.map((p) => L * p);
  const hauts = parts.map((p) => LH * p);
  const colonnes = fiche.colonnes;
  const ilot = fiche.implantation === "ilot";
  const longueurIlot = Math.min(2.4, Math.max(1.2, L * 0.4));

  return (
    <group position={[-longueurs[0] / 2, 0, 0]}>
      {/* rangée principale le long de x */}
      <RangeeCuisine longueur={longueurs[0]} longueurHaut={hauts[0]} gamme={fiche.gamme} plan={fiche.planTravail} tiroirs={fiche.tiroirs} />
      {/* retour gauche (L et U) : part du coin gauche vers l'avant */}
      {longueurs[1] !== undefined && (
        <group position={[0, 0, 0.6]} rotation={[0, Math.PI / 2, 0]}>
          <RangeeCuisine longueur={longueurs[1]} longueurHaut={hauts[1]} gamme={fiche.gamme} plan={fiche.planTravail} tiroirs={0} />
        </group>
      )}
      {/* retour droit (U) */}
      {longueurs[2] !== undefined && (
        <group position={[longueurs[0], 0, 0.6 + longueurs[2]]} rotation={[0, -Math.PI / 2, 0]}>
          <RangeeCuisine longueur={longueurs[2]} longueurHaut={hauts[2]} gamme={fiche.gamme} plan={fiche.planTravail} tiroirs={0} />
        </group>
      )}
      {ilot && (
        <group position={[longueurs[0] / 2 - longueurIlot / 2, 0, 1.5]}>
          <RangeeCuisine longueur={longueurIlot} longueurHaut={0} gamme={fiche.gamme} plan={fiche.planTravail} tiroirs={0} />
        </group>
      )}
      {Array.from({ length: colonnes }, (_, i) => (
        <group key={`col${i}`}>
          <Panneau position={[longueurs[0] + 0.3 + i * 0.6, 1.1, 0]} taille={[0.6, 2.2, 0.6]} couleur={couleur} />
          <Panneau position={[longueurs[0] + 0.3 + i * 0.6, 1.1, 0.3 + E / 2]} taille={[0.588, 2.19, E]} couleur={couleur} rugosite={0.4} />
          <Poignee position={[longueurs[0] + 0.3 + i * 0.6 - 0.24, 1.1, 0.3 + E * 1.2]} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ fenêtre */
function Fenetre({ fiche }: { fiche: FicheFenetre }) {
  const W = fiche.largeurM;
  const H = fiche.hauteurM;
  const couleur = fiche.couleurHorsBlanc && fiche.materiau !== "bois" ? "#3d4247" : COULEUR_FENETRE[fiche.materiau];
  const metal = fiche.materiau === "aluminium" ? 0.5 : 0;
  const yBas = 0.9; // allège
  const cadre = 0.07;
  const prof = 0.08;
  const murEp = 0.22;
  const mur = "#ece7df";
  const nv = fiche.vantaux;
  const wv = (W - 2 * cadre) / nv;
  return (
    <group>
      {/* mur autour de l'ouverture */}
      <Panneau position={[0, yBas / 2, -murEp / 2]} taille={[W + 2.6, yBas, murEp]} couleur={mur} rugosite={0.95} />
      <Panneau position={[0, yBas + H + (0.6 + (fiche.voletRoulant ? 0.2 : 0)) / 2, -murEp / 2]} taille={[W + 2.6, 0.6 + (fiche.voletRoulant ? 0.2 : 0), murEp]} couleur={mur} rugosite={0.95} />
      <Panneau position={[-W / 2 - 0.65, yBas + H / 2, -murEp / 2]} taille={[1.3, H, murEp]} couleur={mur} rugosite={0.95} />
      <mesh position={[0, yBas + H / 2, -murEp - 0.01]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#7f98ab" roughness={1} />
      </mesh>
      <Panneau position={[W / 2 + 0.65, yBas + H / 2, -murEp / 2]} taille={[1.3, H, murEp]} couleur={mur} rugosite={0.95} />
      {/* appui */}
      <Panneau position={[0, yBas - 0.02, 0.04]} taille={[W + 0.1, 0.04, 0.3]} couleur="#d8d4cc" />
      {/* dormant */}
      <Panneau position={[0, yBas + cadre / 2, -murEp / 2]} taille={[W, cadre, prof]} couleur={couleur} metal={metal} />
      <Panneau position={[0, yBas + H - cadre / 2, -murEp / 2]} taille={[W, cadre, prof]} couleur={couleur} metal={metal} />
      <Panneau position={[-W / 2 + cadre / 2, yBas + H / 2, -murEp / 2]} taille={[cadre, H, prof]} couleur={couleur} metal={metal} />
      <Panneau position={[W / 2 - cadre / 2, yBas + H / 2, -murEp / 2]} taille={[cadre, H, prof]} couleur={couleur} metal={metal} />
      {/* vantaux */}
      {Array.from({ length: nv }, (_, i) => {
        const cx = -W / 2 + cadre + wv * (i + 0.5);
        const hv = H - 2 * cadre;
        const b = 0.05;
        const z = -murEp / 2 + 0.02;
        return (
          <group key={`v${i}`}>
            <Panneau position={[cx, yBas + cadre + b / 2, z]} taille={[wv, b, 0.06]} couleur={couleur} metal={metal} />
            <Panneau position={[cx, yBas + H - cadre - b / 2, z]} taille={[wv, b, 0.06]} couleur={couleur} metal={metal} />
            <Panneau position={[cx - wv / 2 + b / 2, yBas + H / 2, z]} taille={[b, hv, 0.06]} couleur={couleur} metal={metal} />
            <Panneau position={[cx + wv / 2 - b / 2, yBas + H / 2, z]} taille={[b, hv, 0.06]} couleur={couleur} metal={metal} />
            <mesh position={[cx, yBas + H / 2, z]}>
              <boxGeometry args={[wv - 2 * b, hv - 2 * b, 0.02]} />
              <meshStandardMaterial color="#bcd6e6" transparent opacity={0.28} roughness={0.05} metalness={0.2} />
            </mesh>
            {fiche.ouverture !== "fixe" && (
              <Poignee position={[cx + (i === 0 ? 1 : -1) * (wv / 2 - b - 0.03), yBas + H / 2, z + 0.05]} />
            )}
          </group>
        );
      })}
      {fiche.voletRoulant && <Panneau position={[0, yBas + H + 0.1, -murEp / 2 + 0.02]} taille={[W + 0.1, 0.2, 0.2]} couleur={couleur} metal={metal} />}
    </group>
  );
}

/* ------------------------------------------------------------------ scène */
function encombrement(fiche: FicheProjet): { w: number; h: number; cibleY: number } {
  switch (fiche.famille) {
    case "cuisine":
      return { w: Math.max(fiche.longueurBasM * 0.85 + fiche.colonnes * 0.6 + 0.6, 3), h: 2.4, cibleY: 1.0 };
    case "fenetre":
      return { w: fiche.largeurM + 1.2, h: fiche.hauteurM + 1.2, cibleY: 0.9 + fiche.hauteurM / 2 };
    default:
      return { w: fiche.largeurM, h: fiche.hauteurM, cibleY: fiche.hauteurM / 2 };
  }
}

function Camera({ fiche }: { fiche: FicheProjet }) {
  const { camera } = useThree();
  const { w, h, cibleY } = encombrement(fiche);
  useEffect(() => {
    const d = Math.max(w, h) * 1.15 + 1.2;
    camera.position.set(d * 0.55, cibleY + h * 0.35, d * 0.95);
    camera.lookAt(0, cibleY, 0);
    camera.updateProjectionMatrix();
  }, [camera, w, h, cibleY]);
  return <OrbitControls target={[0, cibleY, 0]} enablePan={false} minDistance={1.2} maxDistance={14} maxPolarAngle={Math.PI / 2 - 0.02} />;
}

/** Capture de la vue courante, réduite à 1 200 px de large en JPEG (≈ 100 Ko) pour la joindre au lead HubSpot. */
function Capture({ onReady }: { onReady?: (capture: () => string) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady?.(() => {
      gl.render(scene, camera);
      const source = gl.domElement;
      const largeur = Math.min(1200, source.width);
      const hauteur = Math.round((source.height * largeur) / source.width);
      const cible = document.createElement("canvas");
      cible.width = largeur;
      cible.height = hauteur;
      const ctx = cible.getContext("2d");
      if (!ctx) return source.toDataURL("image/jpeg", 0.85);
      ctx.fillStyle = "#f7f4ef";
      ctx.fillRect(0, 0, largeur, hauteur);
      ctx.drawImage(source, 0, 0, largeur, hauteur);
      return cible.toDataURL("image/jpeg", 0.85);
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

export default function Scene3D({ fiche, onReady }: { fiche: FicheProjet; onReady?: (capture: () => string) => void }) {
  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 42, near: 0.05, far: 60 }} dpr={[1, 1.75]}>
      <color attach="background" args={["#f7f4ef"]} />
      <hemisphereLight args={["#ffffff", "#b9b2a6", 0.75]} />
      <directionalLight position={[3, 5.5, 4]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />
      {/* sol */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e6e0d6" roughness={0.9} />
      </mesh>
      {fiche.famille !== "fenetre" && (
        <mesh position={[0, 1.6, fiche.famille === "cuisine" ? -0.31 : -fiche.profondeurM / 2 - 0.02]} receiveShadow>
          <planeGeometry args={[40, 3.2]} />
          <meshStandardMaterial color="#efeae2" roughness={0.95} />
        </mesh>
      )}
      {fiche.famille === "dressing" || fiche.famille === "placard" ? (
        <Rangement fiche={fiche} />
      ) : fiche.famille === "cuisine" ? (
        <Cuisine fiche={fiche} />
      ) : (
        <Fenetre fiche={fiche} />
      )}
      <Camera fiche={fiche} />
      <Capture onReady={onReady} />
    </Canvas>
  );
}
