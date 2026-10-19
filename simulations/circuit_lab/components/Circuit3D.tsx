
import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid, PerspectiveCamera, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Component, Connection, Port, ComponentType, GlobalSettings } from '../types';
import { COLORS, SHORT_CIRCUIT_CURRENT, INITIAL_BATTERY_VOLTAGE, DEFAULT_AMMETER_RANGE, DEFAULT_VOLTMETER_RANGE } from '../constants';
import { View3DSettings } from '../App';

// Define local component variables to fix JSX intrinsic element errors
const Group = 'group' as any;
const Mesh = 'mesh' as any;
const InstancedMesh = 'instancedMesh' as any;
const SphereGeometry = 'sphereGeometry' as any;
const MeshBasicMaterial = 'meshBasicMaterial' as any;
const TubeGeometry = 'tubeGeometry' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const CylinderGeometry = 'cylinderGeometry' as any;
const BoxGeometry = 'boxGeometry' as any;
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;

interface Circuit3DProps {
  components: Component[];
  connections: Connection[];
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  connectionCurrents: Record<string, number>;
  getPorts: (c: Component) => Port[];
  isSimulating: boolean;
  viewSettings: View3DSettings;
  settings?: GlobalSettings;
}

const VOLTAGE_SCALE = 15; 
const POSITION_SCALE = 0.5; 

const getVoltageColor = (voltage: number, maxV: number) => {
  const t = Math.max(0, Math.min(1, voltage / (maxV || 1)));
  return new THREE.Color().lerpColors(
    new THREE.Color(0x172554), 
    new THREE.Color(0xf59e0b), 
    t
  );
};

interface CurrentParticlesProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  current: number;
  isElectronFlow: boolean;
  globalSpeed: number;
}

const CurrentParticles = ({ start, end, current, isElectronFlow, globalSpeed }: CurrentParticlesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // FIXED DENSITY: Number of particles depends ONLY on distance (e.g., 1 particle every 4 units)
  // This ensures that "more current = faster particles" creates the correct flux visually.
  const distance = useMemo(() => start.distanceTo(end), [start, end]);
  const gap = 4; // Distance between particles
  const count = useMemo(() => Math.max(1, Math.floor(distance / gap)), [distance]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    
    // PHYSICS BASED SPEED:
    // Speed = Current Magnitude * Global Setting * Multiplier
    // We normalize by distance in the position calculation so 'speed' represents world units per second.
    const speed = Math.abs(current) * globalSpeed * 8; // Multiplier 8 for visual feel

    // Direction: 
    // Current > 0 means start -> end.
    // Conventional (Yellow): Flows start -> end.
    // Electron (Blue): Flows end -> start (opposite).
    let direction = current > 0 ? 1 : -1;
    if (isElectronFlow) direction *= -1;

    for (let i = 0; i < count; i++) {
      // Uniform distribution: i / count
      // Movement: (time * speed) / distance -> converts world speed to 0..1 progress speed
      let t = ((time * speed / distance) + (i / count)) % 1;
      
      // If moving backwards relative to the vector definition
      if (direction < 0) t = 1 - t;
      
      const pos = new THREE.Vector3().lerpVectors(start, end, t);
      dummy.position.copy(pos);
      
      // Scale: Electrons are smaller
      const scale = isElectronFlow ? 1.2 : 2.0;
      dummy.scale.setScalar(scale); 
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (Math.abs(current) < 0.01) return null;

  return (
    <InstancedMesh ref={meshRef} args={[undefined, undefined, count]} renderOrder={5}>
      <SphereGeometry args={[1, 8, 8]} />
      <MeshBasicMaterial 
        color={isElectronFlow ? "#3b82f6" : "#ffff00"} // Blue for electrons, Yellow for conventional
        depthTest={false} 
        transparent 
        opacity={0.8}
      />
    </InstancedMesh>
  );
};

interface OptimizedComponentProps {
    type: ComponentType | 'wire';
    start: THREE.Vector3;
    end: THREE.Vector3;
    current: number;
    voltage1: number;
    voltage2: number;
    isShort: boolean;
    maxVoltage: number;
    isOn?: boolean;
    label: string;
    showCurrent: boolean;
    isElectronFlow: boolean;
    val?: string;
    globalSpeed: number;
    ammeterRange?: number;
    voltmeterRange?: number;
}

const OptimizedComponent: React.FC<OptimizedComponentProps> = ({ 
    type, start, end, current, voltage1, voltage2, isShort, maxVoltage, isOn, label, showCurrent, isElectronFlow, val, globalSpeed, ammeterRange, voltmeterRange 
}) => {
    const { length, horizontalLength, center, rotation } = useMemo(() => {
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        const hLen = Math.sqrt(dir.x ** 2 + dir.z ** 2) || 0.1;
        const ctr = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return { length: len, horizontalLength: hLen, center: ctr, rotation: rot };
    }, [start, end]);

    // 水平旋轉矩陣 (開關用) - 讓 Local Z 軸從 start 指向 end
    const horizontalRotation = useMemo(() => {
        const mat = new THREE.Matrix4();
        const diffX = end.x - start.x;
        const diffZ = end.z - start.z;
        if (Math.abs(diffX) < 0.01 && Math.abs(diffZ) < 0.01) return new THREE.Quaternion();
        
        mat.lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(diffX, 0, diffZ), new THREE.Vector3(0, 1, 0));
        const q = new THREE.Quaternion().setFromRotationMatrix(mat);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        return q;
    }, [start, end]);

    const curve = useMemo(() => new THREE.LineCurve3(start, end), [start, end]);
    const wireColor = isShort ? COLORS.wireShort : (type === 'wire' || type === 'connector' ? COLORS.wire : '#666');
    const wireRadius = (type === 'wire' || type === 'connector') ? 0.5 : 0.8;

    return (
        <Group>
            {/* 導線渲染 */}
            {(type !== 'switch' || isOn) && (
                <Mesh>
                    <TubeGeometry args={[curve, 1, wireRadius, 8, false]} />
                    <MeshStandardMaterial color={wireColor} transparent={type === 'wire'} opacity={type === 'wire' ? 0.7 : 1} />
                </Mesh>
            )}

            {/* 電位柱 */}
            <Mesh position={[start.x, start.y / 2, start.z]}>
                <CylinderGeometry args={[0.2, 0.2, Math.abs(start.y) || 0.1, 8]} />
                <MeshStandardMaterial color={getVoltageColor(voltage1, maxVoltage)} opacity={0.4} transparent />
            </Mesh>
            <Mesh position={[end.x, end.y / 2, end.z]}>
                <CylinderGeometry args={[0.2, 0.2, Math.abs(end.y) || 0.1, 8]} />
                <MeshStandardMaterial color={getVoltageColor(voltage2, maxVoltage)} opacity={0.4} transparent />
            </Mesh>

            {/* 開關模型 */}
            {type === 'switch' ? (
                <Group position={[center.x, 0, center.z]} quaternion={horizontalRotation}>
                    {/* 設定模型基準高度 (取兩端點較低者的下方一點) */}
                    {(() => {
                        const baseHeight = Math.min(start.y, end.y) - 6;
                        const halfL = horizontalLength * 0.5;

                        return (
                            <>
                                {/* 1. 藍色水平底座：不再固定於 Y=0，而是跟隨電位但保持水平 */}
                                <Mesh position={[0, baseHeight, 0]}>
                                    <BoxGeometry args={[16, 2, horizontalLength + 12]} />
                                    <MeshStandardMaterial color="#2563eb" roughness={0.6} />
                                </Mesh>

                                {/* 2. Hinge 靜觸點 (對應 start / Port 1): 位於 -halfL (Local -Z) */}
                                <Group position={[0, start.y, -halfL]}>
                                    <Mesh>
                                        <BoxGeometry args={[5, 3, 5]} />
                                        <MeshStandardMaterial color="#ef4444" metalness={0.7} />
                                    </Mesh>
                                    {/* 垂直支撐柱 */}
                                    <Mesh position={[0, (baseHeight - start.y + 1) / 2, 0]}>
                                        <CylinderGeometry args={[1.5, 1.5, Math.abs(start.y - baseHeight), 8]} />
                                        <MeshStandardMaterial color="#2563eb" />
                                    </Mesh>
                                </Group>

                                {/* 3. Clip 動觸點 (對應 end / Port 2): 位於 +halfL (Local +Z) */}
                                <Group position={[0, end.y, halfL]}>
                                    <Mesh>
                                        <BoxGeometry args={[5, 3, 5]} />
                                        <MeshStandardMaterial color="#ef4444" metalness={0.7} />
                                    </Mesh>
                                    {/* 垂直支撐柱 */}
                                    <Mesh position={[0, (baseHeight - end.y + 1) / 2, 0]}>
                                        <CylinderGeometry args={[1.5, 1.5, Math.abs(end.y - baseHeight), 8]} />
                                        <MeshStandardMaterial color="#2563eb" />
                                    </Mesh>
                                    {/* 夾片細節 */}
                                    <Mesh position={[2.2, 2.5, 0]}>
                                        <BoxGeometry args={[0.6, 5, 3]} />
                                        <MeshStandardMaterial color="#fbbf24" metalness={1} />
                                    </Mesh>
                                    <Mesh position={[-2.2, 2.5, 0]}>
                                        <BoxGeometry args={[0.6, 5, 3]} />
                                        <MeshStandardMaterial color="#fbbf24" metalness={1} />
                                    </Mesh>
                                </Group>

                                {/* 4. 砸刀 (Blade): 以 Hinge (start.y, -halfL) 為旋轉中心 */}
                                <Group position={[0, start.y + 1.5, -halfL]} rotation={[isOn ? 0 : -Math.PI / 3, 0, 0]}>
                                    {/* 金屬刀身 */}
                                    <Mesh position={[0, 0, halfL]}>
                                        <BoxGeometry args={[2, 0.8, horizontalLength]} />
                                        <MeshStandardMaterial color="#fbbf24" metalness={1} />
                                    </Mesh>
                                    {/* 絕緣握把 */}
                                    <Group position={[0, 0, horizontalLength]}>
                                        <Mesh position={[0, 2.5, 1]}>
                                            <BoxGeometry args={[4, 5, 3]} />
                                            <MeshStandardMaterial color="#1e3a8a" />
                                        </Mesh>
                                        <Mesh position={[0, 5, 1]}>
                                            <CylinderGeometry args={[1, 1, 4, 8]} />
                                            <MeshStandardMaterial color="#1e3a8a" />
                                        </Mesh>
                                    </Group>
                                </Group>
                            </>
                        );
                    })()}
                </Group>
            ) : (
                <Group position={center} quaternion={rotation}>
                    {/* 其他元件模型 (電池、電阻、燈泡...) */}
                    {type === 'battery' && (
                        <Group>
                            {/* Main Body */}
                            <Mesh>
                                <CylinderGeometry args={[6, 6, length * 0.7, 16]} />
                                <MeshStandardMaterial color="#1e293b" metalness={1} roughness={0.1} />
                            </Mesh>
                            {/* Red Label - Increased radius to avoid z-fighting */}
                            <Mesh>
                                <CylinderGeometry args={[6.2, 6.2, length * 0.4, 16]} />
                                <MeshStandardMaterial color="#ef4444" />
                            </Mesh>
                            
                            {/* Positive Terminal (Bump) - Moved slightly to ensure no overlap flicker */}
                            <Group position={[0, -length * 0.35 - 0.1, 0]} rotation={[Math.PI, 0, 0]}>
                                <Mesh position={[0, 1.5, 0]}>
                                    <CylinderGeometry args={[2.5, 2.5, 3, 16]} />
                                    <MeshStandardMaterial color="#cbd5e1" metalness={1} />
                                </Mesh>
                                <Mesh position={[0, 2.5, 0]}>
                                    <SphereGeometry args={[1.5, 12, 12]} />
                                    <MeshStandardMaterial color="#cbd5e1" metalness={1} />
                                </Mesh>
                            </Group>

                            {/* Negative Terminal (Flat) - Moved slightly out */}
                            <Mesh position={[0, length * 0.35 + 0.1, 0]}>
                                <CylinderGeometry args={[5.8, 5.8, 1, 16]} />
                                <MeshStandardMaterial color="#1e293b" metalness={0.8} />
                            </Mesh>
                        </Group>
                    )}

                    {type === 'resistor' && (
                        <Group>
                            <Mesh>
                                <CylinderGeometry args={[4, 4, length * 0.6, 16]} />
                                <MeshStandardMaterial color="#d1d5db" />
                            </Mesh>
                            <Mesh position={[0, length * 0.15, 0]}>
                                <CylinderGeometry args={[4.1, 4.1, length * 0.05, 16]} />
                                <MeshStandardMaterial color="#92400e" />
                            </Mesh>
                            <Mesh position={[0, 0, 0]}>
                                <CylinderGeometry args={[4.1, 4.1, length * 0.05, 16]} />
                                <MeshStandardMaterial color="#1e40af" />
                            </Mesh>
                            <Mesh position={[0, -length * 0.15, 0]}>
                                <CylinderGeometry args={[4.1, 4.1, length * 0.05, 16]} />
                                <MeshStandardMaterial color="#ca8a04" />
                            </Mesh>
                        </Group>
                    )}

                    {type === 'bulb' && (
                        <Group quaternion={rotation.clone().invert()}>
                            <Mesh>
                                <CylinderGeometry args={[8, 8, 4, 16]} />
                                <MeshStandardMaterial color="#475569" metalness={0.8} />
                            </Mesh>
                            <Mesh position={[0, 3, 0]}>
                                <CylinderGeometry args={[6, 6, 2, 16]} />
                                <MeshStandardMaterial color="#94a3b8" metalness={1} />
                            </Mesh>
                            <Mesh position={[0, 18, 0]}>
                                <SphereGeometry args={[12, 24, 24]} />
                                <MeshStandardMaterial 
                                    color={Math.abs(current) > 0.01 ? "#fbbf24" : "#ffffff"} 
                                    transparent 
                                    opacity={0.6}
                                    emissive={Math.abs(current) > 0.01 ? "#fbbf24" : "#000"}
                                    emissiveIntensity={Math.min(2.5, Math.abs(current) * 4)}
                                />
                            </Mesh>
                        </Group>
                    )}

                    {(type === 'voltmeter' || type === 'ammeter') && (
                        <Group rotation={[Math.PI / 2, 0, 0]}>
                            {/* Main Casing */}
                            <Mesh>
                                <CylinderGeometry args={[18, 18, 5, 32]} />
                                <MeshStandardMaterial color="#1e293b" roughness={0.3} />
                            </Mesh>
                            {/* White Face - Raised to prevent z-fighting */}
                            <Mesh position={[0, 2.7, 0]}>
                                <CylinderGeometry args={[16, 16, 0.2, 32]} />
                                <MeshStandardMaterial color="#f8fafc" />
                            </Mesh>

                            {/* Scale Ticks (Graduations) - Every 30 degrees from -60 to +60 */}
                            {[60, 30, 0, -30, -60].map((deg) => {
                                const rad = deg * (Math.PI / 180);
                                return (
                                    <Mesh 
                                        key={deg} 
                                        position={[-14 * Math.sin(rad), 2.8, -14 * Math.cos(rad)]} 
                                        rotation={[0, rad, 0]}
                                    >
                                        <BoxGeometry args={[0.6, 0.1, 2.5]} />
                                        <MeshStandardMaterial color="#64748b" />
                                    </Mesh>
                                );
                            })}
                            
                            {/* Label Text - Moved to bottom (Z+) to be readable and upright */}
                            <Text 
                                position={[0, 2.8, 8]} 
                                rotation={[-Math.PI / 2, 0, 0]} 
                                fontSize={12} 
                                color="#0f172a" 
                                fontWeight="bold"
                                anchorY="middle"
                                renderOrder={10}
                            >
                                {type === 'voltmeter' ? 'V' : 'A'}
                            </Text>

                            {/* Needle Pivot - Raised and Rotated */}
                            <Group 
                                position={[0, 2.9, 0]} 
                                rotation={[0, (() => {
                                    // Calculate needle angle based on range
                                    // Range is total sweep of 120 degrees (-60 to +60)
                                    // 0 value -> +60 deg (Left)
                                    // Max value -> -60 deg (Right)
                                    
                                    const range = type === 'voltmeter' 
                                        ? (voltmeterRange || DEFAULT_VOLTMETER_RANGE) 
                                        : (ammeterRange || DEFAULT_AMMETER_RANGE);
                                    
                                    const val = type === 'voltmeter' 
                                        ? Math.abs(voltage1 - voltage2) 
                                        : Math.abs(current);
                                    
                                    // Clamp value to max range
                                    const clampedVal = Math.min(val, range);
                                    
                                    // ratio 0 -> 1
                                    const ratio = clampedVal / range;
                                    
                                    // Clockwise rotation: Angle decreases as value increases.
                                    const startAngle = Math.PI / 3;
                                    const endAngle = -Math.PI / 3;
                                    
                                    return startAngle + ratio * (endAngle - startAngle);
                                })(), 0]}
                            >
                                {/* Center Pivot Cap */}
                                <Mesh position={[0, 0.2, 0]}>
                                    <CylinderGeometry args={[2, 2, 0.4, 16]} />
                                    <MeshStandardMaterial color="#475569" />
                                </Mesh>
                                {/* The Needle - Thicker and more visible */}
                                <Mesh position={[0, 0, -7]}>
                                    <BoxGeometry args={[0.8, 0.3, 14]} />
                                    <MeshStandardMaterial color="#dc2626" />
                                </Mesh>
                            </Group>
                        </Group>
                    )}
                </Group>
            )}

            {(type !== 'wire' && type !== 'connector') && (
                <Billboard position={[center.x, center.y + 45, center.z]}>
                    <Text 
                        fontSize={10} 
                        color="#1e293b" 
                        outlineWidth={1} 
                        outlineColor="white"
                        textAlign="center"
                        anchorY="middle"
                        material-depthTest={false}
                        renderOrder={100}
                    >
                        {`${label}${val ? '\n' + val : ''}`}
                    </Text>
                </Billboard>
            )}

            {showCurrent && <CurrentParticles start={start} end={end} current={current} isElectronFlow={isElectronFlow} globalSpeed={globalSpeed} />}
        </Group>
    );
};

const PotentialLabel = ({ position, voltage }: { position: THREE.Vector3, voltage: number }) => (
    <Billboard position={[position.x, position.y + 12, position.z]}>
        <Text 
            fontSize={7} 
            color="#0f172a" 
            outlineWidth={0.8} 
            outlineColor="white"
            material-depthTest={false}
            renderOrder={100}
        >
            {voltage.toFixed(2)}V
        </Text>
    </Billboard>
);

interface SceneProps extends Circuit3DProps {
    showElectronFlow: boolean;
    settings?: GlobalSettings;
}

const Scene = ({ components, connections, nodeVoltages, componentCurrents, connectionCurrents, getPorts, isSimulating, viewSettings, showElectronFlow, settings }: SceneProps) => {
    const { centerX, centerZ, maxVoltage } = useMemo(() => {
        if (components.length === 0) return { centerX: 0, centerZ: 0, maxVoltage: 9 };
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        components.forEach(c => {
            minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
            minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
        });
        const vVals = Object.values(nodeVoltages);
        const maxV = vVals.length > 0 ? Math.max(...vVals) : INITIAL_BATTERY_VOLTAGE;
        return { 
            centerX: (minX + maxX) / 2 * POSITION_SCALE, 
            centerZ: (minY + maxY) / 2 * POSITION_SCALE,
            maxVoltage: maxV > 0 ? maxV : 9
        };
    }, [components, nodeVoltages]);

    const getPortPos3D = (portId: string, comp: Component, offsetX: number, offsetY: number) => {
        const v = isSimulating ? (nodeVoltages[portId] || 0) : 0;
        return new THREE.Vector3((comp.x + offsetX) * POSITION_SCALE, v * VOLTAGE_SCALE, (comp.y + offsetY) * POSITION_SCALE);
    };

    const portPos3DMap = useMemo(() => {
        const map = new Map<string, THREE.Vector3>();
        components.forEach(comp => {
            const ports = getPorts(comp);
            ports.forEach(p => {
                map.set(p.id, getPortPos3D(p.id, comp, p.offsetX, p.offsetY));
            });
        });
        return map;
    }, [components, nodeVoltages, isSimulating, getPorts]);

    const getTypeName = (type: string) => {
        switch (type) {
            case 'battery': return '電池';
            case 'resistor': return '電阻';
            case 'bulb': return '燈泡';
            case 'switch': return '開關';
            case 'voltmeter': return '伏特計';
            case 'ammeter': return '安培計';
            case 'connector': return '連接器';
            default: return type;
        }
    };
    
    const globalSpeed = settings?.animationSpeed || 1;

    return (
        <>
            <PerspectiveCamera makeDefault position={[centerX, 450, centerZ + 500]} fov={45} />
            <OrbitControls target={[centerX, 20, centerZ]} />
            <AmbientLight intensity={2.2} />
            <DirectionalLight position={[200, 500, 150]} intensity={3.5} castShadow />
            
            <Grid 
                position={[0, 0, 0]} 
                args={[4000, 4000]} 
                cellSize={20 * POSITION_SCALE} 
                sectionSize={100 * POSITION_SCALE} 
                fadeDistance={2000} 
                sectionColor="#94a3b8" 
                cellColor="#cbd5e1" 
            />

            {components.map(comp => {
                // Do not render ground components in 3D
                if (comp.type === 'ground') return null;

                const ports = getPorts(comp);
                if (ports.length < 2) return null;
                
                let current = isSimulating ? (componentCurrents[comp.id] || 0) : 0;
                const isShort = Math.abs(current) > SHORT_CIRCUIT_CURRENT;
                
                const parts: string[] = [];
                
                if (comp.type === 'voltmeter') {
                    const v1 = nodeVoltages[ports[0].id] || 0;
                    const v2 = nodeVoltages[ports[1].id] || 0;
                    parts.push(`${Math.abs(v1 - v2).toFixed(2)}V`);
                } else if (comp.type === 'ammeter') {
                    parts.push(`${Math.abs(current).toFixed(2)}A`);
                } else {
                    if (viewSettings.showCurrents && comp.type !== 'connector') {
                        parts.push(`${Math.abs(current).toFixed(2)}A`);
                    }
                    if (viewSettings.showValues) {
                        if (comp.type === 'resistor' || comp.type === 'bulb') {
                            parts.push(`${comp.properties.resistance}Ω`);
                            if (comp.type === 'bulb' && Math.abs(current) > 0.01) {
                                const pVal = current * current * (comp.properties.resistance || 0);
                                parts.push(`${pVal.toFixed(2)}W`);
                            }
                        } else if (comp.type === 'battery') {
                            parts.push(`${comp.properties.voltage}V`);
                        }
                    }
                }

                const valStr = parts.join(' | ');

                return (
                    <Group key={comp.id}>
                        {ports.slice(0, -1).map((p, idx) => {
                            const p1 = ports[idx];
                            const p2 = ports[idx+1];
                            const pos1 = portPos3DMap.get(p1.id) || getPortPos3D(p1.id, comp, p1.offsetX, p1.offsetY);
                            const pos2 = portPos3DMap.get(p2.id) || getPortPos3D(p2.id, comp, p2.offsetX, p2.offsetY);
                            
                            // Special handling for connector current visualization
                            let segmentCurrent = current;
                            if (comp.type === 'connector' && isSimulating) {
                                const v1 = nodeVoltages[p1.id] || 0;
                                const v2 = nodeVoltages[p2.id] || 0;
                                segmentCurrent = (v1 - v2) * 100;
                            }

                            return (
                                <Group key={`${comp.id}_seg_${idx}`}>
                                    <OptimizedComponent 
                                        type={comp.type} 
                                        start={pos1} end={pos2} 
                                        current={segmentCurrent} 
                                        voltage1={isSimulating ? (nodeVoltages[p1.id] || 0) : 0} 
                                        voltage2={isSimulating ? (nodeVoltages[p2.id] || 0) : 0}
                                        isShort={isShort} 
                                        maxVoltage={maxVoltage as number} 
                                        isOn={comp.properties.isOn}
                                        label={idx === 0 ? getTypeName(comp.type) : ""}
                                        showCurrent={viewSettings.showCurrents}
                                        isElectronFlow={showElectronFlow}
                                        val={idx === 0 ? valStr : ""}
                                        globalSpeed={globalSpeed}
                                        ammeterRange={comp.properties.ammeterRange}
                                        voltmeterRange={comp.properties.voltmeterRange}
                                    />
                                    {viewSettings.showPotentials && (
                                        <>
                                            {idx === 0 && <PotentialLabel position={pos1} voltage={isSimulating ? (nodeVoltages[p1.id] || 0) : 0} />}
                                            <PotentialLabel position={pos2} voltage={isSimulating ? (nodeVoltages[p2.id] || 0) : 0} />
                                        </>
                                    )}
                                </Group>
                            );
                        })}
                    </Group>
                );
            })}

            {connections.map(conn => {
                const start = portPos3DMap.get(conn.sourceId);
                const end = portPos3DMap.get(conn.targetId);
                if (!start || !end) return null;

                const current = isSimulating ? (connectionCurrents[conn.id] || 0) : 0;
                return (
                    <OptimizedComponent 
                        key={conn.id}
                        type="wire"
                        start={start} end={end}
                        current={current}
                        voltage1={isSimulating ? (nodeVoltages[conn.sourceId] || 0) : 0}
                        voltage2={isSimulating ? (nodeVoltages[conn.targetId] || 0) : 0}
                        isShort={Math.abs(current) > SHORT_CIRCUIT_CURRENT}
                        maxVoltage={maxVoltage as number}
                        label=""
                        showCurrent={viewSettings.showCurrents}
                        isElectronFlow={showElectronFlow}
                        globalSpeed={globalSpeed}
                    />
                );
            })}
        </>
    );
};

export const Circuit3D: React.FC<Circuit3DProps> = (props) => {
  const [showElectronFlow, setShowElectronFlow] = useState(false);

  return (
    <div className="flex-1 bg-gradient-to-b from-slate-100 to-slate-300 relative">
        <Canvas shadows>
            <Scene {...props} showElectronFlow={showElectronFlow} />
        </Canvas>

        {/* Electron Flow Toggle UI */}
        <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded-xl backdrop-blur-md shadow-lg border border-slate-200 z-10">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
                <div className="relative">
                    <input 
                        type="checkbox" 
                        checked={showElectronFlow}
                        onChange={(e) => setShowElectronFlow(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">顯示電子流</span>
                    <span className="text-[10px] text-slate-500">
                        {showElectronFlow ? '藍色粒子 (負 → 正)' : '黃色電流 (正 → 負)'}
                    </span>
                </div>
            </label>
        </div>
    </div>
  );
};
