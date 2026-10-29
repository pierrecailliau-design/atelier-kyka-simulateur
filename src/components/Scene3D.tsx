"use client";

/**
 * Écran 3 : vue 3D paramétrique. Même fiche que le moteur de prix : rien n'apparaît ici qui ne soit pas chiffré.
 * Rendu « showroom » : matières par gamme, lumière d'atelier, chants arrondis, pièce autour. Portes, tiroirs et
 * vantaux s'ouvrent au clic (animation amortie). Pas de photoréalisme (phase 4).
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, SoftShadows, useCursor } from "@react-three/drei";
import { easing } from "maath";
import * as THREE from "three";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FicheCuisine, FicheDressing, FicheFenetre, FichePlacard, FicheProjet } from "@/lib/fiche/schema";

type Gamme = FicheDressing["gamme"];
const E = 0.019; // épaisseur de panneau
const ACCENT = "#8a5a2b";

/* ------------------------------------------------------------------ ouverture au clic */
type Ouverture = { estOuvert: (id: string, suitTout?: boolean) => boolean; basculer: (id: string, suitTout?: boolean) => void };
const OuvertureContext = createContext<Ouverture>({ estOuvert: () => false, basculer: () => {} });
const SurvolContext = createContext(false);

/**
 * Élément mobile (porte, tiroir, vantail). `appliquer(t)` reçoit l'avancement 0 (fermé) → 1 (ouvert),
 * amorti à chaque image, et place les groupes que l'appelant tient par ref.
 * `suitTout` = false : « Tout ouvrir » ne le bouge pas (panneau coulissant qui doit rester en place).
 */
function Mobile({ id, appliquer, children, suitTout = true }: { id: string; appliquer: (t: number) => void; children: React.ReactNode; suitTout?: boolean }) {
  const { estOuvert, basculer } = useContext(OuvertureContext);
  const invalidate = useThree((s) => s.invalidate);
  const [survol, setSurvol] = useState(false);
  useCursor(survol);
  const cible = estOuvert(id, suitTout) ? 1 : 0;
  const etat = useRef({ t: cible });
  // La scène ne se redessine qu'à la demande : on relance le rendu tant que l'animation court.
  useEffect(() => invalidate(), [cible, invalidate]);
  useFrame((_, dt) => {
    const encore = easing.damp(etat.current, "t", cible, 0.28, Math.min(dt, 0.05));
    appliquer(etat.current.t);
    if (encore) invalidate();
  });
  const clic = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // c'était une rotation de la vue, pas un clic
    e.stopPropagation();
    basculer(id, suitTout);
  };
  return (
    <group
      onClick={clic}
      onPointerOver={(e) => {
        e.stopPropagation();
        setSurvol(true);
      }}
      onPointerOut={() => setSurvol(false)}
    >
      <SurvolContext.Provider value={survol}>{children}</SurvolContext.Provider>
    </group>
  );
}

/* ------------------------------------------------------------------ textures procédurales (aucun fichier à charger) */
function alea(graine: number) {
  let s = graine >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

let _bois: THREE.CanvasTexture | null = null;
function textureBois() {
  if (_bois) return _bois;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const r = alea(7);
  ctx.fillStyle = "#dcc5a0";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(255,240,215,${0.05 + r() * 0.1})`;
    ctx.fillRect(r() * 512, 0, 12 + r() * 50, 512);
  }
  for (let i = 0; i < 140; i++) {
    const x = r() * 512;
    ctx.strokeStyle = `rgba(125,88,52,${0.03 + r() * 0.1})`;
    ctx.lineWidth = 0.6 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const phase = r() * 6.28;
    const amp = 2 + r() * 6;
    for (let y = 0; y <= 512; y += 24) ctx.lineTo(x + Math.sin((y / 512) * 6.28 + phase) * amp, y);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  _bois = t;
  return t;
}

let _parquet: THREE.CanvasTexture | null = null;
function textureParquet() {
  if (_parquet) return _parquet;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  const r = alea(11);
  const tons = ["#d9bf9b", "#d2b58f", "#cfb48d", "#dcc3a1", "#c9ab84", "#d6ba95"];
  const h = 32;
  for (let y = 0; y < 1024; y += h) {
    let x = -Math.floor(r() * 300);
    while (x < 1024) {
      const l = 220 + Math.floor(r() * 220);
      ctx.fillStyle = tons[Math.floor(r() * tons.length)];
      ctx.fillRect(x, y, l, h);
      ctx.fillStyle = "rgba(90,60,30,0.25)";
      ctx.fillRect(x, y, 2, h);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(120,85,50,${0.04 + r() * 0.08})`;
        ctx.fillRect(x + 4, y + 2 + r() * (h - 4), l - 8, 1);
      }
      x += l;
    }
    ctx.fillStyle = "rgba(90,60,30,0.28)";
    ctx.fillRect(0, y, 1024, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(6, 6);
  _parquet = t;
  return t;
}

let _ciel: THREE.CanvasTexture | null = null;
function textureCiel() {
  if (_ciel) return _ciel;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#9fc3dc");
  g.addColorStop(0.55, "#dbe9f1");
  g.addColorStop(0.62, "#b9c9a0");
  g.addColorStop(1, "#8da875");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _ciel = t;
  return t;
}

/* ------------------------------------------------------------------ matières */
type Finition = { gamme?: Gamme; couleur?: string; rugosite?: number; metal?: number; miroir?: boolean };

function Matiere({ gamme, couleur, rugosite, metal, miroir }: Finition) {
  const survol = useContext(SurvolContext);
  const emissive = survol ? ACCENT : "#000000";
  const ei = survol ? 0.16 : 0;
  if (miroir) return <meshStandardMaterial color="#dfe7ec" roughness={0.06} metalness={0.85} envMapIntensity={1.4} emissive={emissive} emissiveIntensity={ei} />;
  if (gamme === "premium") return <meshStandardMaterial map={textureBois()} color="#f6ecdc" roughness={0.48} emissive={emissive} emissiveIntensity={ei} />;
  if (gamme === "confort") return <meshPhysicalMaterial color="#d8d1c4" roughness={0.26} clearcoat={0.55} clearcoatRoughness={0.22} emissive={emissive} emissiveIntensity={ei} />;
  if (gamme === "essentiel") return <meshStandardMaterial color="#f4f2ed" roughness={0.72} emissive={emissive} emissiveIntensity={ei} />;
  return <meshStandardMaterial color={couleur ?? "#cccccc"} roughness={rugosite ?? 0.6} metalness={metal ?? 0} emissive={emissive} emissiveIntensity={ei} />;
}

function Panneau({
  position,
  rotation,
  taille,
  arrondi = 0.004,
  ...finition
}: Finition & { position: [number, number, number]; rotation?: [number, number, number]; taille: [number, number, number]; arrondi?: number }) {
  const r = Math.max(0.0005, Math.min(arrondi, Math.min(...taille) / 2 - 0.0005));
  return (
    <RoundedBox args={taille} radius={r} smoothness={2} position={position} rotation={rotation} castShadow receiveShadow>
      <Matiere {...finition} />
    </RoundedBox>
  );
}

/** Poignée barre fine noire, moderne. */
function Poignee({ position, vertical = true, longueur = 0.18 }: { position: [number, number, number]; vertical?: boolean; longueur?: number }) {
  return (
    <group position={position} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <mesh position={[0, 0, 0.018]} castShadow>
        <boxGeometry args={[0.011, longueur, 0.011]} />
        <meshStandardMaterial color="#26262a" metalness={0.7} roughness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (longueur / 2 - 0.02), 0.008]}>
          <boxGeometry args={[0.009, 0.009, 0.016]} />
          <meshStandardMaterial color="#26262a" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ éléments mobiles */
/** Porte battante : charnière à gauche (`cote` = 1) ou à droite (-1), ouvre vers le spectateur. */
function Battante({ id, charniere, largeur, hauteur, y, z, cote, finition, angle = 1.6, poignee = true }: { id: string; charniere: number; largeur: number; hauteur: number; y: number; z: number; cote: 1 | -1; finition: Finition; angle?: number; poignee?: boolean }) {
  const g = useRef<THREE.Group>(null);
  return (
    <Mobile id={id} appliquer={(t) => g.current && (g.current.rotation.y = -cote * t * angle)}>
      <group ref={g} position={[charniere, 0, z]}>
        <Panneau position={[(cote * largeur) / 2, y, 0]} taille={[largeur, hauteur, E]} {...finition} />
        {poignee && <Poignee position={[cote * (largeur - 0.06), y, E / 2]} />}
      </group>
    </Mobile>
  );
}

/** Porte pliante (deux vantaux articulés) : charnière à gauche (`cote` = 1) ou à droite (-1). */
function Pliante({ id, charniere, largeur, hauteur, y, z, cote, finition }: { id: string; charniere: number; largeur: number; hauteur: number; y: number; z: number; cote: 1 | -1; finition: Finition }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const demi = (largeur - 0.006) / 2;
  const angle = 1.5;
  return (
    <Mobile
      id={id}
      appliquer={(t) => {
        if (a.current) a.current.rotation.y = -cote * t * angle;
        if (b.current) b.current.rotation.y = cote * t * angle * 2;
      }}
    >
      <group ref={a} position={[charniere, 0, z]}>
        <Panneau position={[(cote * demi) / 2, y, 0]} taille={[demi, hauteur, E]} {...finition} />
        <group ref={b} position={[cote * (demi + 0.006), 0, 0]}>
          <Panneau position={[(cote * demi) / 2, y, 0]} taille={[demi, hauteur, E]} {...finition} />
          <Poignee position={[cote * 0.05, y, E / 2]} />
        </group>
      </group>
    </Mobile>
  );
}

/** Panneau coulissant : glisse de `course` (signée) devant son voisin. */
function Coulissante({ id, x, y, z, largeur, hauteur, course, finition, suitTout }: { id: string; x: number; y: number; z: number; largeur: number; hauteur: number; course: number; finition: Finition; suitTout?: boolean }) {
  const g = useRef<THREE.Group>(null);
  return (
    <Mobile id={id} suitTout={suitTout} appliquer={(t) => g.current && (g.current.position.x = x + t * course)}>
      <group ref={g} position={[x, 0, z]}>
        <Panneau position={[0, y, 0]} taille={[largeur, hauteur, E]} {...finition} />
        {/* prise verticale creusée */}
        <mesh position={[-Math.sign(course) * (largeur / 2 - 0.05), y, E / 2 + 0.001]}>
          <boxGeometry args={[0.022, 0.3, 0.004]} />
          <meshStandardMaterial color="#26262a" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    </Mobile>
  );
}

/** Tiroir : façade + caisson qui sort de `course`. */
function Tiroir({ id, x, y, z, largeur, hauteur, profondeur, finition }: { id: string; x: number; y: number; z: number; largeur: number; hauteur: number; profondeur: number; finition: Finition }) {
  const g = useRef<THREE.Group>(null);
  const course = Math.min(0.45, profondeur * 0.7);
  const pi = profondeur - 0.08; // caisson intérieur
  return (
    <Mobile id={id} appliquer={(t) => g.current && (g.current.position.z = z + t * course)}>
      <group ref={g} position={[x, y, z]}>
        <Panneau position={[0, 0, 0]} taille={[largeur, hauteur, E]} {...finition} />
        <Poignee position={[0, hauteur / 2 - 0.045, E / 2]} vertical={false} longueur={Math.min(0.3, largeur * 0.4)} />
        {/* caisson du tiroir, bois clair */}
        <Panneau position={[0, -hauteur / 2 + 0.012, -pi / 2 - E / 2]} taille={[largeur - 0.04, 0.008, pi]} couleur="#e9dcc6" rugosite={0.8} arrondi={0.002} />
        <Panneau position={[-(largeur - 0.04) / 2 + 0.006, -0.012, -pi / 2 - E / 2]} taille={[0.012, hauteur - 0.05, pi]} couleur="#e9dcc6" rugosite={0.8} arrondi={0.002} />
        <Panneau position={[(largeur - 0.04) / 2 - 0.006, -0.012, -pi / 2 - E / 2]} taille={[0.012, hauteur - 0.05, pi]} couleur="#e9dcc6" rugosite={0.8} arrondi={0.002} />
        <Panneau position={[0, -0.012, -pi - E / 2 + 0.006]} taille={[largeur - 0.04, hauteur - 0.05, 0.012]} couleur="#e9dcc6" rugosite={0.8} arrondi={0.002} />
      </group>
    </Mobile>
  );
}

/* ------------------------------------------------------------------ aménagement intérieur (décor) */
function Cintres({ cx, y, largeur, profondeur }: { cx: number; y: number; largeur: number; profondeur: number }) {
  const nb = Math.max(2, Math.min(5, Math.floor(largeur / 0.14)));
  const couleurs = ["#c9d2d9", "#ece6da", "#6f7a86", "#b9a38a", "#dfe3e6"];
  return (
    <group position={[cx, y, 0]}>
      {Array.from({ length: nb }, (_, k) => {
        const x = -largeur / 2 + 0.08 + (k * (largeur - 0.16)) / Math.max(1, nb - 1);
        return (
          <group key={k} position={[x, 0, 0]} rotation={[0, (k % 2 ? 1 : -1) * 0.12, 0]}>
            <mesh position={[0, 0.03, 0]}>
              <torusGeometry args={[0.022, 0.003, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#8a8a8a" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.02, 0]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.012, 0.04, 0.006]} />
              <meshStandardMaterial color="#8a8a8a" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.33, 0]} castShadow>
              <boxGeometry args={[Math.min(0.3, profondeur * 0.55), 0.58, 0.018]} />
              <meshStandardMaterial color={couleurs[k % couleurs.length]} roughness={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function PileLinge({ position, profondeur }: { position: [number, number, number]; profondeur: number }) {
  const l = Math.min(0.3, profondeur * 0.55);
  return (
    <group position={position}>
      {["#e8e1d4", "#c9d2d9", "#a7b0a0"].map((c, k) => (
        <RoundedBox key={c} args={[l, 0.035, l * 0.9]} radius={0.01} smoothness={2} position={[0, 0.0175 + k * 0.036, 0]} castShadow>
          <meshStandardMaterial color={c} roughness={0.95} />
        </RoundedBox>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ dressing / placard */
function Rangement({ fiche }: { fiche: FicheDressing | FichePlacard }) {
  const W = fiche.largeurM;
  const H = fiche.hauteurM;
  const P = fiche.profondeurM;
  const gamme = fiche.gamme;
  const portes = fiche.famille === "dressing" ? fiche.facade : fiche.portes;
  const miroirs = fiche.famille === "dressing" ? fiche.miroirPortes : 0;
  const led = fiche.famille === "dressing" ? fiche.eclairageLed : false;
  const tiroirs = fiche.tiroirs;

  const n = Math.max(1, Math.round(W / 0.6));
  const sw = (W - 2 * E) / n;
  const plinthe = 0.08;
  const finition: Finition = { gamme };
  const finitionPorte = (i: number): Finition => (i < miroirs ? { miroir: true } : { gamme });

  const interieur = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let tiroirsRestants = tiroirs;
    for (let i = 0; i < n; i++) {
      const cx = -W / 2 + E + sw * (i + 0.5);
      if (i > 0) elements.push(<Panneau key={`div${i}`} position={[-W / 2 + E + sw * i, H / 2, 0]} taille={[E, H - 2 * E, P - E]} {...finition} />);
      const dansSection = Math.min(3, tiroirsRestants);
      const hautTiroirs = plinthe + E + dansSection * 0.19;
      const penderie = i % 2 === 0;
      if (penderie) {
        const yTringle = H - 0.26;
        elements.push(
          <mesh key={`tringle${i}`} position={[cx, yTringle, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.011, 0.011, sw - E, 16]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.25} />
          </mesh>,
        );
        elements.push(<Panneau key={`tab${i}`} position={[cx, H - 0.12, 0]} taille={[sw - E, E, P - 2 * E]} {...finition} />);
        elements.push(<Cintres key={`cintres${i}`} cx={cx} y={yTringle} largeur={sw - E} profondeur={P} />);
        if (H - 0.26 - 0.7 - hautTiroirs > 0.3) {
          elements.push(<Panneau key={`tabbas${i}`} position={[cx, hautTiroirs + 0.02, 0]} taille={[sw - E, E, P - 2 * E]} {...finition} />);
        }
      } else {
        if (dansSection > 0) elements.push(<Panneau key={`tabtir${i}`} position={[cx, hautTiroirs + 0.02, 0]} taille={[sw - E, E, P - 2 * E]} {...finition} />);
        const nb = Math.max(3, Math.round((H - hautTiroirs) / 0.36));
        const pas = (H - E - hautTiroirs) / nb;
        for (let k = 1; k < nb; k++) {
          const y = hautTiroirs + pas * k;
          elements.push(<Panneau key={`etag${i}-${k}`} position={[cx, y, 0]} taille={[sw - E, E, P - 2 * E]} {...finition} />);
          if (k % 2 === 1) elements.push(<PileLinge key={`pile${i}-${k}`} position={[cx - (k % 4 === 1 ? 0.05 : -0.05), y + E / 2, -0.02]} profondeur={P} />);
        }
      }
      for (let t = 0; t < dansSection; t++) {
        elements.push(<Tiroir key={`tiroir${i}-${t}`} id={`tiroir-${i}-${t}`} x={cx} y={plinthe + E + 0.095 + t * 0.19} z={P / 2 - E / 2 - 0.002} largeur={sw - E - 0.008} hauteur={0.178} profondeur={P - 2 * E} finition={finition} />);
      }
      tiroirsRestants -= dansSection;
    }
    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, P, n, sw, gamme, tiroirs]);

  const facades = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const zPorte = P / 2 + E / 2 + 0.002;
    const hPorte = H - plinthe - E;
    const yPorte = plinthe + hPorte / 2;
    if (portes === "battant") {
      for (let i = 0; i < n; i++) {
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const charniere = cote === 1 ? -W / 2 + E + sw * i + 0.002 : -W / 2 + E + sw * (i + 1) - 0.002;
        elements.push(<Battante key={`p${i}`} id={`porte-${i}`} charniere={charniere} largeur={sw - 0.006} hauteur={hPorte} y={yPorte} z={zPorte} cote={cote} finition={finitionPorte(i)} />);
      }
    } else if (portes === "coulissant") {
      const np = W > 2.4 ? 3 : 2;
      const pas = (W - 2 * E) / np;
      const wp = pas + 0.03;
      for (let i = 0; i < np; i++) {
        const x = -W / 2 + E + pas * (i + 0.5);
        const z = zPorte + (i % 2 === 0 ? E + 0.008 : 0);
        const course = (i < np - 1 ? 1 : -1) * pas * 0.94;
        // « Tout ouvrir » ne déplace que les panneaux pairs : les impairs servent de fond, sinon tout se recouvre
        elements.push(<Coulissante key={`c${i}`} id={`porte-${i}`} x={x} y={yPorte} z={z} largeur={wp} hauteur={hPorte} course={course} finition={finitionPorte(i)} suitTout={i % 2 === 0} />);
      }
      // bandeau haut dans la finition du meuble, rail discret dessous ; rail bas au sol
      elements.push(<Panneau key="bandeau" position={[0, H - 0.03, zPorte + E / 2 + 0.004]} taille={[W, 0.06, 2 * E + 0.016]} {...finition} arrondi={0.003} />);
      elements.push(<Panneau key="railh" position={[0, H - 0.062, zPorte + E / 2 + 0.004]} taille={[W - 0.01, 0.006, 2 * E + 0.012]} couleur="#4a4a4e" metal={0.7} rugosite={0.3} arrondi={0.001} />);
      elements.push(<Panneau key="railb" position={[0, plinthe + 0.004, zPorte + E / 2 + 0.004]} taille={[W, 0.008, 2 * E + 0.016]} couleur="#4a4a4e" metal={0.7} rugosite={0.3} arrondi={0.002} />);
    } else if (portes === "pliant") {
      for (let i = 0; i < n; i++) {
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const charniere = cote === 1 ? -W / 2 + E + sw * i + 0.002 : -W / 2 + E + sw * (i + 1) - 0.002;
        elements.push(<Pliante key={`pl${i}`} id={`porte-${i}`} charniere={charniere} largeur={sw - 0.006} hauteur={hPorte} y={yPorte} z={zPorte} cote={cote} finition={finitionPorte(i)} />);
      }
    }
    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portes, n, sw, W, H, P, gamme, miroirs]);

  return (
    <group>
      {/* caisson */}
      <Panneau position={[-W / 2 + E / 2, H / 2, 0]} taille={[E, H, P]} {...finition} />
      <Panneau position={[W / 2 - E / 2, H / 2, 0]} taille={[E, H, P]} {...finition} />
      <Panneau position={[0, H - E / 2, 0]} taille={[W, E, P]} {...finition} />
      <Panneau position={[0, plinthe + E / 2, 0]} taille={[W - 2 * E, E, P]} {...finition} />
      <Panneau position={[0, plinthe / 2, -0.03]} taille={[W - 2 * E, plinthe, P - 0.06]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      <Panneau position={[0, H / 2, -P / 2 + E / 2]} taille={[W - 2 * E, H - 2 * E, E]} {...finition} />
      {interieur}
      {facades}
      {led && (
        <>
          <mesh position={[0, H - E - 0.006, P / 2 - 0.035]}>
            <boxGeometry args={[W - 2 * E - 0.02, 0.006, 0.014]} />
            <meshStandardMaterial color="#fff4d6" emissive="#ffd98a" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <pointLight position={[0, H - 0.12, P / 2 - 0.05]} intensity={1.6} distance={2.6} decay={2} color="#ffe2a8" castShadow={false} />
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ cuisine */
function RangeeCuisine({ prefixe, longueur, longueurHaut, gamme, plan, tiroirs, evier = -1, plaque = -1 }: { prefixe: string; longueur: number; longueurHaut: number; gamme: Gamme; plan: FicheCuisine["planTravail"]; tiroirs: number; evier?: number; plaque?: number }) {
  const finition: Finition = { gamme };
  const nb = Math.max(1, Math.round(longueur / 0.6));
  const w = longueur / nb;
  const hBas = 0.87;
  const prof = 0.6;
  const socle = 0.1;
  const nbHaut = Math.max(0, Math.round(longueurHaut / 0.6));
  const wHaut = nbHaut ? longueurHaut / nbHaut : 0;
  const planMat: Finition = plan === "quartz" ? { couleur: "#f3f1ec", rugosite: 0.18 } : plan === "bois" ? { gamme: "premium" } : { couleur: "#c9c4bb", rugosite: 0.55 };
  const zFacade = prof / 2 + E / 2 + 0.002;
  return (
    <group>
      <Panneau position={[longueur / 2, socle / 2, -0.04]} taille={[longueur, socle, prof - 0.08]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      {Array.from({ length: nb }, (_, i) => {
        const cx = w * (i + 0.5);
        const tiroir = i < tiroirs;
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        return (
          <group key={`bas${i}`}>
            <Panneau position={[cx, socle + (hBas - socle) / 2, 0]} taille={[w - 0.004, hBas - socle, prof]} {...finition} />
            {tiroir ? (
              [0, 1, 2].map((t) => (
                <Tiroir key={t} id={`${prefixe}-tiroir-${i}-${t}`} x={cx} y={socle + 0.128 + t * 0.253} z={zFacade} largeur={w - 0.012} hauteur={0.245} profondeur={prof - 0.04} finition={finition} />
              ))
            ) : (
              <Battante id={`${prefixe}-porte-${i}`} charniere={cote === 1 ? cx - w / 2 + 0.006 : cx + w / 2 - 0.006} largeur={w - 0.012} hauteur={hBas - socle - 0.012} y={socle + (hBas - socle) / 2} z={zFacade} cote={cote} finition={finition} angle={1.6} />
            )}
          </group>
        );
      })}
      {/* plan de travail et crédence */}
      <Panneau position={[longueur / 2, hBas + 0.02, 0.015]} taille={[longueur + 0.02, 0.04, prof + 0.03]} {...planMat} arrondi={0.003} />
      <Panneau position={[longueur / 2, hBas + 0.04 + 0.28, -prof / 2 + 0.006]} taille={[longueur, 0.56, 0.012]} couleur={plan === "quartz" ? "#eceae5" : "#e4dfd6"} rugosite={0.4} arrondi={0.002} />
      {/* évier : cuve creusée + robinet */}
      {evier >= 0 && evier < nb && (
        <group position={[w * (evier + 0.5), hBas + 0.04, 0.02]}>
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(0.5, w - 0.1), 0.4]} />
            <meshStandardMaterial color="#9ea2a6" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.17, -0.2]}>
            <cylinderGeometry args={[0.012, 0.014, 0.3, 16]} />
            <meshStandardMaterial color="#b5b8bc" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.3, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.22, 12]} />
            <meshStandardMaterial color="#b5b8bc" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>
      )}
      {/* plaque de cuisson */}
      {plaque >= 0 && plaque < nb && (
        <group position={[w * (plaque + 0.5), hBas + 0.042, 0.02]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[Math.min(0.56, w - 0.06), 0.48]} />
            <meshStandardMaterial color="#141416" roughness={0.12} metalness={0.3} />
          </mesh>
          {[-0.14, 0.14].flatMap((x) =>
            [-0.12, 0.12].map((zz) => (
              <mesh key={`${x}${zz}`} position={[x, 0.001, zz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.07, 0.075, 32]} />
                <meshStandardMaterial color="#5c5c60" />
              </mesh>
            )),
          )}
        </group>
      )}
      {/* meubles hauts */}
      {Array.from({ length: nbHaut }, (_, i) => {
        const cx = wHaut * (i + 0.5);
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const yH = 1.85;
        const hH = 0.7;
        const pH = 0.35;
        return (
          <group key={`haut${i}`}>
            <Panneau position={[cx, yH, -prof / 2 + pH / 2]} taille={[wHaut - 0.004, hH, pH]} {...finition} />
            <Battante id={`${prefixe}-haut-${i}`} charniere={cote === 1 ? cx - wHaut / 2 + 0.006 : cx + wHaut / 2 - 0.006} largeur={wHaut - 0.012} hauteur={hH - 0.012} y={yH} z={-prof / 2 + pH + E / 2 + 0.002} cote={cote} finition={finition} angle={1.6} />
          </group>
        );
      })}
      {nbHaut > 0 && (
        <mesh position={[longueurHaut / 2, 1.49, -prof / 2 + 0.33]}>
          <boxGeometry args={[longueurHaut - 0.04, 0.006, 0.012]} />
          <meshStandardMaterial color="#fff4d6" emissive="#ffe9c0" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Colonne({ id, x, gamme, four }: { id: string; x: number; gamme: Gamme; four: boolean }) {
  const finition: Finition = { gamme };
  const hauteur = 2.2;
  return (
    <group position={[x, 0, 0]}>
      <Panneau position={[0, 0.05, -0.04]} taille={[0.6, 0.1, 0.52]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      <Panneau position={[0, 0.1 + (hauteur - 0.1) / 2, 0]} taille={[0.6, hauteur - 0.1, 0.6]} {...finition} />
      {four ? (
        <>
          <Battante id={`${id}-haut`} charniere={-0.294} largeur={0.588} hauteur={0.6} y={1.9} z={0.3 + E / 2 + 0.002} cote={1} finition={finition} angle={1.6} />
          <Battante id={`${id}-bas`} charniere={-0.294} largeur={0.588} hauteur={0.74} y={0.48} z={0.3 + E / 2 + 0.002} cote={1} finition={finition} angle={1.6} />
          {/* four encastré : façade noire + bandeau + poignée */}
          <mesh position={[0, 1.23, 0.3 + 0.005]}>
            <boxGeometry args={[0.588, 0.6, 0.01]} />
            <meshStandardMaterial color="#141416" roughness={0.15} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.47, 0.3 + 0.012]}>
            <boxGeometry args={[0.5, 0.05, 0.004]} />
            <meshStandardMaterial color="#2a2a2e" roughness={0.3} metalness={0.6} />
          </mesh>
          <Poignee position={[0, 1.36, 0.3 + 0.01]} vertical={false} longueur={0.46} />
        </>
      ) : (
        <Battante id={id} charniere={-0.294} largeur={0.588} hauteur={hauteur - 0.112} y={0.1 + (hauteur - 0.1) / 2} z={0.3 + E / 2 + 0.002} cote={1} finition={finition} angle={1.6} />
      )}
    </group>
  );
}

/** Caisson d'angle plein (sous le plan) qui relie la rangée principale à un retour. */
function Angle({ x, gamme, plan }: { x: number; gamme: Gamme; plan: FicheCuisine["planTravail"] }) {
  const planMat: Finition = plan === "quartz" ? { couleur: "#f3f1ec", rugosite: 0.18 } : plan === "bois" ? { gamme: "premium" } : { couleur: "#c9c4bb", rugosite: 0.55 };
  return (
    <group position={[x, 0, 0]}>
      <Panneau position={[0, 0.05, 0]} taille={[0.6, 0.1, 0.6]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      <Panneau position={[0, 0.1 + 0.77 / 2, 0]} taille={[0.6, 0.77, 0.6]} gamme={gamme} />
      <Panneau position={[0, 0.89, 0]} taille={[0.62, 0.04, 0.63]} {...planMat} arrondi={0.003} />
      <Panneau position={[0, 0.91 + 0.28, -0.3 + 0.006]} taille={[0.6, 0.56, 0.012]} couleur={plan === "quartz" ? "#eceae5" : "#e4dfd6"} rugosite={0.4} arrondi={0.002} />
    </group>
  );
}

function Cuisine({ fiche }: { fiche: FicheCuisine }) {
  const L = fiche.longueurBasM;
  const LH = fiche.longueurHautM;
  const parts = fiche.implantation === "U" ? [0.4, 0.2, 0.4] : fiche.implantation === "L" ? [0.6, 0.4] : [1];
  const longueurs = parts.map((p) => L * p);
  const hauts = parts.map((p) => LH * p);
  const ilot = fiche.implantation === "ilot";
  const enU = fiche.implantation === "U";
  const longueurIlot = Math.min(2.4, Math.max(1.2, L * 0.4));
  const L0 = longueurs[0];
  const nb0 = Math.max(1, Math.round(L0 / 0.6));
  // plaque sur le dernier meuble, évier sur le premier meuble à porte qui n'est pas la plaque
  const plaque = nb0 >= 2 ? nb0 - 1 : 0;
  const evier = nb0 >= 3 ? Array.from({ length: nb0 }, (_, i) => i).find((i) => i >= fiche.tiroirs && i !== plaque) ?? -1 : -1;
  const commun = { gamme: fiche.gamme, plan: fiche.planTravail };
  const mur: Finition = { couleur: "#f1ece4", rugosite: 0.95 };

  return (
    <group position={[-L0 / 2, 0, 0]}>
      {/* rangée principale, le long du mur du fond (x de 0 à L0, dos en z = -0.3) */}
      <RangeeCuisine prefixe="r0" longueur={L0} longueurHaut={hauts[0]} tiroirs={fiche.tiroirs} evier={evier} plaque={plaque} {...commun} />

      {/* retour gauche (L et U) : angle plein puis rangée qui vient vers le spectateur, façades vers l'intérieur */}
      {longueurs[1] !== undefined && (
        <>
          <Angle x={-0.3} {...commun} />
          <group position={[-0.3, 0, 0.3 + longueurs[1]]} rotation={[0, Math.PI / 2, 0]}>
            <RangeeCuisine prefixe="r1" longueur={longueurs[1]} longueurHaut={hauts[1]} tiroirs={0} {...commun} />
          </group>
          <mesh position={[-0.61, 1.6, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[24, 3.2]} />
            <meshStandardMaterial color={mur.couleur} roughness={0.95} />
          </mesh>
        </>
      )}

      {/* retour droit (U) : symétrique */}
      {enU && longueurs[2] !== undefined && (
        <>
          <Angle x={L0 + 0.3} {...commun} />
          <group position={[L0 + 0.3, 0, 0.3]} rotation={[0, -Math.PI / 2, 0]}>
            <RangeeCuisine prefixe="r2" longueur={longueurs[2]} longueurHaut={hauts[2]} tiroirs={0} {...commun} />
          </group>
          <mesh position={[L0 + 0.61, 1.6, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
            <planeGeometry args={[24, 3.2]} />
            <meshStandardMaterial color={mur.couleur} roughness={0.95} />
          </mesh>
        </>
      )}

      {ilot && (
        <group position={[L0 / 2 - longueurIlot / 2, 0, 1.5]}>
          <RangeeCuisine prefixe="ilot" longueur={longueurIlot} longueurHaut={0} tiroirs={0} plaque={0} {...commun} />
        </group>
      )}

      {/* colonnes : à droite de la rangée principale ; en U, au bout du retour droit */}
      {Array.from({ length: fiche.colonnes }, (_, i) =>
        enU ? (
          <group key={`col${i}`} position={[L0 + 0.3, 0, 0.3 + (longueurs[2] ?? 0) + 0.31 + i * 0.61]} rotation={[0, -Math.PI / 2, 0]}>
            <Colonne id={`colonne-${i}`} x={0} gamme={fiche.gamme} four={i === 0} />
          </group>
        ) : (
          <Colonne key={`col${i}`} id={`colonne-${i}`} x={L0 + 0.31 + i * 0.61} gamme={fiche.gamme} four={i === 0} />
        ),
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ fenêtre */
const COULEUR_FENETRE = { pvc: "#f5f5f3", aluminium: "#9a9ea3", bois: "#b4804c" } as const;

function Vantail({ id, charniere, largeur, hauteur, yBas, z, cote, finition, mode }: { id: string; charniere: number; largeur: number; hauteur: number; yBas: number; z: number; cote: 1 | -1; finition: Finition; mode: FicheFenetre["ouverture"] }) {
  const g = useRef<THREE.Group>(null);
  const b = 0.05;
  const appliquer = (t: number) => {
    if (!g.current) return;
    if (mode === "coulissant") g.current.position.x = charniere + cote * t * largeur * 0.92;
    else if (mode !== "fixe") g.current.rotation.y = -cote * t * 1.25;
  };
  const contenu = (
    <group ref={g} position={[charniere, 0, z]}>
      <Panneau position={[(cote * largeur) / 2, yBas + b / 2, 0]} taille={[largeur, b, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[(cote * largeur) / 2, yBas + hauteur - b / 2, 0]} taille={[largeur, b, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[cote * (b / 2), yBas + hauteur / 2, 0]} taille={[b, hauteur, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[cote * (largeur - b / 2), yBas + hauteur / 2, 0]} taille={[b, hauteur, 0.06]} {...finition} arrondi={0.003} />
      <mesh position={[(cote * largeur) / 2, yBas + hauteur / 2, 0]}>
        <boxGeometry args={[largeur - 2 * b, hauteur - 2 * b, 0.016]} />
        <meshPhysicalMaterial color="#d8e8f0" transparent opacity={0.22} roughness={0.03} metalness={0.05} clearcoat={1} />
      </mesh>
      {mode !== "fixe" && <Poignee position={[cote * (largeur - b - 0.02), yBas + hauteur / 2, 0.03]} longueur={0.14} />}
    </group>
  );
  if (mode === "fixe") return contenu;
  return (
    <Mobile id={id} appliquer={appliquer}>
      {contenu}
    </Mobile>
  );
}

function Fenetre({ fiche }: { fiche: FicheFenetre }) {
  const W = fiche.largeurM;
  const H = fiche.hauteurM;
  const finition: Finition = fiche.materiau === "bois" ? { gamme: "premium" } : { couleur: fiche.couleurHorsBlanc ? "#3d4247" : COULEUR_FENETRE[fiche.materiau], rugosite: fiche.materiau === "aluminium" ? 0.35 : 0.6, metal: fiche.materiau === "aluminium" ? 0.45 : 0 };
  const yBas = 0.9; // allège
  const cadre = 0.07;
  const murEp = 0.24;
  const mur: Finition = { couleur: "#f1ece4", rugosite: 0.95 };
  const nv = fiche.vantaux;
  const wv = (W - 2 * cadre) / nv;
  const hautMur = Math.max(4.5, yBas + H + 0.7 + (fiche.voletRoulant ? 0.2 : 0)); // assez haut pour ne jamais voir par-dessus
  const cote = 3.2; // mur de chaque côté de la fenêtre
  const z = -murEp / 2 + 0.02;
  return (
    <group>
      {/* mur avec ouverture */}
      <Panneau position={[0, yBas / 2, -murEp / 2]} taille={[W + 2 * cote, yBas, murEp]} {...mur} arrondi={0.002} />
      <Panneau position={[0, yBas + H + (hautMur - yBas - H) / 2, -murEp / 2]} taille={[W + 2 * cote, hautMur - yBas - H, murEp]} {...mur} arrondi={0.002} />
      <Panneau position={[-W / 2 - cote / 2, yBas + H / 2, -murEp / 2]} taille={[cote, H, murEp]} {...mur} arrondi={0.002} />
      <Panneau position={[W / 2 + cote / 2, yBas + H / 2, -murEp / 2]} taille={[cote, H, murEp]} {...mur} arrondi={0.002} />
      <Panneau position={[0, 0.05, 0.007]} taille={[W + 2 * cote, 0.1, 0.014]} couleur="#f7f5f1" rugosite={0.6} arrondi={0.002} />
      {/* extérieur : ciel et jardin */}
      <mesh position={[0, 1.4, -murEp - 2.5]}>
        <planeGeometry args={[18, 8]} />
        <meshBasicMaterial map={textureCiel()} />
      </mesh>
      {/* appui intérieur */}
      <Panneau position={[0, yBas - 0.02, 0.02]} taille={[W + 0.16, 0.04, 0.26]} couleur="#e6e1d8" rugosite={0.5} arrondi={0.003} />
      {/* dormant */}
      <Panneau position={[0, yBas + cadre / 2, -murEp / 2]} taille={[W, cadre, 0.08]} {...finition} arrondi={0.003} />
      <Panneau position={[0, yBas + H - cadre / 2, -murEp / 2]} taille={[W, cadre, 0.08]} {...finition} arrondi={0.003} />
      <Panneau position={[-W / 2 + cadre / 2, yBas + H / 2, -murEp / 2]} taille={[cadre, H, 0.08]} {...finition} arrondi={0.003} />
      <Panneau position={[W / 2 - cadre / 2, yBas + H / 2, -murEp / 2]} taille={[cadre, H, 0.08]} {...finition} arrondi={0.003} />
      {Array.from({ length: nv }, (_, i) => {
        const cote: 1 | -1 = i === 0 ? 1 : -1;
        const charniere = cote === 1 ? -W / 2 + cadre : W / 2 - cadre;
        return <Vantail key={i} id={`vantail-${i}`} charniere={charniere} largeur={wv} hauteur={H - 2 * cadre} yBas={yBas + cadre} z={z + (fiche.ouverture === "coulissant" && i === 1 ? 0.05 : 0)} cote={cote} finition={finition} mode={fiche.ouverture} />;
      })}
      {fiche.voletRoulant && <Panneau position={[0, yBas + H + 0.1, -murEp / 2 + 0.03]} taille={[W + 0.12, 0.2, 0.2]} {...finition} arrondi={0.004} />}
    </group>
  );
}

/* ------------------------------------------------------------------ scène */
function encombrement(fiche: FicheProjet): { w: number; h: number; cibleY: number; cibleZ: number } {
  switch (fiche.famille) {
    case "cuisine": {
      const L = fiche.longueurBasM;
      const retour = fiche.implantation === "L" ? L * 0.4 : fiche.implantation === "U" ? L * 0.4 : fiche.implantation === "ilot" ? 1.8 : 0;
      const largeur = fiche.implantation === "U" ? L * 0.4 + 1.2 : fiche.implantation === "L" ? L * 0.6 + 0.6 + fiche.colonnes * 0.6 : L + fiche.colonnes * 0.6;
      return { w: Math.max(largeur, retour + 1, 2.8), h: 2.3, cibleY: 1.0, cibleZ: retour * 0.35 };
    }
    case "fenetre":
      return { w: fiche.largeurM + 1.4, h: fiche.hauteurM + 1.2, cibleY: 0.9 + fiche.hauteurM / 2, cibleZ: 0 };
    default:
      return { w: fiche.largeurM, h: fiche.hauteurM, cibleY: fiche.hauteurM / 2, cibleZ: 0 };
  }
}

function Camera({ fiche }: { fiche: FicheProjet }) {
  const { camera } = useThree();
  const { w, h, cibleY, cibleZ } = encombrement(fiche);
  useEffect(() => {
    const d = Math.max(w, h) * 1.1 + 1.3;
    camera.position.set(d * 0.6, cibleY + h * 0.22, cibleZ + d * 0.9);
    camera.lookAt(0, cibleY, cibleZ);
    camera.updateProjectionMatrix();
  }, [camera, w, h, cibleY, cibleZ]);
  return <OrbitControls target={[0, cibleY, cibleZ]} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={14} maxPolarAngle={Math.PI / 2 - 0.03} />;
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
      ctx.fillStyle = "#efeae2";
      ctx.fillRect(0, 0, largeur, hauteur);
      ctx.drawImage(source, 0, 0, largeur, hauteur);
      return cible.toDataURL("image/jpeg", 0.85);
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function Piece({ fiche }: { fiche: FicheProjet }) {
  const zMur = fiche.famille === "cuisine" ? -0.31 : fiche.famille === "fenetre" ? null : -fiche.profondeurM / 2 - 0.03;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial map={textureParquet()} color="#efe4d4" roughness={0.55} />
      </mesh>
      {zMur !== null && (
        <group position={[0, 0, zMur]}>
          <mesh position={[0, 1.6, 0]} receiveShadow>
            <planeGeometry args={[24, 3.2]} />
            <meshStandardMaterial color="#f1ece4" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.05, 0.007]} receiveShadow>
            <boxGeometry args={[24, 0.1, 0.014]} />
            <meshStandardMaterial color="#f7f5f1" roughness={0.6} />
          </mesh>
        </group>
      )}
    </>
  );
}

/** Y a-t-il quelque chose à ouvrir dans cette fiche ? (sinon on cache les boutons) */
function aDesOuvrants(fiche: FicheProjet): boolean {
  switch (fiche.famille) {
    case "dressing":
      return fiche.facade !== "ouvert" || fiche.tiroirs > 0;
    case "placard":
      return true;
    case "cuisine":
      return true;
    case "fenetre":
      return fiche.ouverture !== "fixe";
  }
}

export default function Scene3D({ fiche, onReady }: { fiche: FicheProjet; onReady?: (capture: () => string) => void }) {
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [tout, setTout] = useState<boolean | null>(null);
  const cle = `${fiche.famille}-${fiche.famille === "dressing" ? fiche.facade : fiche.famille === "placard" ? fiche.portes : fiche.famille === "fenetre" ? fiche.ouverture : fiche.implantation}`;
  // Changement de famille ou de type de porte : on repart portes fermées (réinitialisation pendant le rendu, pattern React).
  const [cleVue, setCleVue] = useState(cle);
  if (cleVue !== cle) {
    setCleVue(cle);
    setOuverts({});
    setTout(null);
  }

  const rangement = fiche.famille === "dressing" || fiche.famille === "placard";
  const ouverture = useMemo<Ouverture>(() => {
    // Priorité : clic sur l'élément > « Tout ouvrir / fermer » > état initial (première porte ouverte sur un rangement).
    const etat = (o: Record<string, boolean>, id: string, suitTout: boolean) => o[id] ?? (tout === null || (tout && !suitTout) ? (rangement && id === "porte-0") : tout);
    return {
      estOuvert: (id, suitTout = true) => etat(ouverts, id, suitTout),
      basculer: (id, suitTout = true) => setOuverts((o) => ({ ...o, [id]: !etat(o, id, suitTout) })),
    };
  }, [ouverts, tout, rangement]);
  const toutOuvrir = useCallback((v: boolean) => {
    setOuverts({});
    setTout(v);
  }, []);
  const ouvrants = aDesOuvrants(fiche);

  return (
    <>
      {/* frameloop « demand » : rien ne tourne tant que personne ne bouge la vue ni n'ouvre une porte — léger sur mobile. */}
      <Canvas shadows frameloop="demand" gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 40, near: 0.05, far: 60 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#efeae2"]} />
        <fog attach="fog" args={["#efeae2", 9, 24]} />
        <SoftShadows size={18} samples={10} focus={0.5} />
        <ambientLight intensity={0.12} />
        <directionalLight
          position={[3.5, 6, 4.5]}
          intensity={1.7}
          color="#fff6ea"
          castShadow
          shadow-mapSize={[1536, 1536]}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.00015}
          shadow-normalBias={0.025}
        />
        <Environment resolution={256} frames={1}>
          {/* « pièce » : fond clair pour les reflets (miroir, laque, alu), puis panneaux lumineux */}
          <mesh scale={60}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial color="#cfc7bb" side={THREE.BackSide} />
          </mesh>
          <Lightformer form="rect" intensity={2.2} position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} color="#fff7ec" />
          <Lightformer form="rect" intensity={2.6} position={[4, 2, 3]} rotation={[0, -Math.PI / 4, 0]} scale={[3, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.1} position={[-4, 2, 1]} rotation={[0, Math.PI / 3, 0]} scale={[3, 3, 1]} color="#e9eef6" />
          <Lightformer form="rect" intensity={0.6} position={[0, 1, -4]} rotation={[0, Math.PI, 0]} scale={[6, 2, 1]} color="#f3ebe0" />
        </Environment>
        <ContactShadows key={cle + JSON.stringify(fiche)} position={[0, 0.002, 0]} opacity={0.38} scale={16} blur={2.6} far={2.8} resolution={512} frames={1} color="#3b2f22" />
        <Piece fiche={fiche} />
        <OuvertureContext.Provider value={ouverture}>
          {fiche.famille === "dressing" || fiche.famille === "placard" ? <Rangement fiche={fiche} /> : fiche.famille === "cuisine" ? <Cuisine fiche={fiche} /> : <Fenetre fiche={fiche} />}
        </OuvertureContext.Provider>
        <Camera fiche={fiche} />
        <Capture onReady={onReady} />
      </Canvas>
      {ouvrants && (
        <>
          <div className="absolute right-4 top-4 flex gap-1.5">
            <button type="button" onClick={() => toutOuvrir(true)} className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white">
              Tout ouvrir
            </button>
            <button type="button" onClick={() => toutOuvrir(false)} className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white">
              Tout fermer
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/80 px-3 py-1 text-xs text-stone-600 backdrop-blur">Cliquez sur une porte ou un tiroir pour l’ouvrir</div>
        </>
      )}
    </>
  );
}
