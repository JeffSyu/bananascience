
export type ComponentType = 'battery' | 'resistor' | 'bulb' | 'wire' | 'switch' | 'voltmeter' | 'ammeter' | 'connector' | 'ground';
export type ViewMode = '2d' | '3d';

export interface Point {
  x: number;
  y: number;
}

export interface Component {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  properties: {
    voltage?: number;    // For battery
    resistance?: number; // For resistor and bulb
    isOn?: boolean;      // For switch
    portsCount?: number; // For connector
    label?: string;
    ammeterRange?: number;   // For ammeter: 0.1, 1, 10
    voltmeterRange?: number; // For voltmeter: 3, 10, 30
    bias?: number;       // For ground (voltage offset), default 0
  };
  // Simulation results
  current?: number;
  voltageDrop?: number;
}

// A connection point on a component
export interface Port {
  id: string;
  componentId: string;
  offsetX: number;
  offsetY: number;
}

// A wire connects two ports
export interface Connection {
  id: string;
  sourceId: string; // Port ID
  targetId: string; // Port ID
}

export interface GlobalSettings {
  animationSpeed: number;
  wireResistance: number;
  batteryResistance: number;
  ammeterLimit: number;
  // 2D Visualization Settings
  showCurrent2D: boolean;
  showPotentials2D: boolean;
  showPower2D: boolean;
}

// For the solver
export interface SimulationResult {
  nodeVoltages: Record<string, number>; // Node ID -> Voltage
  componentCurrents: Record<string, number>; // Component ID -> Current
  connectionCurrents: Record<string, number>; // Connection ID -> Current
}
