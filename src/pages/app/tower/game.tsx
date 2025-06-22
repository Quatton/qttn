import { Torus, PerspectiveCamera, Box } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  RapierRigidBody,
  type RapierContext,
  useRapier,
} from "@react-three/rapier";
import {
  createRef,
  type RefObject,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { joinRoom, selfId } from "trystero/torrent";

const NUM_POLES = 3;
const NUM_RINGS = 3;
const POLE_HEIGHT = 1.5;
const POLE_RADIUS = 0.07;
const RING_HEIGHT = 0.15;
const RING_RADII = [0.4, 0.3, 0.2]; // largest to smallest
const RING_TUBE = 0.1;
const POLE_X = [-2, 0, 2];

function Pole({ x }: { x: number }) {
  return (
    <mesh position={[x, POLE_HEIGHT / 2, 0]}>
      <cylinderGeometry args={[POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 32]} />
      <meshStandardMaterial color="#888" />
    </mesh>
  );
}

function Ring({
  position,
  radius,
  color,
  rbRef,
  ref,
}: {
  position: THREE.Vector3;
  radius: number;
  color: string;
  idx: number;
  rbRef?: RefObject<RapierRigidBody | null>;
  ref?: RefObject<THREE.Object3D | null>;
}) {
  return (
    <RigidBody
      lockRotations={true}
      type="dynamic"
      colliders={"cuboid"}
      restitution={0}
      position={position}
      ref={rbRef}
    >
      <group ref={ref}>
        {/* Torus geometry */}
        <Torus
          args={[radius, RING_TUBE, 16, 64]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color={color} />
        </Torus>
      </group>
    </RigidBody>
  );
}

export function TowerGame() {
  // Track ring positions: [poleIndex, heightIndex]
  const [ringState, setRingState] = useState(
    RING_RADII.map((_, i) => ({
      pole: 0,
      height: NUM_RINGS - 1 - i,
    })),
  );

  const host = useRef<string | null>(null);

  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const objectRefs = useRef<RefObject<THREE.Object3D | null>[]>(
    RING_RADII.map(() => createRef()),
  );
  const rigidBodyRefs = useRef<RefObject<RapierRigidBody | null>[]>(
    RING_RADII.map(() => createRef()),
  );
  const raycasterRef = useRef(new THREE.Raycaster());

  const draggingRef = useRef<{
    idx: number;
    initialPosition: THREE.Vector3;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<RapierContext | null>(null);

  const room = joinRoom(
    {
      appId: "tower-qttn-dev",
    },
    "tower-game",
  );

  const [sendMoveRing, getMoveRing] = room.makeAction<{
    idx: number;
    translation?: [number, number, number];
    status: "start" | "move" | "end";
  }>("moveRing");

  getMoveRing((action) => {
    const { idx, translation } = action;
    const rb = rigidBodyRefs.current[idx].current;
    if (rb) {
      if (translation) {
        rb.setTranslation(new THREE.Vector3(...translation), false);
      }
      if (action.status === "start") {
        rb.lockTranslations(true, false);
      } else if (action.status === "end") {
        rb.lockTranslations(false, true);
      }
    }
  });

  // Accepts normalized device coordinates (NDC) x, y in [-1, 1]
  function startMove({ x, y }: { x: number; y: number }) {
    const raycaster = raycasterRef.current;

    raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      cameraRef.current as THREE.Camera,
    );
    const intersects = raycaster.intersectObjects(
      objectRefs.current.map((ref) => ref.current as THREE.Object3D),
      true,
    );
    if (intersects.length === 0) return;
    const intersectedObject = intersects[0].object;
    const idx = objectRefs.current.findIndex(
      (ref) => ref.current?.uuid === intersectedObject.parent?.uuid,
    );
    if (idx === -1) return;
    rigidBodyRefs.current[idx].current?.lockTranslations(true, false);
    sendMoveRing({
      idx,
      status: "start",
    });
    draggingRef.current = {
      idx,
      initialPosition: new THREE.Vector3().copy(
        rigidBodyRefs.current[idx].current?.translation() ||
          new THREE.Vector3(),
      ),
    };
  }

  function move({ x, y }: { x: number; y: number }) {
    if (!draggingRef.current) return;
    const raycaster = raycasterRef.current;

    raycaster.setFromCamera(
      new THREE.Vector2(x, y),
      cameraRef.current as THREE.Camera,
    );
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    if (!intersection) return;
    const { idx, initialPosition } = draggingRef.current;
    const newPosition = new THREE.Vector3(
      intersection.x,
      intersection.y,
      initialPosition.z,
    );
    const rb = rigidBodyRefs.current[idx].current;
    if (rb) {
      rb.setTranslation(newPosition, false);
      sendMoveRing({
        idx,
        translation: [newPosition.x, newPosition.y, newPosition.z],
        status: "move",
      });
    }
  }

  function endMove() {
    if (!draggingRef.current) return;
    rigidBodyRefs.current.forEach((ref) => {
      ref.current?.lockTranslations(false, true);
    });
    sendMoveRing({
      idx: draggingRef.current.idx,
      status: "end",
    });
    draggingRef.current = null;
  }

  // Utility to get NDC from event (mouse or touch)
  function getNDCFromEvent(e: React.PointerEvent | React.TouchEvent) {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }

  return (
    <section className="mx-auto max-w-full">
      <Canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          const ndc = getNDCFromEvent(e);
          if (ndc) startMove(ndc);
        }}
        onPointerMove={(e) => {
          const ndc = getNDCFromEvent(e);
          if (ndc) move(ndc);
        }}
        onPointerUp={endMove}
        onTouchStart={(e) => {
          const ndc = getNDCFromEvent(e);
          if (ndc) startMove(ndc);
        }}
        onTouchMove={(e) => {
          const ndc = getNDCFromEvent(e);
          if (ndc) move(ndc);
        }}
        onTouchEnd={endMove}
        style={{ width: "100%", height: 500 }}
      >
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 1, 5]}
          up={[0, 1, 0.2]}
          fov={60}
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={0.7} />
        <pointLight position={[0, 3, 0]} intensity={2} />
        <pointLight position={[-2, 3, 0]} intensity={2} />
        <pointLight position={[0, 3, 2]} intensity={2} />

        <Suspense fallback={null}>
          <Physics debug>
            <HostSetter room={room} host={host} rbs={rigidBodyRefs} />
            {/* Poles */}
            {POLE_X.map((x, i) => (
              <Pole key={i} x={x} />
            ))}
            {/* Rings */}
            {ringState.map((r, i) => (
              <Ring
                key={i}
                position={
                  new THREE.Vector3(
                    POLE_X[0],
                    RING_HEIGHT / 2 + (NUM_RINGS + i) * (RING_HEIGHT + 0.01),
                    0,
                  )
                }
                rbRef={rigidBodyRefs.current[i]}
                ref={objectRefs.current[i]}
                radius={RING_RADII[i]}
                color={["#e74c3c", "#f1c40f", "#3498db"][i % 3]}
                idx={i}
              />
            ))}
            {/* Ground */}
            <RigidBody type="fixed">
              <Box args={[10, 0.1, 10]} position={[0, -0.05, 0]} receiveShadow>
                <meshStandardMaterial color="#555" />
              </Box>
            </RigidBody>
          </Physics>
        </Suspense>
      </Canvas>
    </section>
  );
}

function HostSetter({
  room,
  host,
  rbs,
}: {
  room: ReturnType<typeof joinRoom>;
  host: RefObject<string | null>;
  rbs: RefObject<RefObject<RapierRigidBody | null>[]>;
}) {
  const age = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      age.current += 1;
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const [claimHost, getHost] = room.makeAction<{
    id: string;
    age: number;
    translations: number[][];
  }>("claimHost");

  room.onPeerJoin((peerId) => {
    console.log(`Peer joined: ${peerId}`);
    if (
      (host.current === null || !(host.current in room.getPeers())) &&
      peerId !== selfId
    ) {
      console.log(`Claiming host for peer: ${peerId}`);
      host.current = selfId;
      claimHost({
        id: selfId,
        age: age.current,
        translations: rbs.current.map((rb) => {
          const translation = rb.current?.translation();
          return translation
            ? [translation.x, translation.y, translation.z]
            : [0, 0, 0];
        }),
      });
    }
  });

  getHost(({ id, age: their, translations }) => {
    console.log(`Received host claim: ${id}, age: ${age}`);
    if (their > age.current) {
      host.current = id;
      console.log(`Host is now: ${host.current}`);
      rbs.current.forEach((rb, idx) => {
        if (rb.current) {
          rb.current.setTranslation(
            new THREE.Vector3(...translations[idx]),
            false,
          );
        }
      });
    }
  });

  return null;
}
