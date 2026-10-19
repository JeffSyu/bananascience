import { WaveType, WaveMode, WaveParams } from '../types/wave';

export interface DerivedWaveMetrics {
  wavelength: number; // λ = v / f (m)
  period: number;     // T = 1 / f (s)
  angularFreq: number;// ω = 2π f (rad/s)
  waveNumber: number; // k = 2π / λ (rad/m)
}

export function calculateMetrics(params: WaveParams): DerivedWaveMetrics {
  const f = Math.max(0.01, params.frequency);
  const v = Math.max(0.1, params.waveSpeed);
  const wavelength = v / f;
  const period = 1 / f;
  const angularFreq = 2 * Math.PI * f;
  const waveNumber = (2 * Math.PI) / wavelength;

  return {
    wavelength,
    period,
    angularFreq,
    waveNumber,
  };
}

export interface ParticleDisplacement {
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Calculates physical displacement of a particle at equilibrium (x0, y0, z0)
 * at simulation time t.
 */
export function getParticleDisplacement(
  x0: number,
  y0: number,
  z0: number,
  t: number,
  mode: WaveMode,
  type: WaveType,
  params: WaveParams,
  depth: number = 0
): ParticleDisplacement {
  const { frequency, amplitude, waveSpeed } = params;
  const wavelength = waveSpeed / Math.max(0.01, frequency);
  const k = (2 * Math.PI) / wavelength;
  const omega = 2 * Math.PI * frequency;

  // Decay factor for circular wave (Airy deep water surface wave theory)
  // Orbital radius decays exponentially with depth: r(d) = A * exp(-k * d)
  // At d = wavelength / 2: k * d = pi, exp(-pi) ≈ 0.0432 (approx 4% at half wavelength)
  const decayFactor = type === 'circular' ? Math.exp(-k * Math.max(0, depth)) : 1;
  const A = amplitude * decayFactor;

  if (mode === 'traveling') {
    // Traveling wave moving in +x direction: phase = k*x0 - omega*t
    const phase = k * x0 - omega * t;

    if (type === 'transverse') {
      // Particles oscillate perpendicular to propagation in y direction
      return {
        dx: 0,
        dy: A * Math.sin(phase),
        dz: 0,
      };
    } else if (type === 'longitudinal') {
      // Particles oscillate along propagation direction in x direction
      return {
        dx: A * Math.cos(phase),
        dy: 0,
        dz: 0,
      };
    } else {
      // Circular wave (Deep water surface wave / Gerstner wave)
      // Clockwise rotation: particles move forward in +x direction at wave crests
      return {
        dx: A * Math.cos(phase),
        dy: A * Math.sin(phase),
        dz: 0,
      };
    }
  } else {
    // Standing wave (駐波)
    if (type === 'transverse') {
      // Superposition of incident and reflected waves: amplitude * sin(k*x0) * cos(omega*t)
      const dy = amplitude * Math.sin(k * x0) * Math.cos(omega * t);

      return {
        dx: 0,
        dy,
        dz: 0,
      };
    } else if (type === 'longitudinal') {
      // Sound wave in closed/open acoustic column
      // Displacement standing wave has nodes where cos(k*x0) = 0
      const dx = amplitude * Math.cos(k * x0) * Math.cos(omega * t);
      return {
        dx,
        dy: 0,
        dz: 0,
      };
    } else {
      // Circular standing wave (Standing surface wave / seiche with depth decay)
      const dx = A * Math.sin(k * x0) * Math.cos(omega * t);
      const dy = -A * Math.cos(k * x0) * Math.cos(omega * t);
      return {
        dx,
        dy,
        dz: 0,
      };
    }
  }
}
