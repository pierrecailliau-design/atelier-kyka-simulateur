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
import { finitionEffective, type FacadeStyle, type FicheCuisine, type FicheDressing, type FicheFenetre, type FichePlacard, type FicheProjet, type Finition as CodeFinition, type Gamme, type Interieur, type Poignees } from "@/lib/fiche/schema";
import { FINITIONS, POIGNEES, TEINTES_FENETRE } from "@/lib/fiche/libelles";
const E = 0.019; // épaisseur de panneau
const ACCENT = "#8a5a2b";

/* ------------------------------------------------------------------ ouverture au clic */
type Ouverture = { estOuvert: (id: string, suitTout?: boolean) => boolean; basculer: (id: string, suitTout?: boolean) => void };
const OuvertureContext = createContext<Ouverture>({ estOuvert: () => false, basculer: () => {} });
const SurvolContext = createContext(false);

/** Style choisi par le client pour les meubles : finition effective et poignées. Lu par Matiere et Poignee. */
type Style = { finition: CodeFinition; poignees: Poignees; facadeStyle: FacadeStyle; interieur: Interieur };
const StyleContext = createContext<Style>({ finition: "lin", poignees: "barre_noire", facadeStyle: "lisse", interieur: "assorti" });

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

const _bois = new Map<number, THREE.CanvasTexture>();
/** Veinage de chêne procédural ; `contraste` module la force des veines (frêne doux → noyer marqué). La teinte vient du matériau. */
function textureBois(contraste = 1) {
  const existante = _bois.get(contraste);
  if (existante) return existante;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const r = alea(7);
  ctx.fillStyle = "#dcc5a0";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(255,240,215,${(0.05 + r() * 0.1) * contraste})`;
    ctx.fillRect(r() * 512, 0, 12 + r() * 50, 512);
  }
  for (let i = 0; i < 140; i++) {
    const x = r() * 512;
    ctx.strokeStyle = `rgba(125,88,52,${(0.03 + r() * 0.1) * contraste})`;
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
  _bois.set(contraste, t);
  return t;
}

let _carreaux: THREE.CanvasTexture | null = null;
/** Carreaux métro blancs, joints gris clair, pour la crédence. */
function textureCarreaux() {
  if (_carreaux) return _carreaux;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#cfcac3";
  ctx.fillRect(0, 0, 512, 256);
  const w = 128;
  const h = 64;
  for (let row = 0; row < 4; row++) {
    const decalage = row % 2 ? w / 2 : 0;
    for (let x = -w; x < 512 + w; x += w) {
      ctx.fillStyle = row % 3 === 1 ? "#f4f1ec" : "#f7f5f1";
      ctx.fillRect(x + decalage + 3, row * h + 3, w - 6, h - 6);
      // léger reflet en haut du carreau
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + decalage + 6, row * h + 6, w - 12, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  _carreaux = t;
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
/** `gamme` seule → finition du style courant (contexte) ; `finition` → une finition imposée (plan de travail en bois, par ex.). */
type Finition = { gamme?: Gamme; finition?: CodeFinition; couleur?: string; rugosite?: number; metal?: number; miroir?: boolean; carte?: THREE.Texture; /** panneau intérieur d'un caisson : blanc si le client a choisi un intérieur blanc */ interne?: boolean };

function Matiere({ gamme, finition, couleur, rugosite, metal, miroir, carte, interne }: Finition) {
  const survol = useContext(SurvolContext);
  const style = useContext(StyleContext);
  const emissive = survol ? ACCENT : "#000000";
  const ei = survol ? 0.16 : 0;
  if (miroir) return <meshStandardMaterial color="#dfe7ec" roughness={0.06} metalness={0.85} envMapIntensity={1.4} emissive={emissive} emissiveIntensity={ei} />;
  if (interne && style.interieur === "blanc") return <meshStandardMaterial color="#f3efe8" roughness={0.78} emissive={emissive} emissiveIntensity={ei} />;
  if (carte) return <meshStandardMaterial map={carte} color={couleur ?? "#ffffff"} roughness={rugosite ?? 0.5} emissive={emissive} emissiveIntensity={ei} />;
  const code = finition ?? (gamme ? finitionEffective(gamme, style.finition) : undefined);
  if (code) {
    const f = FINITIONS[code];
    if (f.bois) return <meshStandardMaterial map={textureBois(f.bois.contraste)} color={f.bois.teinte} roughness={gamme === "essentiel" ? 0.7 : 0.48} emissive={emissive} emissiveIntensity={ei} />;
    if (gamme === "confort" || (!gamme && code !== "blanc" && code !== "gris_clair")) {
      return <meshPhysicalMaterial color={f.couleur} roughness={0.26} clearcoat={0.55} clearcoatRoughness={0.22} emissive={emissive} emissiveIntensity={ei} />;
    }
    return <meshStandardMaterial color={f.couleur} roughness={0.72} emissive={emissive} emissiveIntensity={ei} />;
  }
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

/**
 * Panneau à dessus en pente (porte de placard sous escalier ou sous pente) : rectangle dont le haut
 * monte de `hDroite` à droite à `hGauche` à gauche, épaisseur E. Origine au coin bas gauche.
 */
function Trapeze({ x0, largeur, hGauche, hDroite, position, ...finition }: Finition & { x0: number; largeur: number; hGauche: number; hDroite: number; position: [number, number, number] }) {
  const geometrie = useMemo(() => {
    const forme = new THREE.Shape();
    forme.moveTo(x0, 0);
    forme.lineTo(x0 + largeur, 0);
    forme.lineTo(x0 + largeur, hDroite);
    forme.lineTo(x0, hGauche);
    forme.closePath();
    const g = new THREE.ExtrudeGeometry(forme, { depth: E, bevelEnabled: false });
    g.translate(0, 0, -E / 2);
    return g;
  }, [x0, largeur, hGauche, hDroite]);
  useEffect(() => () => geometrie.dispose(), [geometrie]);
  return (
    <mesh geometry={geometrie} position={position} castShadow receiveShadow>
      <Matiere {...finition} />
    </mesh>
  );
}

/** Pente éventuelle d'un rangement : hauteur du dessus en fonction de x (haut à gauche, bas à droite). */
type Pente = { active: boolean; hauteurEn: (x: number) => number; hMin: number };

/** Poignée barre fine, dans le style choisi (noire, inox, laiton) ; « sans » = ouverture par pression, rien à dessiner. */
function Poignee({ position, vertical = true, longueur = 0.18, forcer }: { position: [number, number, number]; vertical?: boolean; longueur?: number; forcer?: Poignees }) {
  const style = useContext(StyleContext);
  const code = forcer ?? style.poignees;
  if (code === "sans") return null;
  const p = POIGNEES[code];
  return (
    <group position={position} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <mesh position={[0, 0, 0.018]} castShadow>
        <boxGeometry args={[0.011, longueur, 0.011]} />
        <meshStandardMaterial color={p.couleur} metalness={p.metal} roughness={p.rugosite} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (longueur / 2 - 0.02), 0.008]}>
          <boxGeometry args={[0.009, 0.009, 0.016]} />
          <meshStandardMaterial color={p.couleur} metalness={p.metal} roughness={p.rugosite} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ éléments mobiles */
/** Hauteurs du haut de porte à ses bords gauche et droit (absents = porte rectangulaire). */
type Haut = { hGauche: number; hDroite: number };

/** Vantail de porte : rectangle, ou trapèze si `haut` est donné. `x0` = bord gauche en local, `yBas` = bas de la porte. */
function VantailPorte({ x0, largeur, yBas, hauteur, haut, finition }: { x0: number; largeur: number; yBas: number; hauteur: number; haut?: Haut; finition: Finition }) {
  const style = useContext(StyleContext);
  if (haut) return <Trapeze x0={x0} largeur={largeur} hGauche={haut.hGauche} hDroite={haut.hDroite} position={[0, yBas, 0]} {...finition} />;
  const cx = x0 + largeur / 2;
  const cy = yBas + hauteur / 2;
  const cadre = style.facadeStyle === "cadre" && !finition.miroir && largeur > 0.25 && hauteur > 0.3;
  const m = Math.min(0.075, largeur * 0.18); // largeur des montants du cadre
  const ep = 0.007;
  return (
    <group>
      <Panneau position={[cx, cy, 0]} taille={[largeur, hauteur, E]} {...finition} />
      {cadre && (
        <>
          {/* cadre type shaker : quatre montants en relief, le panneau central reste en retrait */}
          <Panneau position={[x0 + m / 2, cy, E / 2 + ep / 2]} taille={[m, hauteur, ep]} {...finition} arrondi={0.002} />
          <Panneau position={[x0 + largeur - m / 2, cy, E / 2 + ep / 2]} taille={[m, hauteur, ep]} {...finition} arrondi={0.002} />
          <Panneau position={[cx, yBas + m / 2, E / 2 + ep / 2]} taille={[largeur - 2 * m, m, ep]} {...finition} arrondi={0.002} />
          <Panneau position={[cx, yBas + hauteur - m / 2, E / 2 + ep / 2]} taille={[largeur - 2 * m, m, ep]} {...finition} arrondi={0.002} />
        </>
      )}
    </group>
  );
}

/** Porte battante : charnière à gauche (`cote` = 1) ou à droite (-1), ouvre vers le spectateur. */
function Battante({ id, charniere, largeur, hauteur, y, z, cote, finition, angle = 1.6, poignee = true, haut, poigneePos = "milieu" }: { id: string; charniere: number; largeur: number; hauteur: number; y: number; z: number; cote: 1 | -1; finition: Finition; angle?: number; poignee?: boolean; haut?: Haut; /** meuble bas : poignée en haut ; meuble haut : en bas */ poigneePos?: "haut" | "bas" | "milieu" }) {
  const g = useRef<THREE.Group>(null);
  const style = useContext(StyleContext);
  const yBas = y - hauteur / 2;
  const yPoignee = haut ? yBas + Math.min(haut.hGauche, haut.hDroite) * 0.5 : poigneePos === "haut" ? yBas + hauteur - 0.13 : poigneePos === "bas" ? yBas + 0.13 : y;
  const zPoignee = E / 2 + (style.facadeStyle === "cadre" && !haut ? 0.007 : 0);
  return (
    <Mobile id={id} appliquer={(t) => g.current && (g.current.rotation.y = -cote * t * angle)}>
      <group ref={g} position={[charniere, 0, z]}>
        <VantailPorte x0={cote === 1 ? 0 : -largeur} largeur={largeur} yBas={yBas} hauteur={hauteur} haut={haut} finition={finition} />
        {poignee && <Poignee position={[cote * (largeur - 0.06), yPoignee, zPoignee]} />}
      </group>
    </Mobile>
  );
}

/** Porte pliante (deux vantaux articulés) : charnière à gauche (`cote` = 1) ou à droite (-1). */
function Pliante({ id, charniere, largeur, hauteur, y, z, cote, finition, haut }: { id: string; charniere: number; largeur: number; hauteur: number; y: number; z: number; cote: 1 | -1; finition: Finition; haut?: Haut }) {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const demi = (largeur - 0.006) / 2;
  const angle = 1.5;
  const yBas = y - hauteur / 2;
  const hMilieu = haut ? (haut.hGauche + haut.hDroite) / 2 : hauteur;
  // moitié côté charnière (A) et moitié libre (B), avec leurs hauteurs gauche/droite respectives
  const hautA = haut ? (cote === 1 ? { hGauche: haut.hGauche, hDroite: hMilieu } : { hGauche: hMilieu, hDroite: haut.hDroite }) : undefined;
  const hautB = haut ? (cote === 1 ? { hGauche: hMilieu, hDroite: haut.hDroite } : { hGauche: haut.hGauche, hDroite: hMilieu }) : undefined;
  const yPoignee = haut ? yBas + Math.min(haut.hGauche, haut.hDroite) * 0.5 : y;
  return (
    <Mobile
      id={id}
      appliquer={(t) => {
        if (a.current) a.current.rotation.y = -cote * t * angle;
        if (b.current) b.current.rotation.y = cote * t * angle * 2;
      }}
    >
      <group ref={a} position={[charniere, 0, z]}>
        <VantailPorte x0={cote === 1 ? 0 : -demi} largeur={demi} yBas={yBas} hauteur={hauteur} haut={hautA} finition={finition} />
        <group ref={b} position={[cote * (demi + 0.006), 0, 0]}>
          <VantailPorte x0={cote === 1 ? 0 : -demi} largeur={demi} yBas={yBas} hauteur={hauteur} haut={hautB} finition={finition} />
          <Poignee position={[cote * 0.05, yPoignee, E / 2]} />
        </group>
      </group>
    </Mobile>
  );
}

/** Panneau coulissant : glisse de `course` (signée) devant son voisin. `course` = 0 : panneau fixe. */
function Coulissante({ id, x, y, z, largeur, hauteur, course, finition, suitTout, haut }: { id: string; x: number; y: number; z: number; largeur: number; hauteur: number; course: number; finition: Finition; suitTout?: boolean; haut?: Haut }) {
  const g = useRef<THREE.Group>(null);
  const style = useContext(StyleContext);
  const yBas = y - hauteur / 2;
  const yPoignee = haut ? yBas + Math.min(haut.hGauche, haut.hDroite) * 0.5 : y;
  // prise verticale : dans la teinte des poignées (noire par défaut, y compris « sans poignée »), peu brillante
  const prise = style.poignees === "sans" ? POIGNEES.barre_noire : POIGNEES[style.poignees];
  const contenu = (
    <group ref={g} position={[x, 0, z]}>
      <VantailPorte x0={-largeur / 2} largeur={largeur} yBas={yBas} hauteur={hauteur} haut={haut} finition={finition} />
      {course !== 0 && (
        <mesh position={[-Math.sign(course) * (largeur / 2 - 0.05), yPoignee, E / 2 + 0.001]}>
          <boxGeometry args={[0.022, 0.3, 0.004]} />
          <meshStandardMaterial color={prise.couleur} metalness={Math.min(0.35, prise.metal)} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
  if (course === 0) return contenu;
  return (
    <Mobile id={id} suitTout={suitTout} appliquer={(t) => g.current && (g.current.position.x = x + t * course)}>
      {contenu}
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
        <VantailPorte x0={-largeur / 2} largeur={largeur} yBas={-hauteur / 2} hauteur={hauteur} finition={finition} />
        <Poignee position={[0, hauteur / 2 - 0.045, E / 2 + 0.007]} vertical={false} longueur={Math.min(0.3, largeur * 0.4)} />
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
  const configuration = fiche.famille === "placard" ? fiche.configuration : "standard";
  const amenagement = fiche.amenagement;

  // Pente du dessus : sous escalier (raide) ou sous pente (douce), haut à gauche, bas à droite.
  const pente = useMemo<Pente>(() => {
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const hMin = configuration === "sous_escalier" ? clamp(H - W * 0.7, 0.75, H * 0.8) : configuration === "sous_pente" ? clamp(H - W * 0.5, 1.0, H * 0.85) : H;
    const active = configuration !== "standard" && hMin < H - 0.05;
    return { active, hMin, hauteurEn: (x: number) => (active ? H - (H - hMin) * ((x + W / 2) / W) : H) };
  }, [configuration, H, W]);

  const n = Math.max(1, Math.round(W / 0.6));
  const sw = (W - 2 * E) / n;
  const plinthe = 0.08;
  const finition: Finition = { gamme };
  const dedans: Finition = { gamme, interne: true };
  const finitionPorte = (i: number): Finition => (i < miroirs ? { miroir: true } : { gamme });
  /** Haut de porte (par rapport au bas de la porte) aux abscisses xa < xb, sous le dessus en pente. */
  const hautPorte = (xa: number, xb: number): Haut | undefined => (pente.active ? { hGauche: pente.hauteurEn(xa) - E - 0.008 - plinthe, hDroite: pente.hauteurEn(xb) - E - 0.008 - plinthe } : undefined);

  const interieur = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let tiroirsRestants = tiroirs;
    for (let i = 0; i < n; i++) {
      const xa = -W / 2 + E + sw * i;
      const xb = xa + sw;
      const cx = (xa + xb) / 2;
      const hSec = pente.hauteurEn(xb); // point le plus bas du dessus dans la section
      if (i > 0) {
        const hDiv = pente.hauteurEn(xa) - 2 * E;
        elements.push(<Panneau key={`div${i}`} position={[xa, E + hDiv / 2, 0]} taille={[E, hDiv, P - E]} {...dedans} />);
      }
      if (pente.active) {
        const hFond = pente.hauteurEn(xb) - 2 * E;
        elements.push(<Panneau key={`fond${i}`} position={[cx, E + hFond / 2, -P / 2 + E / 2]} taille={[sw, hFond, E]} {...dedans} />);
      }
      const dansSection = Math.min(3, tiroirsRestants);
      const hautTiroirs = plinthe + E + dansSection * 0.19;
      const veutPenderie = amenagement === "penderie" ? true : amenagement === "etageres" ? false : i % 2 === 0;
      const penderie = veutPenderie && hSec - hautTiroirs > 1.25;
      if (penderie) {
        const yTringle = hSec - 0.26;
        elements.push(
          <mesh key={`tringle${i}`} position={[cx, yTringle, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.011, 0.011, sw - E, 16]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.25} />
          </mesh>,
        );
        if (!pente.active) elements.push(<Panneau key={`tab${i}`} position={[cx, H - 0.12, 0]} taille={[sw - E, E, P - 2 * E]} {...dedans} />);
        elements.push(<Cintres key={`cintres${i}`} cx={cx} y={yTringle} largeur={sw - E} profondeur={P} />);
        if (hSec - 0.26 - 0.7 - hautTiroirs > 0.3) {
          elements.push(<Panneau key={`tabbas${i}`} position={[cx, hautTiroirs + 0.02, 0]} taille={[sw - E, E, P - 2 * E]} {...dedans} />);
        }
      } else {
        if (dansSection > 0) elements.push(<Panneau key={`tabtir${i}`} position={[cx, hautTiroirs + 0.02, 0]} taille={[sw - E, E, P - 2 * E]} {...dedans} />);
        const nb = Math.max(2, Math.round((hSec - hautTiroirs) / 0.36));
        const pas = (hSec - E - hautTiroirs) / nb;
        for (let k = 1; k < nb; k++) {
          const y = hautTiroirs + pas * k;
          elements.push(<Panneau key={`etag${i}-${k}`} position={[cx, y, 0]} taille={[sw - E, E, P - 2 * E]} {...dedans} />);
          if (k % 2 === 1 && hSec - y > 0.2) elements.push(<PileLinge key={`pile${i}-${k}`} position={[cx - (k % 4 === 1 ? 0.05 : -0.05), y + E / 2, -0.02]} profondeur={P} />);
        }
      }
      for (let t = 0; t < dansSection; t++) {
        elements.push(<Tiroir key={`tiroir${i}-${t}`} id={`tiroir-${i}-${t}`} x={cx} y={plinthe + E + 0.095 + t * 0.19} z={P / 2 - E / 2 - 0.002} largeur={sw - E - 0.008} hauteur={0.178} profondeur={P - 2 * E} finition={finition} />);
      }
      tiroirsRestants -= dansSection;
    }
    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, P, n, sw, gamme, tiroirs, pente, amenagement]);

  const facades = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const zPorte = P / 2 + E / 2 + 0.002;
    const hPorte = H - plinthe - E;
    const yPorte = plinthe + hPorte / 2;
    if (portes === "battant") {
      for (let i = 0; i < n; i++) {
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const xa = -W / 2 + E + sw * i + 0.003;
        const charniere = cote === 1 ? xa : xa + sw - 0.006;
        elements.push(<Battante key={`p${i}`} id={`porte-${i}`} charniere={charniere} largeur={sw - 0.006} hauteur={hPorte} y={yPorte} z={zPorte} cote={cote} finition={finitionPorte(i)} haut={hautPorte(xa, xa + sw - 0.006)} />);
      }
    } else if (portes === "coulissant") {
      const np = W > 2.4 ? 3 : 2;
      const pas = (W - 2 * E) / np;
      const wp = pas + 0.03;
      for (let i = 0; i < np; i++) {
        const x = -W / 2 + E + pas * (i + 0.5);
        const z = zPorte + (i % 2 === 0 ? E + 0.008 : 0);
        // Sous une pente, les panneaux ne peuvent glisser que vers le côté haut ; celui du bout haut est fixe.
        const course = pente.active ? (i === 0 ? 0 : -pas * 0.94) : (i < np - 1 ? 1 : -1) * pas * 0.94;
        // « Tout ouvrir » ne déplace que les panneaux pairs : les impairs servent de fond, sinon tout se recouvre
        elements.push(<Coulissante key={`c${i}`} id={`porte-${i}`} x={x} y={yPorte} z={z} largeur={wp} hauteur={hPorte} course={course} finition={finitionPorte(i)} suitTout={pente.active ? i >= 1 : i % 2 === 0} haut={hautPorte(x - wp / 2, x + wp / 2)} />);
      }
      if (pente.active) {
        // rail haut qui suit la pente
        const dh = pente.hMin - H;
        const longueur = Math.hypot(W, dh);
        elements.push(<Panneau key="railh" position={[0, (H + pente.hMin) / 2 - E - 0.006, zPorte + E / 2 + 0.004]} rotation={[0, 0, Math.atan2(dh, W)]} taille={[longueur - 0.02, 0.006, 2 * E + 0.012]} couleur="#4a4a4e" metal={0.7} rugosite={0.3} arrondi={0.001} />);
      } else {
        // bandeau haut dans la finition du meuble, rail discret dessous ; rail bas au sol
        elements.push(<Panneau key="bandeau" position={[0, H - 0.03, zPorte + E / 2 + 0.004]} taille={[W, 0.06, 2 * E + 0.016]} {...finition} arrondi={0.003} />);
        elements.push(<Panneau key="railh" position={[0, H - 0.062, zPorte + E / 2 + 0.004]} taille={[W - 0.01, 0.006, 2 * E + 0.012]} couleur="#4a4a4e" metal={0.7} rugosite={0.3} arrondi={0.001} />);
      }
      elements.push(<Panneau key="railb" position={[0, plinthe + 0.004, zPorte + E / 2 + 0.004]} taille={[W, 0.008, 2 * E + 0.016]} couleur="#4a4a4e" metal={0.7} rugosite={0.3} arrondi={0.002} />);
    } else if (portes === "pliant") {
      for (let i = 0; i < n; i++) {
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        const xa = -W / 2 + E + sw * i + 0.003;
        const charniere = cote === 1 ? xa : xa + sw - 0.006;
        elements.push(<Pliante key={`pl${i}`} id={`porte-${i}`} charniere={charniere} largeur={sw - 0.006} hauteur={hPorte} y={yPorte} z={zPorte} cote={cote} finition={finitionPorte(i)} haut={hautPorte(xa, xa + sw - 0.006)} />);
      }
    }
    return elements;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portes, n, sw, W, H, P, gamme, miroirs, pente]);

  // dessus : plat, ou en pente (panneau incliné de la hauteur pleine à gauche jusqu'à hMin à droite)
  const dessus = pente.active ? (
    <Panneau position={[0, (H + pente.hMin) / 2 - E / 2, 0]} rotation={[0, 0, Math.atan2(pente.hMin - H, W)]} taille={[Math.hypot(W, H - pente.hMin), E, P]} {...finition} />
  ) : (
    <Panneau position={[0, H - E / 2, 0]} taille={[W, E, P]} {...finition} />
  );

  return (
    <group>
      {/* caisson */}
      <Panneau position={[-W / 2 + E / 2, H / 2, 0]} taille={[E, H, P]} {...finition} />
      <Panneau position={[W / 2 - E / 2, pente.hMin / 2, 0]} taille={[E, pente.hMin, P]} {...finition} />
      {dessus}
      <Panneau position={[0, plinthe + E / 2, 0]} taille={[W - 2 * E, E, P]} {...dedans} />
      <Panneau position={[0, plinthe / 2, -0.03]} taille={[W - 2 * E, plinthe, P - 0.06]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      {!pente.active && <Panneau position={[0, H / 2, -P / 2 + E / 2]} taille={[W - 2 * E, H - 2 * E, E]} {...dedans} />}
      {interieur}
      {facades}
      {led && !pente.active && (
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
const PROF = 0.6; // profondeur des meubles bas
const SOCLE = 0.1;
const E_PLAN = 0.04;
const INOX: Finition = { couleur: "#b9bcc0", metal: 0.9, rugosite: 0.28 };

/** Matière de la crédence selon le choix du client et le plan de travail. */
function matiereCredence(credence: FicheCuisine["credence"], plan: FicheCuisine["planTravail"]): Finition {
  if (credence === "carreaux") return { carte: textureCarreaux(), rugosite: 0.25 };
  if (credence === "blanche") return { couleur: "#f6f4ef", rugosite: 0.35 };
  return plan === "quartz" ? { couleur: "#eceae5", rugosite: 0.3 } : plan === "bois" ? { finition: "chene_naturel" } : { couleur: "#e4dfd6", rugosite: 0.4 };
}

const matierePlan = (plan: FicheCuisine["planTravail"]): Finition => (plan === "quartz" ? { couleur: "#f3f1ec", rugosite: 0.18 } : plan === "bois" ? { finition: "chene_naturel" } : { couleur: "#c9c4bb", rugosite: 0.55 });

/**
 * Caisson ouvert sur le devant : deux côtés, fond (bas), dos, et des étagères. L'intérieur suit le choix
 * « intérieur des caissons ». Origine : coin bas gauche arrière du caisson au sol du caisson (y = 0).
 */
function Caisson({ x, y, largeur, hauteur, profondeur, etageres = [], gamme, children }: { x: number; y: number; largeur: number; hauteur: number; profondeur: number; etageres?: number[]; gamme: Gamme; children?: React.ReactNode }) {
  const dedans: Finition = { gamme, interne: true };
  const cz = 0; // caisson centré en z sur le groupe appelant
  return (
    <group position={[x, y, cz]}>
      <Panneau position={[E / 2, hauteur / 2, 0]} taille={[E, hauteur, profondeur]} {...dedans} />
      <Panneau position={[largeur - E / 2, hauteur / 2, 0]} taille={[E, hauteur, profondeur]} {...dedans} />
      <Panneau position={[largeur / 2, E / 2, 0]} taille={[largeur - 2 * E, E, profondeur]} {...dedans} />
      <Panneau position={[largeur / 2, hauteur - E / 2, 0]} taille={[largeur - 2 * E, E, profondeur]} {...dedans} />
      <Panneau position={[largeur / 2, hauteur / 2, -profondeur / 2 + E / 2]} taille={[largeur - 2 * E, hauteur - 2 * E, E]} {...dedans} />
      {etageres.map((h) => (
        <Panneau key={h} position={[largeur / 2, h, 0]} taille={[largeur - 2 * E, E, profondeur - 2 * E]} {...dedans} />
      ))}
      {children}
    </group>
  );
}

/** Deux casseroles empilées et une pile d'assiettes : ce qu'on voit quand on ouvre un meuble bas. */
function ContenuBas({ largeur, profondeur, etagere }: { largeur: number; profondeur: number; etagere: number }) {
  const r = Math.min(0.11, largeur * 0.2);
  return (
    <group>
      <mesh position={[largeur * 0.35, E + 0.06, -profondeur * 0.1]} castShadow>
        <cylinderGeometry args={[r, r, 0.12, 24]} />
        <meshStandardMaterial color="#9ea3a8" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[largeur * 0.35, E + 0.12 + 0.045, -profondeur * 0.1]} castShadow>
        <cylinderGeometry args={[r * 0.8, r * 0.8, 0.09, 24]} />
        <meshStandardMaterial color="#c7cacf" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[largeur * 0.68, etagere + E / 2 + 0.035, -profondeur * 0.05]} castShadow>
        <cylinderGeometry args={[Math.min(0.13, largeur * 0.22), Math.min(0.13, largeur * 0.22), 0.07, 24]} />
        <meshStandardMaterial color="#f2efe8" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Verres et bols dans un meuble haut. */
function ContenuHaut({ largeur, profondeur, etagere }: { largeur: number; profondeur: number; etagere: number }) {
  const n = Math.max(2, Math.min(4, Math.floor(largeur / 0.12)));
  return (
    <group>
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} position={[(largeur * (k + 0.5)) / n, etagere + E / 2 + 0.05, -profondeur * 0.1]} castShadow>
          <cylinderGeometry args={[0.032, 0.026, 0.1, 16]} />
          <meshPhysicalMaterial color="#e8f0f4" transparent opacity={0.45} roughness={0.05} />
        </mesh>
      ))}
      <mesh position={[largeur * 0.3, E + 0.03, -profondeur * 0.1]} castShadow>
        <cylinderGeometry args={[0.07, 0.05, 0.06, 20]} />
        <meshStandardMaterial color="#e3d9c8" roughness={0.6} />
      </mesh>
      <mesh position={[largeur * 0.68, E + 0.03, -profondeur * 0.1]} castShadow>
        <cylinderGeometry args={[0.07, 0.05, 0.06, 20]} />
        <meshStandardMaterial color="#aab5a4" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Plan de travail percé pour la cuve : des morceaux autour du trou, pas de géométrie booléenne. */
function PlanTravail({ longueur, y, plan, trou }: { longueur: number; y: number; plan: FicheCuisine["planTravail"]; trou?: { x: number; largeur: number; profondeur: number } }) {
  const mat = matierePlan(plan);
  const prof = PROF + 0.03;
  const zc = 0.015;
  const pieces: { x: number; w: number; z: number; d: number }[] = [];
  if (!trou) pieces.push({ x: longueur / 2, w: longueur + 0.02, z: zc, d: prof });
  else {
    const xa = trou.x - trou.largeur / 2;
    const xb = trou.x + trou.largeur / 2;
    if (xa > 0) pieces.push({ x: xa / 2 - 0.01, w: xa + 0.02, z: zc, d: prof });
    if (xb < longueur) pieces.push({ x: (xb + longueur) / 2 + 0.01, w: longueur - xb + 0.02, z: zc, d: prof });
    // bandes avant et arrière du trou (la cuve est centrée en z = 0,02)
    const bordAvantTrou = 0.02 + trou.profondeur / 2;
    const bordAvantPlan = zc + prof / 2;
    const bordArriereTrou = 0.02 - trou.profondeur / 2;
    const bordArrierePlan = zc - prof / 2;
    pieces.push({ x: trou.x, w: trou.largeur, z: (bordAvantTrou + bordAvantPlan) / 2, d: bordAvantPlan - bordAvantTrou });
    pieces.push({ x: trou.x, w: trou.largeur, z: (bordArriereTrou + bordArrierePlan) / 2, d: bordArriereTrou - bordArrierePlan });
  }
  return (
    <group>
      {pieces.map((p, i) => (
        <Panneau key={i} position={[p.x, y, p.z]} taille={[p.w, E_PLAN, p.d]} {...mat} arrondi={0.003} />
      ))}
    </group>
  );
}

/** Cuve encastrée (bac inox ouvert) + robinet. */
function Evier({ x, y, largeur, profondeur }: { x: number; y: number; largeur: number; profondeur: number }) {
  const h = 0.18;
  const ep = 0.006;
  return (
    <group position={[x, y, 0.02]}>
      {/* bords de la cuve affleurants */}
      <Panneau position={[0, -ep / 2, 0]} taille={[largeur + 0.02, ep, profondeur + 0.02]} {...INOX} arrondi={0.001} />
      {/* bac : fond et quatre parois, vus depuis le dessus */}
      <Panneau position={[0, -h + ep / 2, 0]} taille={[largeur, ep, profondeur]} {...INOX} arrondi={0.001} />
      <Panneau position={[-largeur / 2 + ep / 2, -h / 2, 0]} taille={[ep, h, profondeur]} {...INOX} arrondi={0.001} />
      <Panneau position={[largeur / 2 - ep / 2, -h / 2, 0]} taille={[ep, h, profondeur]} {...INOX} arrondi={0.001} />
      <Panneau position={[0, -h / 2, -profondeur / 2 + ep / 2]} taille={[largeur, h, ep]} {...INOX} arrondi={0.001} />
      <Panneau position={[0, -h / 2, profondeur / 2 - ep / 2]} taille={[largeur, h, ep]} {...INOX} arrondi={0.001} />
      <mesh position={[0, -h + ep + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.03, 20]} />
        <meshStandardMaterial color="#5c6066" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* robinet */}
      <mesh position={[0, 0.15, -profondeur / 2 - 0.06]}>
        <cylinderGeometry args={[0.013, 0.015, 0.3, 16]} />
        <meshStandardMaterial color="#c4c7cb" metalness={0.95} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.3, -profondeur / 2 + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.22, 12]} />
        <meshStandardMaterial color="#c4c7cb" metalness={0.95} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Plaque({ x, y, largeur }: { x: number; y: number; largeur: number }) {
  const w = Math.min(0.58, largeur - 0.06);
  return (
    <group position={[x, y, 0.02]}>
      <Panneau position={[0, 0.003, 0]} taille={[w, 0.006, 0.5]} couleur="#141416" rugosite={0.12} metal={0.3} arrondi={0.002} />
      {[-0.14, 0.14].flatMap((dx) =>
        [-0.12, 0.12].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx * (w / 0.58), 0.0065, dz]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.075, 32]} />
            <meshStandardMaterial color="#5c5c60" />
          </mesh>
        )),
      )}
    </group>
  );
}

function RangeeCuisine({ prefixe, longueur, longueurHaut, gamme, plan, credence, hauteurPlan, tiroirs, evier = -1, plaque = -1 }: { prefixe: string; longueur: number; longueurHaut: number; gamme: Gamme; plan: FicheCuisine["planTravail"]; credence: FicheCuisine["credence"]; hauteurPlan: number; tiroirs: number; evier?: number; plaque?: number }) {
  const finition: Finition = { gamme };
  const nb = Math.max(1, Math.round(longueur / 0.6));
  const w = longueur / nb;
  const hBas = hauteurPlan - E_PLAN; // haut des caissons bas
  const hCaisson = hBas - SOCLE;
  const nbHaut = Math.max(0, Math.round(longueurHaut / 0.6));
  const wHaut = nbHaut ? longueurHaut / nbHaut : 0;
  const zFacade = PROF / 2 + E / 2 + 0.002;
  const yHaut = hauteurPlan + 0.55; // bas des meubles hauts
  const hH = 0.72;
  const pH = 0.35;
  const trouEvier = evier >= 0 && evier < nb ? { x: w * (evier + 0.5), largeur: Math.min(0.5, w - 0.1), profondeur: 0.4 } : undefined;
  return (
    <group>
      <Panneau position={[longueur / 2, SOCLE / 2, -0.04]} taille={[longueur, SOCLE, PROF - 0.08]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      {/* joues de finition aux deux bouts de la rangée, dans la finition des façades */}
      <Panneau position={[-E / 2 - 0.001, SOCLE + hCaisson / 2, 0.01]} taille={[E, hCaisson, PROF + 0.02]} {...finition} />
      <Panneau position={[longueur + E / 2 + 0.001, SOCLE + hCaisson / 2, 0.01]} taille={[E, hCaisson, PROF + 0.02]} {...finition} />
      {nbHaut > 0 && (
        <>
          <Panneau position={[-E / 2 - 0.001, yHaut + hH / 2, -PROF / 2 + pH / 2 + 0.01]} taille={[E, hH, pH + 0.02]} {...finition} />
          <Panneau position={[longueurHaut + E / 2 + 0.001, yHaut + hH / 2, -PROF / 2 + pH / 2 + 0.01]} taille={[E, hH, pH + 0.02]} {...finition} />
        </>
      )}
      {Array.from({ length: nb }, (_, i) => {
        const xa = w * i;
        const cx = xa + w / 2;
        const tiroir = i < tiroirs;
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        return (
          <group key={`bas${i}`}>
            <Caisson x={xa + 0.002} y={SOCLE} largeur={w - 0.004} hauteur={hCaisson} profondeur={PROF} etageres={tiroir ? [] : [hCaisson * 0.5]} gamme={gamme}>
              {!tiroir && <ContenuBas largeur={w - 0.004} profondeur={PROF} etagere={hCaisson * 0.5} />}
            </Caisson>
            {tiroir ? (
              [0, 1, 2].map((t) => {
                const hT = (hCaisson - 0.012) / 3;
                return <Tiroir key={t} id={`${prefixe}-tiroir-${i}-${t}`} x={cx} y={SOCLE + hT / 2 + t * hT + 0.004} z={zFacade} largeur={w - 0.012} hauteur={hT - 0.008} profondeur={PROF - 0.04} finition={finition} />;
              })
            ) : (
              <Battante id={`${prefixe}-porte-${i}`} charniere={cote === 1 ? cx - w / 2 + 0.006 : cx + w / 2 - 0.006} largeur={w - 0.012} hauteur={hCaisson - 0.008} y={SOCLE + hCaisson / 2} z={zFacade} cote={cote} finition={finition} angle={1.6} poigneePos="haut" />
            )}
          </group>
        );
      })}
      {/* plan de travail, crédence, cuve, plaque */}
      <PlanTravail longueur={longueur} y={hBas + E_PLAN / 2} plan={plan} trou={trouEvier} />
      <Panneau position={[longueur / 2, hauteurPlan + (yHaut - hauteurPlan) / 2, -PROF / 2 + 0.006]} taille={[longueur, yHaut - hauteurPlan, 0.012]} {...matiereCredence(credence, plan)} arrondi={0.002} />
      {trouEvier && <Evier x={trouEvier.x} y={hauteurPlan} largeur={trouEvier.largeur} profondeur={trouEvier.profondeur} />}
      {plaque >= 0 && plaque < nb && plaque !== evier && <Plaque x={w * (plaque + 0.5)} y={hauteurPlan} largeur={w} />}
      {/* meubles hauts : caissons creux garnis, porte à poignée basse */}
      {Array.from({ length: nbHaut }, (_, i) => {
        const xa = wHaut * i;
        const cx = xa + wHaut / 2;
        const cote: 1 | -1 = i % 2 === 0 ? 1 : -1;
        return (
          <group key={`haut${i}`} position={[0, 0, -PROF / 2 + pH / 2]}>
            <Caisson x={xa + 0.002} y={yHaut} largeur={wHaut - 0.004} hauteur={hH} profondeur={pH} etageres={[hH * 0.5]} gamme={gamme}>
              <ContenuHaut largeur={wHaut - 0.004} profondeur={pH} etagere={hH * 0.5} />
            </Caisson>
            <Battante id={`${prefixe}-haut-${i}`} charniere={cote === 1 ? cx - wHaut / 2 + 0.006 : cx + wHaut / 2 - 0.006} largeur={wHaut - 0.012} hauteur={hH - 0.008} y={yHaut + hH / 2} z={pH / 2 + E / 2 + 0.002} cote={cote} finition={finition} angle={1.6} poigneePos="bas" />
          </group>
        );
      })}
      {nbHaut > 0 && (
        <mesh position={[longueurHaut / 2, yHaut - 0.006, -PROF / 2 + 0.33]}>
          <boxGeometry args={[longueurHaut - 0.04, 0.006, 0.012]} />
          <meshStandardMaterial color="#fff4d6" emissive="#ffe9c0" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Colonne : caisson creux à étagères, ou avec four encastré à hauteur des yeux. */
function Colonne({ id, x, gamme, four }: { id: string; x: number; gamme: Gamme; four: boolean }) {
  const finition: Finition = { gamme };
  const hauteur = 2.2;
  const hC = hauteur - SOCLE;
  const zF = PROF / 2 + E / 2 + 0.002;
  return (
    <group position={[x - 0.3, 0, 0]}>
      <Panneau position={[0.3, SOCLE / 2, -0.04]} taille={[0.6, SOCLE, PROF - 0.08]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      <Panneau position={[-E / 2 - 0.001, SOCLE + hC / 2, 0.01]} taille={[E, hC, PROF + 0.02]} {...finition} />
      <Panneau position={[0.6 + E / 2 + 0.001, SOCLE + hC / 2, 0.01]} taille={[E, hC, PROF + 0.02]} {...finition} />
      <Panneau position={[0.3, SOCLE + hC + E / 2, 0]} taille={[0.6 + 2 * E, E, PROF]} {...finition} />
      {four ? (
        <>
          <Caisson x={0} y={SOCLE} largeur={0.6} hauteur={hC} profondeur={PROF} etageres={[0.74 + 0.02, 0.74 + 0.6 + 0.02, hC - 0.35]} gamme={gamme}>
            <ContenuBas largeur={0.6} profondeur={PROF} etagere={hC - 0.35} />
          </Caisson>
          <Battante id={`${id}-haut`} charniere={0.006} largeur={0.588} hauteur={hC - 0.74 - 0.6 - 0.04} y={SOCLE + 0.74 + 0.6 + 0.03 + (hC - 0.74 - 0.6 - 0.04) / 2} z={zF} cote={1} finition={finition} angle={1.6} poigneePos="bas" />
          <Battante id={`${id}-bas`} charniere={0.006} largeur={0.588} hauteur={0.74 - 0.008} y={SOCLE + 0.74 / 2} z={zF} cote={1} finition={finition} angle={1.6} poigneePos="haut" />
          {/* four encastré : façade vitrée noire, bandeau, poignée pleine largeur */}
          <Panneau position={[0.3, SOCLE + 0.74 + 0.3, PROF / 2 + 0.005]} taille={[0.588, 0.58, 0.012]} couleur="#141416" rugosite={0.15} metal={0.4} arrondi={0.002} />
          <Panneau position={[0.3, SOCLE + 0.74 + 0.53, PROF / 2 + 0.013]} taille={[0.5, 0.05, 0.004]} couleur="#2a2a2e" rugosite={0.3} metal={0.6} arrondi={0.001} />
          <Poignee position={[0.3, SOCLE + 0.74 + 0.44, PROF / 2 + 0.012]} vertical={false} longueur={0.46} forcer="barre_inox" />
        </>
      ) : (
        <>
          <Caisson x={0} y={SOCLE} largeur={0.6} hauteur={hC} profondeur={PROF} etageres={[hC * 0.25, hC * 0.5, hC * 0.75]} gamme={gamme}>
            <ContenuBas largeur={0.6} profondeur={PROF} etagere={hC * 0.5} />
          </Caisson>
          <Battante id={id} charniere={0.006} largeur={0.588} hauteur={hC - 0.008} y={SOCLE + hC / 2} z={zF} cote={1} finition={finition} angle={1.6} poigneePos="milieu" />
        </>
      )}
    </group>
  );
}

/** Caisson d'angle plein (sous le plan) qui relie la rangée principale à un retour. */
function Angle({ x, gamme, plan, credence, hauteurPlan }: { x: number; gamme: Gamme; plan: FicheCuisine["planTravail"]; credence: FicheCuisine["credence"]; hauteurPlan: number }) {
  const hBas = hauteurPlan - E_PLAN;
  return (
    <group position={[x, 0, 0]}>
      <Panneau position={[0, SOCLE / 2, 0]} taille={[0.6, SOCLE, 0.52]} couleur="#2e2b29" rugosite={0.6} arrondi={0.002} />
      <Panneau position={[0, SOCLE + (hBas - SOCLE) / 2, 0]} taille={[0.6, hBas - SOCLE, PROF]} gamme={gamme} />
      <Panneau position={[0, hBas + E_PLAN / 2, 0]} taille={[0.62, E_PLAN, 0.63]} {...matierePlan(plan)} arrondi={0.003} />
      <Panneau position={[0, hauteurPlan + 0.275, -0.3 + 0.006]} taille={[0.6, 0.55, 0.012]} {...matiereCredence(credence, plan)} arrondi={0.002} />
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
  const commun = { gamme: fiche.gamme, plan: fiche.planTravail, credence: fiche.credence, hauteurPlan: fiche.hauteurPlanM };
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

function Vantail({ id, charniere, largeur, hauteur, yBas, z, cote, finition, mode, petitsBois }: { id: string; charniere: number; largeur: number; hauteur: number; yBas: number; z: number; cote: 1 | -1; finition: Finition; mode: FicheFenetre["ouverture"]; petitsBois: boolean }) {
  const g = useRef<THREE.Group>(null);
  const b = 0.05;
  // Pivot au bas du vantail (y = yBas) : rotation en y pour battre, en x pour basculer (oscillo-battant).
  const appliquer = (t: number) => {
    if (!g.current) return;
    if (mode === "coulissant") g.current.position.x = charniere + cote * t * largeur * 0.92;
    else if (mode === "oscillo_battant") g.current.rotation.x = t * 0.19;
    else if (mode === "battant") g.current.rotation.y = -cote * t * 1.25;
  };
  const contenu = (
    <group ref={g} position={[charniere, yBas, z]}>
      <Panneau position={[(cote * largeur) / 2, b / 2, 0]} taille={[largeur, b, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[(cote * largeur) / 2, hauteur - b / 2, 0]} taille={[largeur, b, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[cote * (b / 2), hauteur / 2, 0]} taille={[b, hauteur, 0.06]} {...finition} arrondi={0.003} />
      <Panneau position={[cote * (largeur - b / 2), hauteur / 2, 0]} taille={[b, hauteur, 0.06]} {...finition} arrondi={0.003} />
      <mesh position={[(cote * largeur) / 2, hauteur / 2, 0]}>
        <boxGeometry args={[largeur - 2 * b, hauteur - 2 * b, 0.016]} />
        <meshPhysicalMaterial color="#d8e8f0" transparent opacity={0.22} roughness={0.03} metalness={0.05} clearcoat={1} />
      </mesh>
      {petitsBois && (
        <>
          {/* croisillons : une barre verticale au milieu, barres horizontales tous les ~45 cm */}
          <Panneau position={[(cote * largeur) / 2, hauteur / 2, 0.012]} taille={[0.024, hauteur - 2 * b, 0.01]} {...finition} arrondi={0.002} />
          {Array.from({ length: Math.max(1, Math.round((hauteur - 2 * b) / 0.45) - 1) }, (_, k) => k).map((k, _, arr) => (
            <Panneau key={k} position={[(cote * largeur) / 2, b + ((hauteur - 2 * b) * (k + 1)) / (arr.length + 1), 0.012]} taille={[largeur - 2 * b, 0.024, 0.01]} {...finition} arrondi={0.002} />
          ))}
        </>
      )}
      {mode !== "fixe" && <Poignee position={[cote * (largeur - b - 0.02), hauteur / 2, 0.03]} longueur={0.14} forcer={finition.couleur && finition.couleur !== TEINTES_FENETRE.blanc.couleur ? "barre_noire" : "barre_inox"} />}
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
  // Bois : chêne naturel. PVC / alu : teinte choisie (une teinte hors blanc est chiffrée via couleurHorsBlanc).
  const teinte = fiche.teinte === "blanc" && fiche.couleurHorsBlanc ? TEINTES_FENETRE.anthracite : TEINTES_FENETRE[fiche.teinte];
  const finition: Finition = fiche.materiau === "bois" ? { finition: "chene_naturel" } : { couleur: teinte.couleur, rugosite: fiche.materiau === "aluminium" ? 0.35 : 0.6, metal: fiche.materiau === "aluminium" ? 0.45 : 0 };
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
        return <Vantail key={i} id={`vantail-${i}`} charniere={charniere} largeur={wv} hauteur={H - 2 * cadre} yBas={yBas + cadre} z={z + (fiche.ouverture === "coulissant" && i === 1 ? 0.05 : 0)} cote={cote} finition={finition} mode={fiche.ouverture} petitsBois={fiche.petitsBois} />;
      })}
      {fiche.voletRoulant && <Panneau position={[0, yBas + H + 0.1, -murEp / 2 + 0.03]} taille={[W + 0.12, 0.2, 0.2]} {...finition} arrondi={0.004} />}
    </group>
  );
}

/* ------------------------------------------------------------------ scène */
function encombrement(fiche: FicheProjet): { w: number; h: number; cibleY: number; cibleZ: number; decalageX: number; distanceMin: number } {
  switch (fiche.famille) {
    case "cuisine": {
      const L = fiche.longueurBasM;
      const enU = fiche.implantation === "U";
      const retour = fiche.implantation === "L" || enU ? L * 0.4 : fiche.implantation === "ilot" ? 1.8 : 0;
      const largeur = enU ? L * 0.2 + 1.9 : fiche.implantation === "L" ? L * 0.6 + 0.6 + fiche.colonnes * 0.6 : L + fiche.colonnes * 0.6;
      // En U on regarde de face, depuis l'entrée du U, assez loin pour que les retours et les colonnes ne cachent rien.
      const profondeur = enU ? 0.3 + retour + fiche.colonnes * 0.61 : fiche.implantation === "L" ? 0.3 + retour : 0.6;
      return { w: Math.max(largeur, 2.8), h: 2.3, cibleY: 1.0, cibleZ: enU ? profondeur * 0.4 : retour * 0.35, decalageX: enU ? 0.12 : 0.6, distanceMin: profondeur + 1.4 };
    }
    case "fenetre":
      return { w: fiche.largeurM + 0.9, h: fiche.hauteurM + 0.7, cibleY: 0.9 + fiche.hauteurM / 2, cibleZ: 0, decalageX: 0.55, distanceMin: 1.6 };
    default:
      return { w: fiche.largeurM, h: fiche.hauteurM, cibleY: fiche.hauteurM / 2, cibleZ: 0, decalageX: 0.6, distanceMin: fiche.profondeurM + 1 };
  }
}

function Camera({ fiche }: { fiche: FicheProjet }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const { w, h, cibleY, cibleZ, decalageX, distanceMin } = encombrement(fiche);
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    // Distance pour que l'objet tienne dans la vue, en largeur comme en hauteur, quel que soit le format de l'écran
    // (un téléphone en portrait a besoin de reculer bien plus qu'un écran large). La vue est en 3/4, d'où le facteur sur w.
    const fovV = (40 * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const largeurVue = w * (0.55 + decalageX * 0.6) + 0.3;
    const dLargeur = largeurVue / 2 / Math.tan(fovH / 2);
    const dHauteur = (h + 0.4) / 2 / Math.tan(fovV / 2);
    const d = Math.max(Math.max(dLargeur, dHauteur) * 1.12 + 0.6, distanceMin);
    const dz = Math.sqrt(Math.max(0.2, 1 - decalageX * decalageX)) * 0.95;
    camera.position.set(d * decalageX, cibleY + h * 0.22, cibleZ + d * dz);
    camera.lookAt(0, cibleY, cibleZ);
    camera.updateProjectionMatrix();
  }, [camera, w, h, cibleY, cibleZ, aspect, decalageX, distanceMin]);
  return <OrbitControls target={[0, cibleY, cibleZ]} enablePan={false} enableDamping dampingFactor={0.08} minDistance={1.2} maxDistance={18} maxPolarAngle={Math.PI / 2 - 0.03} />;
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
  const style = useMemo<Style>(
    () =>
      fiche.famille === "fenetre"
        ? { finition: "blanc", poignees: "barre_inox", facadeStyle: "lisse", interieur: "blanc" }
        : { finition: finitionEffective(fiche.gamme, fiche.finition), poignees: fiche.poignees, facadeStyle: fiche.facadeStyle, interieur: fiche.interieur },
    [fiche],
  );

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
        <StyleContext.Provider value={style}>
          <OuvertureContext.Provider value={ouverture}>
            {fiche.famille === "dressing" || fiche.famille === "placard" ? <Rangement fiche={fiche} /> : fiche.famille === "cuisine" ? <Cuisine fiche={fiche} /> : <Fenetre fiche={fiche} />}
          </OuvertureContext.Provider>
        </StyleContext.Provider>
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
          <div className="pointer-events-none absolute bottom-4 right-4 hidden rounded-full bg-white/80 px-3 py-1 text-xs text-stone-600 backdrop-blur lg:block">
            {fiche.famille === "fenetre" ? (fiche.ouverture === "oscillo_battant" ? "Cliquez sur un vantail pour le basculer" : "Cliquez sur un vantail pour l’ouvrir") : "Cliquez sur une porte ou un tiroir pour l’ouvrir"}
          </div>
        </>
      )}
    </>
  );
}
