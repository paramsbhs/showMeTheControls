import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'

function RotorDisk({ color }) {
  const ref = useRef()
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 20 })
  return (
    <mesh ref={ref} position={[0, 0.06, 0]}>
      <cylinderGeometry args={[0.16, 0.16, 0.01, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} metalness={0.2} />
    </mesh>
  )
}

function DroneModel({ altitude }) {
  const ref = useRef()
  useFrame(() => { if (ref.current) ref.current.position.y = altitude })

  return (
    <group ref={ref} position={[0, altitude, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color='#1a1a2e' metalness={0.6} roughness={0.3} />
      </mesh>
      {[[-1,1],[1,1],[-1,-1],[1,-1]].map(([ax, az], i) => (
        <group key={i} position={[ax*0.35, 0, az*0.35]}>
          <mesh rotation={[0, Math.PI/4*(ax===az?1:-1), 0]}>
            <boxGeometry args={[0.5, 0.04, 0.06]} />
            <meshStandardMaterial color='#e0e0e0' metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
            <meshStandardMaterial color='#333' metalness={0.8} roughness={0.2} />
          </mesh>
          <RotorDisk color='#aaaaaa' />
        </group>
      ))}
      <mesh position={[0, -0.07, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color='#5fa882' emissive='#5fa882' emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

function FollowCamera({ altitude, enabled }) {
  const { camera } = useThree()
  const camPos    = useMemo(() => new THREE.Vector3(), [])
  const camTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!enabled) return
    // Maintain fixed diagonal offset from drone
    camPos.set(4, altitude + 4, 4)
    camera.position.lerp(camPos, 0.06)
    camTarget.set(0, altitude, 0)
    camera.lookAt(camTarget)
  })

  return null
}

export default function QuadcopterScene({ points, playhead, setpoint, followCam }) {
  const pt  = points[Math.min(playhead, points.length - 1)]
  const alt = pt?.z ?? 0

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color='#aaaaaa' />

      <DroneModel altitude={alt} />

      {/* Setpoint ring */}
      <mesh position={[0, setpoint, 0]} rotation={[Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.8, 0.9, 40]} />
        <meshStandardMaterial color='#c4835a' transparent opacity={0.6} side={2} />
      </mesh>

      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color='#1a1a1a' metalness={0.1} roughness={0.8} />
      </mesh>

      <Grid position={[0, 0.001, 0]} args={[20,20]} cellSize={1}
        cellColor='#333333' sectionColor='#444444' fadeDistance={15} />

      <FollowCamera altitude={alt} enabled={followCam && points.length > 0} />

      <OrbitControls enabled={!followCam} enablePan={false} minDistance={2} maxDistance={20}
        maxPolarAngle={Math.PI/2.1} />
    </>
  )
}
