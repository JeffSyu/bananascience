
import { Component, Connection, Port, GlobalSettings } from '../types';

// Gaussian elimination solver for Ax = b
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) return [];

  // Working copies
  const M = A.map(row => [...row]);
  const x = [...b];

  for (let i = 0; i < n; i++) {
    // Pivot
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap rows
    [M[maxRow], M[i]] = [M[i], M[maxRow]];
    [x[maxRow], x[i]] = [x[i], x[maxRow]];

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -M[k][i] / M[i][i];
      if (!isFinite(c)) continue; // Singularity check
      for (let j = i; j < n; j++) {
        if (i === j) M[k][j] = 0;
        else M[k][j] += c * M[i][j];
      }
      x[k] += c * x[i];
    }
  }

  // Back substitution
  const result = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * result[j];
    }
    result[i] = (x[i] - sum) / M[i][i];
    if (!isFinite(result[i])) result[i] = 0;
  }

  return result;
}

function getComponentResistance(comp: Component): number {
  if (comp.type === 'switch') return comp.properties.isOn ? 0.001 : 1e9;
  if (comp.type === 'voltmeter') return 10e6; // 10 MegaOhm (Ideal Voltmeter)
  if (comp.type === 'ammeter') return 0.001; // 1 milliOhm (Ideal Ammeter)
  // Connector is handled as series of wires, no single resistance value
  return comp.properties.resistance || 1e-6;
}

export function solveCircuit(
  components: Component[],
  connections: Connection[],
  getPorts: (c: Component) => Port[],
  settings: GlobalSettings
): {
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  connectionCurrents: Record<string, number>;
} {
  // New Solver Strategy:
  // Instead of merging nodes with UnionFind, we treat every Port as a potential node.
  // Wires (Connections) are treated as components with very low resistance.
  // This allows us to calculate current flow through wires for visualization.

  const uniqueNodes = new Set<string>();
  
  // Collect all active ports from components
  components.forEach(c => {
    const ports = getPorts(c);
    ports.forEach(p => uniqueNodes.add(p.id));
  });

  const nodesArray = Array.from(uniqueNodes);
  const nodeMap = new Map<string, number>();
  nodesArray.forEach((id, index) => nodeMap.set(id, index));

  if (nodesArray.length < 2 && components.filter(c => c.type === 'ground').length === 0) {
    return { nodeVoltages: {}, componentCurrents: {}, connectionCurrents: {} };
  }

  // Count voltage sources (Batteries)
  const voltageSources = components.filter(c => c.type === 'battery');
  const numNodes = nodesArray.length;
  const numVSources = voltageSources.length;
  
  const size = numNodes + numVSources;
  const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
  const rhs = Array(size).fill(0);

  // Helper to add conductance to matrix
  const addConductance = (n1: number, n2: number, G: number) => {
    matrix[n1][n1] += G;
    matrix[n1][n2] -= G;
    matrix[n2][n1] -= G;
    matrix[n2][n2] += G;
  };

  // 1. Fill conductance for Resistors, Bulbs, Switches, Voltmeters, Ammeters
  components.forEach(comp => {
    if (['resistor', 'bulb', 'switch', 'voltmeter', 'ammeter'].includes(comp.type)) {
      const ports = getPorts(comp);
      if (ports.length !== 2) return;
      
      const n1 = nodeMap.get(ports[0].id);
      const n2 = nodeMap.get(ports[1].id);
      
      if (n1 === undefined || n2 === undefined) return;

      const R = getComponentResistance(comp);
      const G = 1 / R;
      addConductance(n1, n2, G);
    } 
    // Handle Connector: Treat as a chain of short circuits between ports
    else if (comp.type === 'connector') {
      const ports = getPorts(comp);
      // Connect P0-P1, P1-P2, P2-P3... with very low resistance (effectively a bus bar)
      for (let i = 0; i < ports.length - 1; i++) {
        const n1 = nodeMap.get(ports[i].id);
        const n2 = nodeMap.get(ports[i+1].id);
        if (n1 !== undefined && n2 !== undefined) {
           addConductance(n1, n2, 100); // 100 S = 0.01 Ohm (internal connector bus)
        }
      }
    }
  });

  // 2. Fill conductance for Wires (Connections)
  // Treat wire as a resistor based on settings
  // Ensure we don't divide by zero if user sets 0 resistance
  const wireR = Math.max(1e-9, settings.wireResistance); 
  const WIRE_G = 1 / wireR;

  connections.forEach(conn => {
    const n1 = nodeMap.get(conn.sourceId);
    const n2 = nodeMap.get(conn.targetId);

    if (n1 !== undefined && n2 !== undefined) {
      addConductance(n1, n2, WIRE_G);
    }
  });

  // 3. Fill Voltage Source part
  voltageSources.forEach((comp, i) => {
    const ports = getPorts(comp);
    if (ports.length !== 2) return;
    
    // Assume port 0 is Positive (+), port 1 is Negative (-)
    const nPositive = nodeMap.get(ports[0].id); 
    const nNegative = nodeMap.get(ports[1].id);
    
    if (nPositive === undefined || nNegative === undefined) return;

    const sourceIdx = numNodes + i;
    const voltage = comp.properties.voltage || 0;
    const internalR = Math.max(0, settings.batteryResistance);

    // Equation: Vpos - Vneg + I_source * R_internal = V_source
    // I_source is the variable at sourceIdx.
    
    matrix[sourceIdx][nPositive] = 1;
    matrix[sourceIdx][nNegative] = -1;
    matrix[sourceIdx][sourceIdx] = internalR; // Add internal resistance term
    rhs[sourceIdx] = voltage;

    // Current conservation at nodes:
    matrix[nPositive][sourceIdx] = 1; 
    matrix[nNegative][sourceIdx] = -1;
  });

  // 4. Ground Constraint and Stability
  // Add small leakage conductance to ground for all nodes to prevent singularity with floating parts
  for(let i=0; i<numNodes; i++) {
    matrix[i][i] += 1e-9;
  }

  // Identify Ground Components
  const groundComponents = components.filter(c => c.type === 'ground');
  let hasGround = false;

  groundComponents.forEach(gComp => {
      const ports = getPorts(gComp);
      if (ports.length > 0) {
          const nodeIdx = nodeMap.get(ports[0].id);
          if (nodeIdx !== undefined) {
              // Apply voltage constraint for this node: V_node = Bias
              // Replace KCL row with Voltage Constraint Row
              matrix[nodeIdx] = Array(size).fill(0);
              matrix[nodeIdx][nodeIdx] = 1;
              rhs[nodeIdx] = gComp.properties.bias || 0;
              hasGround = true;
          }
      }
  });

  // Fallback: If no explicit ground, pick the Negative terminal of the first battery.
  if (!hasGround && voltageSources.length > 0) {
      const ports = getPorts(voltageSources[0]);
      if (ports.length > 1) {
          const idx = nodeMap.get(ports[1].id); // Battery negative
          if (idx !== undefined) {
              // Hard set Ground Node Voltage to 0 via row replacement
              matrix[idx] = Array(size).fill(0);
              matrix[idx][idx] = 1;
              rhs[idx] = 0;
          }
      }
  }

  // Solve
  const solution = solveLinearSystem(matrix, rhs);

  // Parse results
  const nodeVoltages: Record<string, number> = {};
  nodesArray.forEach((id, idx) => {
    nodeVoltages[id] = solution[idx];
  });

  const componentCurrents: Record<string, number> = {};
  const connectionCurrents: Record<string, number> = {};

  // Calculate Component Currents
  components.forEach(comp => {
    if (['resistor', 'bulb', 'switch', 'voltmeter', 'ammeter'].includes(comp.type)) {
       const ports = getPorts(comp);
       if(ports.length === 2) {
         const v1 = nodeVoltages[ports[0].id] || 0;
         const v2 = nodeVoltages[ports[1].id] || 0;
         const R = getComponentResistance(comp);
         
         // I = (V1 - V2) / R. Direction: P1 -> P2
         componentCurrents[comp.id] = (v1 - v2) / R;
       }
    } else if (comp.type === 'connector' || comp.type === 'ground') {
      componentCurrents[comp.id] = 0;
    }
  });

  // Battery Currents
  voltageSources.forEach((comp, i) => {
    // The solver variable I_src is current flowing out of Positive (P1).
    componentCurrents[comp.id] = solution[numNodes + i];
  });

  // Wire Currents
  connections.forEach(conn => {
     const v1 = nodeVoltages[conn.sourceId] || 0;
     const v2 = nodeVoltages[conn.targetId] || 0;
     // I = (V_source - V_target) / R_wire
     connectionCurrents[conn.id] = (v1 - v2) / wireR;
  });

  return { nodeVoltages, componentCurrents, connectionCurrents };
}
