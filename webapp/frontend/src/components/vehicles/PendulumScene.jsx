import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const RAIL_LEN  = 5.0   // visual rail half-length
const POLE_LEN  = 1.0   // visual pole length (= 2 * L_HALF)
const X_SCALE   = 1.0   // sim x (m) → Three units

function Cart({ x, theta }) {
  const cartRef = useRef()
  const poleRef = useRef()

  useFrame(() => {
    if (cartRef.current) cartRef.current.position.x = x * X_SCALE
    if (poleRef.current) {
      // pole pivots at top of cart; theta=0 is upright
      poleRef.current.rotation.z = -theta
    }
  })

  return (
    <group>
      {/* Rail */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[RAIL_LEN * 2, 0.06, 0.12]} />
        <meshStandardMaterial color='#374151' metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Cart body */}
      <group ref={cartRef} position={[x * X_SCALE, 0, 0]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.45, 0.28, 0.3]} />
          <meshStandardMaterial color='#1d4ed8' metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Wheels */}
        {[-0.14, 0.14].map((wx, i) => (
          <group key={i}>
            {[-0.12, 0.12].map((wz, j) => (
              <mesh key={j} position={[wx, 0.04, wz]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.055, 0.055, 0.05, 12]} />
                <meshStandardMaterial color='#222' roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Pole pivot point indicator */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color='#9ca3af' metalness={0.8} />
        </mesh>

        {/* Pole (rotates around pivot) */}
        <group ref={poleRef} position={[0, 0.3, 0]}>
          {/* Pole rod — origin at pivot, extends upward */}
          <mesh position={[0, POLE_LEN/2, 0]}>
            <cylinderGeometry args={[0.025, 0.025, POLE_LEN, 8]} />
            <meshStandardMaterial color='#f59e0b' metalness={0.3} roughness={0.5} />
          </mesh>
          {/* Bob at tip */}
          <mesh position={[0, POLE_LEN, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color='#ef4444' metalness={0.4} roughness={0.4}
              emissive='#7f1d1d' emissiveIntensity={0.3} />
          </mesh>
        </group>

        {/* Upright target line (ghost) */}
        <mesh position={[0, POLE_LEN/2 + 0.3, 0]}>
          <cylinderGeometry args={[0.008, 0.008, POLE_LEN, 6]} />
          <meshStandardMaterial color='#374151' transparent opacity={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function FollowCamera({ cartX, enabled }) {
  const { camera } = useThree()
  const camPos    = useMemo(() => new THREE.Vector3(), [])
  const camTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!enabled) return
    // Track cart's X position, keep fixed height and depth
    camPos.set(cartX, 1.5, 10)
    camera.position.lerp(camPos, 0.1)
    camTarget.set(cartX, 1.0, 0)
    camera.lookAt(camTarget)
  })

  return null
}

export default function PendulumScene({ points, playhead, followCam }) {
  const pt    = points[Math.min(playhead, points.length - 1)]
  const x     = pt?.x ?? 0
  const theta = pt?.theta ?? 0.1
  const fallen = Math.abs(theta) > 0.9 * Math.PI

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 4]} intensity={1.0} />
      <pointLight position={[0, 4, 3]} intensity={0.4} color='#e0f0ff' />

      <Cart x={x} theta={theta} />
      <FollowCamera cartX={x} enabled={followCam && points.length > 0} />

      {fallen && (
        // Red tint on floor when fallen
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.09, 0]}>
          <planeGeometry args={[12, 4]} />
          <meshStandardMaterial color='#7f1d1d' transparent opacity={0.25} />
        </mesh>
      )}

      {/* Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.09, 0]}>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial color='#0d1117' roughness={0.9} />
      </mesh>
    </>
  )
}
