import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, Grid, DragControls } from "@react-three/drei";
import { useScrollDetectorState } from "@/components/react/scroll-detector";
import { createRef, useCallback, useEffect, useRef, useState } from "react";
import { Euler, Mesh, Quaternion, Vector3 } from "three";

export function InverseKinematics() {
  const { scrollPassed } = useScrollDetectorState();
  const [dragging, setDragging] = useState(false);
  const [targetPosition, setTargetPosition] = useState(new Vector3(0, 0, 2));

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [3, 3, 3] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {!scrollPassed["robot-arm"] && (
          <Box args={[1, 1, 1]} position={[0, 0.5, 0]}>
            <meshStandardMaterial color="orange" />
          </Box>
        )}

        {scrollPassed["robot-arm"] && (
          <RobotArm target={scrollPassed.ik ? targetPosition : undefined} />
        )}

        <Target setPosition={setTargetPosition} setDragging={setDragging} />

        <Grid args={[100, 100]} />

        <OrbitControls enabled={!dragging} enableDamping={false} />
      </Canvas>
    </div>
  );
}

const colors = ["orange", "blue", "green", "red", "purple"];
const lengths = [0.5, 0.5, 0.5, 0.5, 0.5];
const MAX_ITERATIONS = 10;

function RobotArm({ target }: { target?: Vector3 }) {
  const { scrollPassed } = useScrollDetectorState();

  const [rotations, setRotations] = useState(colors.map(() => new Quaternion()));

  const jointRefs = useRef([...colors.map(() => createRef<Mesh>()), createRef<Mesh>()]);

  const updateRotations = useCallback(() => {
    if (!target) return;

    const endIndex = colors.length - 1;
    const end = jointRefs.current[jointRefs.current.length - 1].current;
    if (!end) return;

    const newRotations = rotations.map((r) => r.clone());

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      for (let i = endIndex; i >= 0; i--) {
        const endEffector = end.getWorldPosition(new Vector3());
        const joint = jointRefs.current[i].current;
        if (!joint) continue;
        const ev = joint.worldToLocal(endEffector.clone()).normalize();
        const tv = joint.worldToLocal(target.clone()).normalize();
        const q = new Quaternion().setFromUnitVectors(ev, tv);
        newRotations[i].multiply(q);
        joint.quaternion.copy(newRotations[i]);

        if (scrollPassed["ik-hinge"]) {
          const invq = joint.quaternion.clone().invert();
          const axis = i === 0 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
          const parent = axis.clone().applyQuaternion(invq);
          q.setFromUnitVectors(axis, parent);
          newRotations[i].multiply(q);
          joint.quaternion.copy(newRotations[i]);
        }

        if (i !== 0 && scrollPassed["ik-clamp"]) {
          const euler = joint.rotation;
          const clamped = new Vector3()
            .setFromEuler(euler)
            .clamp(
              new Vector3(-Math.PI / i, -Math.PI / i, -Math.PI / i),
              new Vector3(Math.PI / i, Math.PI / i, Math.PI / i),
            );
          newRotations[i].setFromEuler(new Euler(clamped.x, clamped.y, clamped.z));
          joint.quaternion.copy(newRotations[i]);
        }
      }
    }

    setRotations(newRotations);
  }, [target, rotations]);

  useEffect(() => {
    if (target) {
      updateRotations();
    }
  }, [target]);

  return (
    <group>
      <RobotJoint
        colors={colors}
        lengths={lengths}
        rotations={rotations}
        refs={jointRefs.current}
      />
    </group>
  );
}

function RobotJoint({
  colors,
  lengths,
  rotations,
  refs,
}: {
  colors: string[];
  lengths: number[];
  rotations: Quaternion[];
  refs: React.RefObject<Mesh | null>[];
}) {
  const length = lengths[0];
  const color = colors[0];
  const rotation = rotations[0];
  const ref = refs[0];

  return (
    <group ref={ref} quaternion={rotation}>
      <Box args={[0.2, length, 0.2]} position={[0, length / 2, 0]}>
        <meshStandardMaterial color={color} />
      </Box>

      <group position={[0, length, 0]}>
        {lengths.length > 1 && (
          <RobotJoint
            colors={colors.slice(1)}
            lengths={lengths.slice(1)}
            rotations={rotations.slice(1)}
            refs={refs.slice(1)}
          />
        )}
        <mesh ref={refs.slice(1).length === 1 ? refs.slice(1)[0] : undefined}>
          <sphereGeometry args={[0.1, 32, 32]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}

const RADIUS = 0.2;
function Target({
  setPosition,
  setDragging,
}: {
  setPosition: (position: Vector3) => void;
  setDragging?: (dragging: boolean) => void;
}) {
  const { scrollPassed } = useScrollDetectorState();
  if (!scrollPassed["target"]) {
    return null;
  }

  return (
    <DragControls
      onDrag={(localTransform) => {
        const BASE_POSITION = new Vector3(0, 0, 2);
        const newPosition = BASE_POSITION.applyMatrix4(localTransform);
        setPosition(newPosition);
      }}
      onHover={(hover) => {
        setDragging?.(hover);
      }}
    >
      <group position={[0, 0, 2]}>
        <mesh position={[0, RADIUS, 0]}>
          <sphereGeometry args={[RADIUS, 32, 32]} />
          <meshStandardMaterial color="yellow" />
        </mesh>
      </group>
    </DragControls>
  );
}
