/* eslint-disable react/no-unknown-property -- Three.js / R3F props (position, args, intensity, etc.) */
import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

type System = { id: number; name: string; coord_x?: number; coord_y?: number; coord_z?: number };
type Body = { id: number; name: string; body_type?: string };

/* Звезда в центре (для вида системы) */
function CentralStar() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.002;
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshBasicMaterial color="#fff8e7" />
      <pointLight color="#fff5d6" intensity={80} distance={50} />
    </mesh>
  );
}

/* Один кликабельный объект — звезда (система) в 3D пространстве */
function SystemNode({
  system,
  position,
  isSelected,
  onClick,
}: {
  system: System;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.02;
  });
  const scale = hovered || isSelected ? 1.4 : 1;
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={scale}
      >
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshBasicMaterial
          color={isSelected ? '#818cf8' : hovered ? '#a5b4fc' : '#fbbf24'}
          transparent
          opacity={0.95}
        />
      </mesh>
      <pointLight color="#fbbf24" intensity={5} distance={8} />
      <Html
        position={[0, 0.6, 0]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          fontSize: 11,
          color: hovered || isSelected ? '#c7d2fe' : '#a3a3a3',
          textShadow: '0 0 8px #000',
          opacity: hovered || isSelected ? 1 : 0.7,
        }}
      >
        {system.name}
      </Html>
    </group>
  );
}

/* Один кликабельный объект — планета/корабль на орбите */
function BodyNode({
  body,
  position,
  isSelected,
  isShip,
  onClick,
}: {
  body: Body;
  position: [number, number, number];
  isSelected: boolean;
  isShip: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.015;
  });
  const scale = hovered || isSelected ? 1.3 : 1;
  const color = isShip ? '#34d399' : '#60a5fa';
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={scale}
      >
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial
          color={isSelected ? '#a7f3d0' : hovered ? '#6ee7b7' : color}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      <Html
        position={[0, 0.45, 0]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          fontSize: 10,
          color: hovered || isSelected ? '#d1fae5' : '#9ca3af',
          textShadow: '0 0 6px #000',
          opacity: hovered || isSelected ? 1 : 0.8,
        }}
      >
        {body.name}
      </Html>
    </group>
  );
}

/* Сцена: галактика — звёздные системы в 3D */
function GalaxyScene({
  systems,
  selectedSystemId,
  onSelectSystem,
}: {
  systems: System[];
  selectedSystemId: number | null;
  onSelectSystem: (s: System) => void;
}) {
  const scale = 12;
  const hasCoords = systems.some(
    (s) =>
      (s.coord_x != null && s.coord_x !== 0) ||
      (s.coord_y != null && s.coord_y !== 0) ||
      (s.coord_z != null && s.coord_z !== 0)
  );

  return (
    <>
      <Stars radius={80} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1} />
      <ambientLight intensity={0.4} />
      <pointLight position={[20, 20, 20]} intensity={30} />
      {systems.map((sys, i) => {
        let x: number, y: number, z: number;
        if (hasCoords && sys.coord_x != null && sys.coord_y != null) {
          x = (sys.coord_x ?? 0) * scale;
          y = (sys.coord_y ?? 0) * scale;
          z = (sys.coord_z ?? 0) * scale;
        } else {
          const angle = (i / Math.max(systems.length, 1)) * Math.PI * 2;
          const r = 3 + (i % 3) * 2;
          x = Math.cos(angle) * r * scale * 0.5;
          y = (Math.random() - 0.5) * scale;
          z = Math.sin(angle) * r * scale * 0.5;
        }
        return (
          <SystemNode
            key={sys.id}
            system={sys}
            position={[x, y, z]}
            isSelected={selectedSystemId === sys.id}
            onClick={() => onSelectSystem(sys)}
          />
        );
      })}
    </>
  );
}

/* Сцена: звёздная система — звезда в центре + тела на орбитах */
function SystemScene({
  bodies,
  selectedBodyId,
  onSelectBody,
}: {
  bodies: Body[];
  selectedBodyId: number | null;
  onSelectBody: (b: Body) => void;
}) {
  const orbitRadius = 4;
  return (
    <>
      <Stars radius={60} depth={40} count={2000} factor={3} saturation={0.4} fade speed={1} />
      <ambientLight intensity={0.5} />
      <CentralStar />
      {bodies.map((body, i) => {
        const angle = (i / Math.max(bodies.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * orbitRadius;
        const z = Math.sin(angle) * orbitRadius;
        const isShip = body.body_type === 'Ship' || body.body_type === 'Station';
        return (
          <BodyNode
            key={body.id}
            body={body}
            position={[x, 0, z]}
            isSelected={selectedBodyId === body.id}
            isShip={isShip}
            onClick={() => onSelectBody(body)}
          />
        );
      })}
    </>
  );
}

type Space3DViewProps =
  | {
      mode: 'galaxy';
      systems: System[];
      selectedSystemId: number | null;
      onSelectSystem: (s: System) => void;
    }
  | {
      mode: 'system';
      bodies: Body[];
      selectedBodyId: number | null;
      onSelectBody: (b: Body) => void;
    };

export function Space3DView(props: Space3DViewProps) {
  const isEmpty =
    (props.mode === 'galaxy' && props.systems.length === 0) ||
    (props.mode === 'system' && props.bodies.length === 0);

  if (isEmpty) {
    return (
      <div className="absolute inset-0 w-full h-full bg-[#0a0a12] flex items-center justify-center text-dark-500">
        {props.mode === 'galaxy' ? 'Нет звёздных систем' : 'Нет объектов в системе'}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full min-h-[300px] overflow-hidden bg-[#0a0a12]">
      <Canvas
        camera={{ position: [0, 8, 20], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <Suspense
          fallback={
            <Html center style={{ color: '#94a3b8', fontSize: 14 }}>
              Загрузка 3D...
            </Html>
          }
        >
          {props.mode === 'galaxy' && (
            <GalaxyScene
              systems={props.systems}
              selectedSystemId={props.selectedSystemId}
              onSelectSystem={props.onSelectSystem}
            />
          )}
          {props.mode === 'system' && (
            <SystemScene
              bodies={props.bodies}
              selectedBodyId={props.selectedBodyId}
              onSelectBody={props.onSelectBody}
            />
          )}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={5}
            maxDistance={80}
            maxPolarAngle={Math.PI * 0.95}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
