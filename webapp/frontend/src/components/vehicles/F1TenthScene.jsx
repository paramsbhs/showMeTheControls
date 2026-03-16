import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const TRACK_R = 8.0
const TRACK_W = 1.4

// Shortest signed angular distance
function shortAngleDelta(a, b) {
  let d = b - a
  while (d >  Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

function TrackSurface() {
  const innerR = TRACK_R - TRACK_W / 2
  const outerR = TRACK_R + TRACK_W / 2
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR, outerR, 120]} />
        <meshStandardMaterial color='#1a2a1a' roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[outerR, outerR + 0.18, 120]} />
        <meshStandardMaterial color='#8b1a1a' roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[innerR - 0.18, innerR, 120]} />
        <meshStandardMaterial color='#8b1a1a' roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[TRACK_R - 0.04, TRACK_R + 0.04, 120]} />
        <meshStandardMaterial color='#ffffff' emissive='#ffffff' emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[TRACK_R, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK_W, 0.22]} />
        <meshStandardMaterial color='#ffffff' emissive='#ffffff' emissiveIntensity={0.6} />
      </mesh>
    </>
  )
}

function Trail({ points, playhead }) {
  const ref = useRef()
  const MAX_TRAIL = 150

  useFrame(() => {
    if (!ref.current || !points.length) return
    const end   = Math.min(playhead, points.length - 1)
    const start = Math.max(0, end - MAX_TRAIL)
    const count = end - start + 1
    const pos = ref.current.geometry.attributes.position
    for (let i = 0; i < MAX_TRAIL; i++) {
      const idx = start + Math.min(i, count - 1)
      const pt  = points[idx]
      pos.setXYZ(i, pt?.x ?? 0, 0.05, -(pt?.y ?? 0))
    }
    pos.needsUpdate = true
  })

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3))
    return g
  }, [])

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color='#ff6b35' size={0.1} transparent opacity={0.75} sizeAttenuation />
    </points>
  )
}

export default function F1TenthScene({ points, playhead, followCam }) {
  const { camera } = useThree()
  const carRef = useRef()

  // Camera smoothing state
  const smoothCamPos = useMemo(() => new THREE.Vector3(0, 20, 8), [])
  const smoothCamTgt = useMemo(() => new THREE.Vector3(0, 0.3, 0), [])
  const desiredPos   = useMemo(() => new THREE.Vector3(), [])
  const desiredTgt   = useMemo(() => new THREE.Vector3(), [])
  const justEnabled  = useRef(true)

  // Interpolation tracking
  const lastPlayheadRef   = useRef(playhead)
  const lastUpdateTimeRef = useMemo(() => ({ t: 0 }), [])

  useFrame(({ clock }, dt) => {
    if (!points.length || !carRef.current) return

    // Detect playhead advance and record when it happened
    if (playhead !== lastPlayheadRef.current) {
      lastPlayheadRef.current = playhead
      lastUpdateTimeRef.t = clock.getElapsedTime()
    }

    // Fractional interpolation between current point and next
    const cur  = points[Math.min(playhead, points.length - 1)]
    const next = points[Math.min(playhead + 1, points.length - 1)]
    const elapsed = clock.getElapsedTime() - lastUpdateTimeRef.t
    const frac    = Math.min(1, elapsed / 0.02)  // 0.02 s = 20 ms playhead interval

    const ix  = cur.x   + (next.x   - cur.x)   * frac
    const iy  = cur.y   + (next.y   - cur.y)   * frac
    const ips = cur.psi + shortAngleDelta(cur.psi, next.psi) * frac

    // Move car imperatively (no React re-render needed)
    carRef.current.position.set(ix, 0.12, -iy)
    carRef.current.rotation.y = ips

    // Follow camera
    if (!followCam) { justEnabled.current = true; return }

    const BACK = 4.0, UP = 1.8
    desiredPos.set(ix - Math.cos(ips) * BACK, 0.12 + UP, -iy + Math.sin(ips) * BACK)
    desiredTgt.set(ix + Math.cos(ips) * 2.0,  0.3,        -iy - Math.sin(ips) * 2.0)

    const alpha = justEnabled.current ? 1.0 : Math.min(1, 7 * dt)
    justEnabled.current = false

    smoothCamPos.lerp(desiredPos, alpha)
    smoothCamTgt.lerp(desiredTgt, alpha)
    camera.position.copy(smoothCamPos)
    camera.lookAt(smoothCamTgt)
  })

  const init = points[0] ?? {}
  const initX   = init.x   ?? TRACK_R
  const initY   = init.y   ?? 0
  const initPsi = init.psi ?? Math.PI / 2

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 20, 0]} intensity={1.0} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.4} color='#e0f0ff' />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color='#0a1a0a' roughness={1} />
      </mesh>

      <TrackSurface />
      <Trail points={points} playhead={playhead} />

      {/* Car — position driven imperatively by useFrame above */}
      <group ref={carRef} position={[initX, 0.12, -initY]} rotation={[0, initPsi, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.36, 0.1, 0.18]} />
          <meshStandardMaterial color='#1d4ed8' metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.12, 0]}>
          <boxGeometry args={[0.14, 0.06, 0.12]} />
          <meshStandardMaterial color='#0a0a1a' metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[0.2, 0.04, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.26]} />
          <meshStandardMaterial color='#e0e0e0' metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[-0.2, 0.14, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.24]} />
          <meshStandardMaterial color='#e0e0e0' metalness={0.4} roughness={0.4} />
        </mesh>
        {[[ 0.16, 0,  0.12], [ 0.16, 0, -0.12],
          [-0.16, 0,  0.12], [-0.16, 0, -0.12]].map(([wx, wy, wz], i) => (
          <mesh key={i} position={[wx, wy, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.05, 12]} />
            <meshStandardMaterial color='#222' roughness={0.9} />
          </mesh>
        ))}
        <pointLight position={[0.22, 0.06, 0]} intensity={0.6} color='#fffbe0' distance={2} />
      </group>

      <OrbitControls
        enabled={!followCam}
        enablePan={false}
        minDistance={5} maxDistance={40}
        minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />
    </>
  )
}
