import {
  OrbitControls,
  Torus,
  DragControls,
  PerspectiveCamera,
  Box,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  BallCollider,
  RapierRigidBody,
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

  return (
    <section className="mx-auto max-w-3xl">
      <Canvas
        ref={canvasRef}
        onMouseDown={(e) => {
          const raycaster = raycasterRef.current;
          const mouse = new THREE.Vector2();

          // use canvas w/ h and h for mouse coordinates
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, cameraRef.current as THREE.Camera);
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

          draggingRef.current = {
            idx,
            initialPosition: new THREE.Vector3().copy(
              rigidBodyRefs.current[idx].current?.translation() ||
                new THREE.Vector3(),
            ),
          };
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current) return;

          const raycaster = raycasterRef.current;
          const mouse = new THREE.Vector2();

          // use canvas w/ h and h for mouse coordinates
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          // get world coordinates of mouse to plane xy at z = 0
          raycaster.setFromCamera(mouse, cameraRef.current as THREE.Camera);
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
          }
        }}
        onMouseUp={() => {
          draggingRef.current = null;
          rigidBodyRefs.current.forEach((ref) => {
            ref.current?.lockTranslations(false, true);
          });
        }}
        style={{ width: "100%", height: 500 }}
      >
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 1, 3]}
          up={[0, 1, 0.2]}
          fov={60}
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={0.7} />
        <pointLight position={[0, 2, 0]} intensity={2} />
        <pointLight position={[-2, 2, 0]} intensity={2} />
        <pointLight position={[0, 2, 2]} intensity={2} />

        <Suspense fallback={null}>
          <Physics debug>
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
