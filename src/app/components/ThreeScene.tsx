"use client"

import * as THREE from "three"
import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, useGLTF } from "@react-three/drei"

function PokerChip() {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF("/models/Pokerchipround.glb")

  // schöner Produkt-Winkel
  const defaultRot = useMemo(() => ({
    x: 0.60,
    y: 0,
    z: 0.1,
  }), [])

  const autoSpinSpeed = 0.25
  const hoverAmp = 0.12
  const hoverSpeed = 1.2

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return

    const t = clock.getElapsedTime()

    // Hover
    g.position.y = Math.sin(t * hoverSpeed) * hoverAmp

    // Auto-Spin
    g.rotation.y += autoSpinSpeed * delta

    // Fixer Winkel (bleibt konstant)
    g.rotation.x = defaultRot.x
    g.rotation.z = defaultRot.z
  })

  return (
    <group ref={group}>
      <primitive object={scene} scale={1} />
    </group>
  )
}

useGLTF.preload("/models/Pokerchip.glb")

export default function ThreeScene() {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 35 }}>
      <ambientLight intensity={0.02} />
      <directionalLight position={[5, 2, 5]} intensity={15} />
      <Environment
        preset="studio"
        // background // nur zum Test: einschalten, damit du sicher siehst ob die Props greifen
        environmentIntensity={1}
        backgroundIntensity={0.2}
        blur={0.2}
      />


      <PokerChip />
    </Canvas>
  )
}
