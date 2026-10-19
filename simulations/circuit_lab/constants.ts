
import { GlobalSettings } from './types';

export const GRID_SIZE = 20;
export const COMPONENT_SIZE = 80;

export const COLORS = {
  wire: '#374151', // gray-700
  wireActive: '#fbbf24', // amber-400
  wireShort: '#ef4444', // red-500
  battery: '#ef4444', // red-500
  resistor: '#3b82f6', // blue-500
  bulb: '#f59e0b', // amber-500
  connector: '#1f2937', // gray-800
  ground: '#4b5563', // gray-600
  selected: '#8b5cf6', // violet-500
  port: '#ef4444', // red-500
  portHover: '#22c55e', // green-500
};

export const COLOR_VOLTAGE_LOW = [23, 37, 84]; // blue-950 (Dark Blue)
export const COLOR_VOLTAGE_HIGH = [245, 158, 11]; // amber-500 (Orange/Yellow)

export const INITIAL_BATTERY_VOLTAGE = 9;
export const INITIAL_RESISTANCE = 10;
export const INITIAL_BULB_RESISTANCE = 5;
export const INITIAL_CONNECTOR_PORTS = 3;
export const INITIAL_GROUND_BIAS = 0;
export const DEFAULT_AMMETER_RANGE = 10; // 10A
export const DEFAULT_VOLTMETER_RANGE = 30; // 30V
export const SHORT_CIRCUIT_CURRENT = 100; // Amps

export const DEFAULT_SETTINGS: GlobalSettings = {
  animationSpeed: 1,
  wireResistance: 0.003,
  batteryResistance: 0.003,
  ammeterLimit: 10,
  showCurrent2D: false,
  showPotentials2D: false,
  showPower2D: false,
};
