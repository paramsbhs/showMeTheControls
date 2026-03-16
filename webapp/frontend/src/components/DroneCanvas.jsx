import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useSimStore } from '../store/useSimStore'

// Drone body: flat box + 4 arms + 4 rotors
function DroneModel({ altitude }) {
  const bodyRef = useRef()

  // gentle tilt based on velocity (cosmetic)
  useFrame(() => {
    if (bodyRef.current) {
      bodyRef.current.position.y = altitude
    }
  })

  const armColor = '#e0e0e0'
  const rotorColor = '#4a90d9'
  const bodyColor = '#1a1a2e'

  return (
    <group ref={bodyRef} position={[0, altitude, 0]}>
      {/* Central body */}
      <mesh>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Arms (X-configuration) */}
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, z], i) => (
        <group key={i} position={[x * 0.35, 0, z * 0.35]}>
          {/* Arm strut */}
          <mesh rotation={[0, Math.PI / 4 * (x === z ? 1 : -1), 0]}>
            <boxGeometry args={[0.5, 0.04, 0.06]} />
            <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.5} />
          </mesh>
          {/* Motor housing */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
            <meshStandardMaterial color='#333' metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Rotor disk (spinning visually) */}
          <RotorDisk color={rotorColor} />
        </group>
      ))}

      {/* LED on bottom */}
      <mesh position={[0, -0.07, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color='#00ff88' emissive='#00ff88' emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

function RotorDisk({ color }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 20
  })
  return (
    <mesh ref={ref} position={[0, 0.06, 0]} rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.16, 0.16, 0.01, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.35} metalness={0.2} />
    </mesh>
  )
}

// Setpoint marker (dashed ring at target altitude)
function SetpointRing({ altitude }) {
  return (
    <mesh position={[0, altitude, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 0.9, 40]} />
      <meshStandardMaterial color='#ff6b35' transparent opacity={0.6} side={2} />
    </mesh>
  )
}

export default function DroneCanvas() {
  const { points, playhead, setpoint } = useSimStore()

  const currentZ = points.length > 0 ? points[Math.min(playhead, points.length - 1)].z : 0
  const setpointM = setpoint

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [4, 4, 4], fov: 45 }}
        style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
        <pointLight position={[-5, 5, -5]} intensity={0.5} color='#4a90d9' />

        <DroneModel altitude={currentZ} />
        <SetpointRing altitude={setpointM} />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color='#0d1117' metalness={0.1} roughness={0.8} />
        </mesh>

        <Grid
          position={[0, 0.001, 0]}
          args={[20, 20]}
          cellSize={1}
          cellColor='#1e3a5f'
          sectionColor='#2d5986'
          fadeDistance={15}
        />

        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>

      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        color: '#7ec8e3', fontFamily: 'monospace', fontSize: 12,
        background: 'rgba(0,0,0,0.5)', padding: '6px 10px', borderRadius: 6,
        borderLeft: '2px solid #4a90d9',
      }}>
        <div>ALT: <span style={{ color: '#fff' }}>{currentZ.toFixed(2)} m</span></div>
        <div>TGT: <span style={{ color: '#ff6b35' }}>{setpointM.toFixed(2)} m</span></div>
        <div>ERR: <span style={{ color: Math.abs(currentZ - setpointM) < 0.1 ? '#00ff88' : '#ffcc00' }}>
          {(currentZ - setpointM).toFixed(3)} m
        </span></div>
      </div>
    </div>
  )
}
