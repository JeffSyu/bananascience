import { compile } from 'mathjs';
import { ConstantParams, CustomParams, SimulationData } from '../types';

/**
 * Returns an adaptive time step so that the simulation data points
 * remain between 200 and 500 points for optimal chart rendering and calculation speed.
 */
export function getAdaptiveStep(maxTime: number): number {
  if (maxTime <= 10) return 0.05;  // 201 points
  if (maxTime <= 25) return 0.05;  // <= 501 points
  if (maxTime <= 50) return 0.1;   // <= 501 points
  if (maxTime <= 100) return 0.2;  // <= 501 points
  if (maxTime <= 250) return 0.5;  // <= 501 points
  return 1.0;                      // <= 501 points
}

export function generateConstantMotionData(params: ConstantParams, maxTime: number): SimulationData[] {
  const step = getAdaptiveStep(maxTime);
  const count = Math.ceil(maxTime / step) + 1;
  const data: SimulationData[] = new Array(count);
  
  let idx = 0;
  for (let t = 0; t <= maxTime + step * 0.5; t += step) {
    const roundT = Math.round(t * 1000) / 1000;
    data[idx++] = {
      t: roundT,
      x: params.x0 + params.v0 * roundT + 0.5 * params.a * roundT * roundT,
      v: params.v0 + params.a * roundT,
      a: params.a,
    };
  }
  if (idx < count) {
    data.length = idx;
  }
  return data;
}

/**
 * Creates an efficient O(1) stateful interpolator for monotonically increasing t.
 * Avoids sorting or allocating arrays on each step.
 */
function createPointInterpolator(points: { t: number; val: number }[]): (t: number) => number {
  if (points.length === 0) return () => 0;
  if (points.length === 1) return () => points[0].val;

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const n = sorted.length;
  let currIdx = 0;

  return (t: number): number => {
    if (t <= sorted[0].t) return sorted[0].val;
    if (t >= sorted[n - 1].t) return sorted[n - 1].val;

    // Advance index monotonically
    while (currIdx < n - 2 && sorted[currIdx + 1].t < t) {
      currIdx++;
    }
    // Rewind if query went backwards
    while (currIdx > 0 && sorted[currIdx].t > t) {
      currIdx--;
    }

    const p1 = sorted[currIdx];
    const p2 = sorted[currIdx + 1];
    const dt = p2.t - p1.t;
    if (dt === 0) return p1.val;
    return p1.val + ((t - p1.t) / dt) * (p2.val - p1.val);
  };
}

export function generateCustomMotionData(params: CustomParams, maxTime: number): SimulationData[] {
  const step = getAdaptiveStep(maxTime);
  // Use high-precision sub-stepping for integration accuracy
  const subSteps = Math.max(1, Math.round(step / 0.02));
  const subDt = step / subSteps;
  const count = Math.ceil(maxTime / step) + 1;
  const data: SimulationData[] = new Array(count);

  let getVal: (t: number) => number;

  if (params.inputMethod === 'equation') {
    try {
      // Compile expression AST once outside the loop for 100x+ performance boost
      const compiled = compile(params.equation);
      // Validate with t = 0 test call
      const testVal = compiled.evaluate({ t: 0 });
      if (typeof testVal === 'number' && Number.isFinite(testVal)) {
        getVal = (t: number) => {
          try {
            const v = compiled.evaluate({ t });
            return typeof v === 'number' && Number.isFinite(v) ? v : 0;
          } catch {
            return 0;
          }
        };
      } else {
        getVal = () => 0;
      }
    } catch {
      getVal = () => 0;
    }
  } else {
    getVal = createPointInterpolator(params.points);
  }

  let currentX = params.x0;
  let currentV = params.v0;
  let tSim = 0;
  let idx = 0;

  // Record initial state at t = 0
  const initVal = getVal(0);
  if (params.targetVariable === 'a') {
    data[idx++] = { t: 0, a: initVal, v: currentV, x: currentX };
  } else if (params.targetVariable === 'v') {
    data[idx++] = { t: 0, a: 0, v: initVal, x: currentX };
  } else {
    data[idx++] = { t: 0, a: 0, v: 0, x: initVal };
  }

  // Step through time
  const totalRecordedSteps = Math.ceil(maxTime / step);
  for (let stepIdx = 1; stepIdx <= totalRecordedSteps; stepIdx++) {
    const targetT = Math.min(maxTime, Math.round(stepIdx * step * 1000) / 1000);

    if (params.targetVariable === 'a') {
      // Sub-step Euler integration
      for (let s = 0; s < subSteps; s++) {
        tSim += subDt;
        const a = getVal(tSim);
        currentV += a * subDt;
        currentX += currentV * subDt;
      }
      data[idx++] = { t: targetT, a: getVal(targetT), v: currentV, x: currentX };
    } else if (params.targetVariable === 'v') {
      for (let s = 0; s < subSteps; s++) {
        tSim += subDt;
        const v = getVal(tSim);
        currentX += v * subDt;
      }
      data[idx++] = { t: targetT, a: 0, v: getVal(targetT), x: currentX };
    } else {
      tSim = targetT;
      data[idx++] = { t: targetT, a: 0, v: 0, x: getVal(targetT) };
    }
  }

  if (idx < count) {
    data.length = idx;
  }

  // Calculate velocity from x if target was x
  if (params.targetVariable === 'x') {
    for (let i = 0; i < data.length; i++) {
      const dt = (i < data.length - 1) ? (data[i + 1].t - data[i].t) : (data[i].t - data[i - 1].t);
      if (dt > 0) {
        if (i < data.length - 1) {
          data[i].v = (data[i + 1].x - data[i].x) / dt;
        } else if (i > 0) {
          data[i].v = (data[i].x - data[i - 1].x) / dt;
        }
      }
    }
  }

  // Calculate acceleration from v if target was x or v
  if (params.targetVariable === 'x' || params.targetVariable === 'v') {
    for (let i = 0; i < data.length; i++) {
      const dt = (i < data.length - 1) ? (data[i + 1].t - data[i].t) : (data[i].t - data[i - 1].t);
      if (dt > 0) {
        if (i < data.length - 1) {
          data[i].a = (data[i + 1].v - data[i].v) / dt;
        } else if (i > 0) {
          data[i].a = (data[i].v - data[i - 1].v) / dt;
        }
      }
    }
  }

  return data;
}

/**
 * Fast binary search to find the active data point at a given time in O(log N).
 */
export function findCurrentDataPoint(data: SimulationData[], time: number): SimulationData {
  const len = data.length;
  if (len === 0) return { x: 0, v: 0, a: 0, t: 0 };
  if (time <= data[0].t) return data[0];
  if (time >= data[len - 1].t) return data[len - 1];

  let low = 0;
  let high = len - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (data[mid].t < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return data[low] || data[len - 1];
}

/**
 * Fast binary search to find the nearest data point index in O(log N).
 */
export function findNearestIndex(data: SimulationData[], targetT: number): number {
  const len = data.length;
  if (len === 0) return -1;
  if (targetT <= data[0].t) return 0;
  if (targetT >= data[len - 1].t) return len - 1;

  let low = 0;
  let high = len - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (data[mid].t < targetT) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (low >= len) return len - 1;
  if (low === 0) return 0;

  return Math.abs(data[low].t - targetT) < Math.abs(data[low - 1].t - targetT) ? low : low - 1;
}

/**
 * Fast binary search to find the nearest data point in O(log N).
 */
export function findNearestDataPoint(data: SimulationData[], targetT: number): SimulationData | null {
  const idx = findNearestIndex(data, targetT);
  return idx !== -1 ? data[idx] : null;
}

