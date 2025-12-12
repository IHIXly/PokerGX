"use cient"

import * as THREE from "three"
import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Physics, RigidBody, BallCollider } from "@react-three/rapier"
import { Environment } from "@react-three/drei"
import { RoundedBox } from "@react-three/drei"

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 35 }}>
      <ambientLight intensity={0.25} />
      <directionalLight color="blue" position={[5, 5, 5]} intensity={1} />
      <Environment preset="studio" />

      <Physics gravity={[0, 0, 0]}>
        <Pointer />
        <Boxes />
      </Physics>

      <OrbitControls />
    </Canvas>
  )
}

function Boxes() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <FloatingBox key={i} />
      ))}
    </>
  )
}

function FloatingBox() {
  const ref = useRef<any>(null)

  const position = useMemo<[number, number, number]>(
  () => [
    THREE.MathUtils.randFloatSpread(6),
    THREE.MathUtils.randFloatSpread(6),
    THREE.MathUtils.randFloatSpread(6),
  ],
  []
)

  useFrame(() => {
    if (!ref.current) return

    const pos = ref.current.translation()
    const force = new THREE.Vector3(pos.x, pos.y, pos.z)
      .negate()
      .multiplyScalar(0.15)

    ref.current.applyImpulse(force)
  })

  return (
    <RigidBody
        ref={ref}
        position={position}
        linearDamping={4}
        angularDamping={1}
        colliders="cuboid"
        >
        <RoundedBox args={[1, 1, 1]} radius={0.15} smoothness={6}>
            <meshPhysicalMaterial
            color="#5b2cff"
            roughness={0.25}
            metalness={0.6}
            clearcoat={1}
            clearcoatRoughness={0.1}
            />
        </RoundedBox>
    </RigidBody>
  )
}

function Pointer() {
  const ref = useRef<any>(null)
  const vec = new THREE.Vector3()

  useFrame(({ mouse, viewport }) => {
    ref.current?.setNextKinematicTranslation(
      vec.set(
        (mouse.x * viewport.width) / 2,
        (mouse.y * viewport.height) / 2,
        0
      )
    )
  })

  return (
    <RigidBody type="kinematicPosition" colliders={false} ref={ref}>
      <BallCollider args={[0.6]} />
    </RigidBody>
  )
}
