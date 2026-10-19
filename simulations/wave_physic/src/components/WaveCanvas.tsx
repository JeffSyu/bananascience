import React, { useRef, useEffect, useCallback } from 'react';
import { WaveType, WaveMode, WaveParams, ViewOptions, Camera3D, TimeAction } from '../types/wave';
import { calculateMetrics } from '../utils/physics';

interface WaveCanvasProps {
  mode: WaveMode;
  type: WaveType;
  params: WaveParams;
  viewOptions: ViewOptions;
  highlightIndex: number;
  camera: Camera3D;
  onCameraChange: (camera: Camera3D) => void;
  isPlaying: boolean;
  timeAction?: TimeAction | null;
}

interface RenderBead {
  px: number;
  py: number;
  depth: number;
  radius: number;
  isHighlighted: boolean;
  isCenterHighlight: boolean;
  colIndex: number;
  x0: number;
  y0: number;
  z0: number;
}

/**
 * Pre-renders a 128x128 radial sphere sprite onto an offscreen canvas.
 * Using hardware-accelerated drawImage replaces 500+ dynamic gradient allocations
 * and path fills per frame with direct GPU texture blitting.
 */
function createSphereSprite(isHighlight: boolean): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = size / 2;
  const r = center - 0.5;
  const lightX = center - r * 0.35;
  const lightY = center - r * 0.35;

  const grad = ctx.createRadialGradient(lightX, lightY, r * 0.1, center, center, r);

  if (isHighlight) {
    grad.addColorStop(0, '#FEF08A'); // bright yellow highlight
    grad.addColorStop(0.3, '#F59E0B'); // amber
    grad.addColorStop(0.85, '#D97706'); // warm deep orange
    grad.addColorStop(1, '#92400E'); // shade edge
  } else {
    grad.addColorStop(0, '#FFFFFF'); // specular white
    grad.addColorStop(0.4, '#E2E8F0'); // smooth pearl
    grad.addColorStop(0.8, '#94A3B8'); // mid shadow
    grad.addColorStop(1, '#475569'); // dark rim
  }

  ctx.beginPath();
  ctx.arc(center, center, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  return canvas;
}

export const WaveCanvas: React.FC<WaveCanvasProps> = ({
  mode,
  type,
  params,
  viewOptions,
  highlightIndex,
  camera,
  onCameraChange,
  isPlaying,
  timeAction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // High-performance simulation clock managed in ref
  const simTimeRef = useRef<number>(0);

  // Cached container dimensions & pixel ratio to avoid layout reflows (getBoundingClientRect)
  const canvasDimensionsRef = useRef({ width: 800, height: 600, dpr: 1 });

  // Pre-rendered bead sprites
  const whiteSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const amberSpriteRef = useRef<HTMLCanvasElement | null>(null);
  if (!whiteSpriteRef.current) {
    whiteSpriteRef.current = createSphereSprite(false);
  }
  if (!amberSpriteRef.current) {
    amberSpriteRef.current = createSphereSprite(true);
  }

  // Pre-allocated object pool for beads to eliminate GC churn (504 max beads)
  const MAX_BEADS = 504;
  const beadsPoolRef = useRef<RenderBead[]>(
    Array.from({ length: MAX_BEADS }, () => ({
      px: 0,
      py: 0,
      depth: 0,
      radius: 0,
      isHighlighted: false,
      isCenterHighlight: false,
      colIndex: 0,
      x0: 0,
      y0: 0,
      z0: 0,
    }))
  );

  // Store recent trajectory of the highlighted central particle(s)
  const trajectoryHistoryRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const trajectoryHistory2Ref = useRef<{ x: number; y: number; z: number }[]>([]);

  // Physical grid settings
  const COLS = 72; // number of beads along propagation axis (X)
  const ROWS = 7; // number of beads along vertical axis (Y)
  const DEPTH_LAYERS = 1; // 縱波只顯示最前端的粒子
  const SYSTEM_LENGTH = 36; // meters in virtual physics space
  const SPACING_X = SYSTEM_LENGTH / COLS;
  const SPACING_Y = 0.55; // vertical distance between rows in equilibrium
  const SPACING_Z = 0.55;

  // 橫波使用單排粒子模擬；縱波與深水波使用 7 排粒子
  const isSingleRow = type === 'transverse';

  // 波長計算與第二個同相粒子索引
  const metrics = calculateMetrics(params);
  const lambda = metrics.wavelength;
  const cStep = Math.max(1, Math.round(lambda / SPACING_X));

  let secondHighlightIndex: number | null = null;
  if (viewOptions.showWavelength) {
    if (highlightIndex + cStep < COLS) {
      secondHighlightIndex = highlightIndex + cStep;
    } else if (highlightIndex - cStep >= 0) {
      secondHighlightIndex = highlightIndex - cStep;
    } else {
      let bestCol = -1;
      let minDiff = Infinity;
      for (let c = 0; c < COLS; c++) {
        if (c === highlightIndex) continue;
        const dist = Math.abs(c - highlightIndex) * SPACING_X;
        const diff = Math.abs(dist - lambda);
        if (diff < minDiff) {
          minDiff = diff;
          bestCol = c;
        }
      }
      if (bestCol >= 0) secondHighlightIndex = bestCol;
    }
  }

  // Handle external time actions (step forward, step backward, reset)
  useEffect(() => {
    if (!timeAction) return;
    if (timeAction.type === 'step') {
      simTimeRef.current = Math.max(0, simTimeRef.current + (timeAction.delta || 0));
    } else if (timeAction.type === 'reset') {
      simTimeRef.current = 0;
      trajectoryHistoryRef.current = [];
      trajectoryHistory2Ref.current = [];
    }
    renderFrameRef.current();
  }, [timeAction]);

  // Reset trajectory history when mode or type changes
  useEffect(() => {
    trajectoryHistoryRef.current = [];
    trajectoryHistory2Ref.current = [];
    renderFrameRef.current();
  }, [mode, type, params.frequency, params.amplitude, params.waveSpeed]);

  // ResizeObserver to track container size without triggering layout thrashing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = window.devicePixelRatio || 1;
          canvasDimensionsRef.current = { width, height, dpr };
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
          }
          renderFrameRef.current();
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current && !isPanningRef.current) return;
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingRef.current) {
        onCameraChange({
          ...camera,
          yaw: camera.yaw + dx * 0.007,
          pitch: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.pitch + dy * 0.007)),
        });
      } else if (isPanningRef.current) {
        onCameraChange({
          ...camera,
          panX: camera.panX + dx * 0.04,
          panY: camera.panY + dy * 0.04,
        });
      }
    },
    [camera, onCameraChange]
  );

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      const newDistance = Math.max(12, Math.min(80, camera.distance * zoomFactor));
      onCameraChange({
        ...camera,
        distance: newDistance,
      });
    },
    [camera, onCameraChange]
  );

  // Touch support for mobile/tablets
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (touchStartRef.current && e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      onCameraChange({
        ...camera,
        yaw: camera.yaw + dx * 0.008,
        pitch: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.pitch + dy * 0.008)),
      });
    }
  };
  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // High-performance canvas frame renderer
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, dpr } = canvasDimensionsRef.current;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep space dark stage background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, width, height);

    // Camera and projection parameters
    const cx = width / 2 + camera.panX * 10;
    const cy = height / 2 + camera.panY * 10;
    const scale = (height / camera.distance) * 1.55;
    const visualScale = 2.4;
    const fovDistance = 45;

    // 3D Projection Trigonometric constants
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);
    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);

    const project3D = (x: number, y: number, z: number) => {
      const x1 = x * cosYaw - z * sinYaw;
      const z1 = x * sinYaw + z * cosYaw;
      const y2 = y * cosPitch - z1 * sinPitch;
      const z2 = y * sinPitch + z1 * cosPitch;
      const perspective = fovDistance / (fovDistance + z2);
      const px = cx + x1 * scale * perspective;
      const py = cy - y2 * scale * perspective;
      return { px, py, depth: z2, perspective };
    };

    // Draw baseline reference plane or grid lines
    if (viewOptions.showEquilibrium) {
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);

      const pStart = project3D(-SYSTEM_LENGTH / 2 - 1, 0, 0);
      const pEnd = project3D(SYSTEM_LENGTH / 2 + 1, 0, 0);
      ctx.beginPath();
      ctx.moveTo(pStart.px, pStart.py);
      ctx.lineTo(pEnd.px, pEnd.py);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Active grid layout based on wave type
    const activeRows = isSingleRow ? 1 : ROWS;
    const activeDepth = isSingleRow ? 1 : DEPTH_LAYERS;

    const xOffset = -SYSTEM_LENGTH / 2;
    const yOffset = isSingleRow ? 0 : -((activeRows - 1) * SPACING_Y) / 2;
    const zOffset = isSingleRow ? 0 : -((activeDepth - 1) * SPACING_Z) / 2;

    const midRow = Math.floor(activeRows / 2);
    const midLayer = Math.floor(activeDepth / 2);

    // 深水波聚焦於表面最上層粒子 (row = 0)；橫波/縱波聚焦於中央粒子
    const focusRow = type === 'circular' ? 0 : (isSingleRow ? 0 : midRow);

    // Wave physics precomputed constants for current frame
    const k = metrics.waveNumber;
    const omega = metrics.angularFreq;
    const t = simTimeRef.current;
    const omega_t = omega * t;
    const cos_omega_t = Math.cos(omega_t);
    const amplitude = params.amplitude;

    // Precompute exponential depth decay factors for circular wave (7 rows max)
    // Orbital radius decays exponentially with depth: r(d) = A * exp(-k * d)
    // Approx 4% decay at half wavelength (Airy deep water wave)
    const decayFactors = [1, 0, 0, 0, 0, 0, 0];
    if (type === 'circular') {
      for (let r = 0; r < activeRows; r++) {
        decayFactors[r] = Math.exp(-k * (r * SPACING_Y));
      }
    }

    const baseRadius = isSingleRow ? 6.2 : 4.8;
    const beadsPool = beadsPoolRef.current;
    let beadCount = 0;

    // Compute particles using optimized scalar math and reused pool
    for (let col = 0; col < COLS; col++) {
      const x0 = xOffset + col * SPACING_X;
      const k_x0 = k * x0;

      const isPrimaryHighlight = col === highlightIndex;
      const isSecondaryHighlight = secondHighlightIndex !== null && col === secondHighlightIndex;
      const isColHighlighted = isPrimaryHighlight || isSecondaryHighlight;

      for (let row = 0; row < activeRows; row++) {
        const y0 = type === 'circular'
          ? -row * SPACING_Y
          : (isSingleRow ? 0 : yOffset + row * SPACING_Y);

        for (let layer = 0; layer < activeDepth; layer++) {
          const z0 = isSingleRow ? 0 : zOffset + layer * SPACING_Z;

          let dx = 0;
          let dy = 0;
          const dz = 0;

          if (mode === 'traveling') {
            const phase = k_x0 - omega_t;
            if (type === 'transverse') {
              dy = amplitude * Math.sin(phase);
            } else if (type === 'longitudinal') {
              dx = amplitude * Math.cos(phase);
            } else {
              const A = amplitude * decayFactors[row];
              dx = A * Math.cos(phase);
              dy = A * Math.sin(phase);
            }
          } else {
            // Standing wave
            if (type === 'transverse') {
              dy = amplitude * Math.sin(k_x0) * cos_omega_t;
            } else if (type === 'longitudinal') {
              dx = amplitude * Math.cos(k_x0) * cos_omega_t;
            } else {
              const A = amplitude * decayFactors[row];
              dx = A * Math.sin(k_x0) * cos_omega_t;
              dy = -A * Math.cos(k_x0) * cos_omega_t;
            }
          }

          const currentX = x0 + dx * visualScale;
          const currentY = y0 + dy * visualScale;
          const currentZ = z0 + dz * visualScale;

          // Inline 3D Projection math
          const x1 = currentX * cosYaw - currentZ * sinYaw;
          const z1 = currentX * sinYaw + currentZ * cosYaw;
          const y2 = currentY * cosPitch - z1 * sinPitch;
          const z2 = currentY * sinPitch + z1 * cosPitch;
          const perspective = fovDistance / (fovDistance + z2);
          const px = cx + x1 * scale * perspective;
          const py = cy - y2 * scale * perspective;

          const isCenterHighlight = isColHighlighted && row === focusRow && layer === midLayer;
          const r = Math.max(1.8, baseRadius * perspective);

          if (beadCount < MAX_BEADS) {
            const bead = beadsPool[beadCount++];
            bead.px = px;
            bead.py = py;
            bead.depth = z2;
            bead.radius = r;
            bead.isHighlighted = isColHighlighted;
            bead.isCenterHighlight = isCenterHighlight;
            bead.colIndex = col;
            bead.x0 = x0;
            bead.y0 = y0;
            bead.z0 = z0;
          }

          // Record trajectory for highlighted focus particle
          if (isPrimaryHighlight && row === focusRow && layer === midLayer) {
            trajectoryHistoryRef.current.push({ x: currentX, y: currentY, z: currentZ });
            if (trajectoryHistoryRef.current.length > 120) {
              trajectoryHistoryRef.current.shift();
            }
          }

          // Record trajectory for second in-phase particle when showWavelength is true
          if (isSecondaryHighlight && row === focusRow && layer === midLayer) {
            trajectoryHistory2Ref.current.push({ x: currentX, y: currentY, z: currentZ });
            if (trajectoryHistory2Ref.current.length > 120) {
              trajectoryHistory2Ref.current.shift();
            }
          }
        }
      }
    }

    // Sort active beads slice by depth from back to front
    const activeBeads = beadsPool.slice(0, beadCount);
    activeBeads.sort((a, b) => b.depth - a.depth);

    // If standing wave and user wants component waves (入射波 & 反射波)
    if (mode === 'standing' && viewOptions.showComponents && type === 'transverse') {
      // Draw Incident Wave (Right-moving, dashed cyan)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      const ampHalfVis = (params.amplitude / 2) * visualScale;
      for (let c = 0; c < COLS; c++) {
        const x = xOffset + c * SPACING_X;
        const y = ampHalfVis * Math.sin(k * x - omega_t);
        const p = project3D(x, y, 0);
        if (c === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.stroke();

      // Draw Reflected Wave (Left-moving, dashed violet)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      for (let c = 0; c < COLS; c++) {
        const x = xOffset + c * SPACING_X;
        const y = ampHalfVis * Math.sin(k * x + omega_t);
        const p = project3D(x, y, 0);
        if (c === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Standing Wave Node and Antinode markers if enabled
    if (mode === 'standing' && viewOptions.showNodesAndAntinodes) {
      const halfLambda = lambda / 2;
      const xMin = -SYSTEM_LENGTH / 2;
      const xMax = SYSTEM_LENGTH / 2;
      const isTrans = type === 'transverse';

      // 1. Antinodes (腹點)
      const offsetAnti = isTrans ? 0.5 : 0;
      const nAntiMin = Math.ceil(xMin / halfLambda - offsetAnti);
      const nAntiMax = Math.floor(xMax / halfLambda - offsetAnti);
      const tagOffset = 1.8 * visualScale * params.amplitude;

      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      for (let n = nAntiMin; n <= nAntiMax; n++) {
        const x = (n + offsetAnti) * halfLambda;
        if (x < xMin - 0.05 || x > xMax + 0.05) continue;

        const topP = project3D(x, tagOffset, 0);
        const botP = project3D(x, -tagOffset, 0);

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)'; // Emerald green
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.moveTo(topP.px, topP.py);
        ctx.lineTo(botP.px, botP.py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#4ADE80';
        ctx.fillText('腹點 A', topP.px, topP.py - 6);
      }

      // 2. Nodes (節點)
      const offsetNode = isTrans ? 0 : 0.5;
      const nNodeMin = Math.ceil(xMin / halfLambda - offsetNode);
      const nNodeMax = Math.floor(xMax / halfLambda - offsetNode);

      for (let n = nNodeMin; n <= nNodeMax; n++) {
        const x = (n + offsetNode) * halfLambda;
        if (x < xMin - 0.05 || x > xMax + 0.05) continue;

        const topP = project3D(x, tagOffset, 0);
        const botP = project3D(x, -tagOffset, 0);

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Coral red
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(topP.px, topP.py);
        ctx.lineTo(botP.px, botP.py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#F87171';
        ctx.fillText('節點 N', topP.px, topP.py - 6);
      }
    }

    // Draw trajectory path of highlighted beads
    if (viewOptions.showTrajectory) {
      if (trajectoryHistoryRef.current.length > 2) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const history = trajectoryHistoryRef.current;
        for (let i = 0; i < history.length; i++) {
          const pt = history[i];
          const proj = project3D(pt.x, pt.y, pt.z);
          if (i === 0) ctx.moveTo(proj.px, proj.py);
          else ctx.lineTo(proj.px, proj.py);
        }
        ctx.stroke();
      }

      // If second particle exists, also draw its trajectory
      if (viewOptions.showWavelength && trajectoryHistory2Ref.current.length > 2) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const history2 = trajectoryHistory2Ref.current;
        for (let i = 0; i < history2.length; i++) {
          const pt = history2[i];
          const proj = project3D(pt.x, pt.y, pt.z);
          if (i === 0) ctx.moveTo(proj.px, proj.py);
          else ctx.lineTo(proj.px, proj.py);
        }
        ctx.stroke();
      }

      // Draw faint equilibrium crosshairs
      for (let i = 0; i < beadCount; i++) {
        const cb = activeBeads[i];
        if (!cb.isCenterHighlight) continue;
        const eqProj = project3D(cb.x0, cb.y0, cb.z0);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(eqProj.px, eqProj.py, 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 深水波專屬：繪製焦點粒子所在整縱列各深度的圓周運動軌道導引線
      if (type === 'circular') {
        const colsToDraw = [highlightIndex];
        if (viewOptions.showWavelength && secondHighlightIndex !== null) {
          colsToDraw.push(secondHighlightIndex);
        }

        ctx.save();
        ctx.lineWidth = 1.1;
        ctx.setLineDash([2, 3]);

        for (const colIdx of colsToDraw) {
          const hx0 = xOffset + colIdx * SPACING_X;
          for (let rIdx = 1; rIdx < ROWS; rIdx++) {
            const hy0 = -rIdx * SPACING_Y;
            const radiusOrbit = params.amplitude * decayFactors[rIdx] * visualScale;
            if (radiusOrbit < 0.08) continue;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0.12, 0.42 - rIdx * 0.05)})`;

            const STEPS = 24;
            for (let s = 0; s <= STEPS; s++) {
              const angle = (s / STEPS) * 2 * Math.PI;
              const ox = hx0 + radiusOrbit * Math.cos(angle);
              const oy = hy0 + radiusOrbit * Math.sin(angle);
              const op = project3D(ox, oy, 0);
              if (s === 0) ctx.moveTo(op.px, op.py);
              else ctx.lineTo(op.px, op.py);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // High-performance hardware-accelerated bead sprite blitting
    const whiteSprite = whiteSpriteRef.current;
    const amberSprite = amberSpriteRef.current;

    for (let i = 0; i < beadCount; i++) {
      const bead = activeBeads[i];
      if (viewOptions.hideWhiteBeads && !bead.isHighlighted) {
        continue;
      }

      const sprite = bead.isHighlighted ? amberSprite : whiteSprite;
      if (sprite) {
        ctx.drawImage(
          sprite,
          bead.px - bead.radius,
          bead.py - bead.radius,
          bead.radius * 2,
          bead.radius * 2
        );
      }

      // Extra outer pulse/glow ring for central highlighted bead
      if (bead.isCenterHighlight) {
        ctx.beginPath();
        ctx.arc(bead.px, bead.py, bead.radius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // Draw Scientific Measurement Overlays: Wavelength λ and Amplitude A

    // 1. Amplitude Indicator (顯示振幅)
    if (viewOptions.showAmplitude) {
      const centerColX = xOffset + highlightIndex * SPACING_X;

      if (type === 'transverse') {
        const halfLambda = lambda / 2;
        let ampColX = centerColX;
        if (mode === 'standing') {
          const nearestN = Math.round(centerColX / halfLambda - 0.5);
          ampColX = (nearestN + 0.5) * halfLambda;
        }

        const eqPt = project3D(ampColX + 1.2, 0, 0);
        const maxPt = project3D(ampColX + 1.2, params.amplitude * visualScale, 0);

        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        const peakPt = project3D(ampColX, params.amplitude * visualScale, 0);
        ctx.beginPath();
        ctx.moveTo(peakPt.px, peakPt.py);
        ctx.lineTo(maxPt.px, maxPt.py);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eqPt.px, eqPt.py);
        ctx.lineTo(maxPt.px, maxPt.py);
        ctx.stroke();

        const tickWidth = 8;
        ctx.beginPath();
        ctx.moveTo(eqPt.px - tickWidth, eqPt.py);
        ctx.lineTo(eqPt.px + tickWidth, eqPt.py);
        ctx.moveTo(maxPt.px - tickWidth, maxPt.py);
        ctx.lineTo(maxPt.px + tickWidth, maxPt.py);
        ctx.stroke();

        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FDE68A';
        ctx.textAlign = 'left';
        ctx.fillText(`振幅 A = ${params.amplitude.toFixed(2)} m`, maxPt.px + 12, (eqPt.py + maxPt.py) / 2 + 4);
      } else if (type === 'longitudinal') {
        const yLevel = isSingleRow ? -1.8 : yOffset + midRow * SPACING_Y - 1.8;
        const eqPt = project3D(centerColX, yLevel, 0);
        const maxDispPt = project3D(centerColX + params.amplitude * visualScale, yLevel, 0);

        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eqPt.px, eqPt.py);
        ctx.lineTo(maxDispPt.px, maxDispPt.py);
        ctx.stroke();

        const tickHeight = 6;
        ctx.beginPath();
        ctx.moveTo(eqPt.px, eqPt.py - tickHeight);
        ctx.lineTo(eqPt.px, eqPt.py + tickHeight);
        ctx.moveTo(maxDispPt.px, maxDispPt.py - tickHeight);
        ctx.lineTo(maxDispPt.px, maxDispPt.py + tickHeight);
        ctx.stroke();

        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FDE68A';
        ctx.textAlign = 'center';
        ctx.fillText(`振幅 A = ${params.amplitude.toFixed(2)} m`, (eqPt.px + maxDispPt.px) / 2, eqPt.py - 10);
      } else {
        // 深水波：以表面最頂層粒子 (row = 0) 之平衡水面 (y0 = 0) 與波峰高度標註振幅 A
        const ampColX = centerColX;
        const eqPt = project3D(ampColX + 1.2, 0, 0);
        const maxPt = project3D(ampColX + 1.2, params.amplitude * visualScale, 0);

        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        const peakPt = project3D(ampColX, params.amplitude * visualScale, 0);
        ctx.beginPath();
        ctx.moveTo(peakPt.px, peakPt.py);
        ctx.lineTo(maxPt.px, maxPt.py);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(eqPt.px, eqPt.py);
        ctx.lineTo(maxPt.px, maxPt.py);
        ctx.stroke();

        const tickWidth = 8;
        ctx.beginPath();
        ctx.moveTo(eqPt.px - tickWidth, eqPt.py);
        ctx.lineTo(eqPt.px + tickWidth, eqPt.py);
        ctx.moveTo(maxPt.px - tickWidth, maxPt.py);
        ctx.lineTo(maxPt.px + tickWidth, maxPt.py);
        ctx.stroke();

        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FDE68A';
        ctx.textAlign = 'left';
        ctx.fillText(`表面振幅 A = ${params.amplitude.toFixed(2)} m`, maxPt.px + 12, (eqPt.py + maxPt.py) / 2 + 4);
      }
    }

    // 2. Wavelength Indicator (顯示波長)
    if (viewOptions.showWavelength) {
      let beadA: RenderBead | null = null;
      let beadB: RenderBead | null = null;
      for (let i = 0; i < beadCount; i++) {
        const b = activeBeads[i];
        if (b.colIndex === highlightIndex && b.isCenterHighlight) beadA = b;
        if (secondHighlightIndex !== null && b.colIndex === secondHighlightIndex && b.isCenterHighlight) beadB = b;
      }

      if (beadA) {
        const leftBead = beadB && beadB.x0 < beadA.x0 ? beadB : beadA;
        const rightBead = beadB && beadB.x0 < beadA.x0 ? beadA : (beadB || beadA);
        const isPair = beadB !== null && leftBead !== rightBead;

        const surfaceY = type === 'circular' ? 0 : (isSingleRow ? 0 : (activeRows * SPACING_Y) / 2);
        const bracketY = surfaceY + params.amplitude * visualScale + 2.2;

        const leftBracketPt = project3D(leftBead.x0, bracketY, 0);
        const rightBracketPt = isPair
          ? project3D(rightBead.x0, bracketY, 0)
          : project3D(leftBead.x0 + lambda, bracketY, 0);

        const leftEqPt = project3D(leftBead.x0, leftBead.y0, 0);
        const rightEqPt = isPair
          ? project3D(rightBead.x0, rightBead.y0, 0)
          : project3D(leftBead.x0 + lambda, leftBead.y0, 0);

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;

        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.moveTo(leftEqPt.px, leftEqPt.py);
        ctx.lineTo(leftBracketPt.px, leftBracketPt.py);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.arc(leftEqPt.px, leftEqPt.py, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (isPair) {
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(rightEqPt.px, rightEqPt.py);
          ctx.lineTo(rightBracketPt.px, rightBracketPt.py);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(rightEqPt.px, rightEqPt.py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Horizontal dimension span
        ctx.beginPath();
        ctx.moveTo(leftBracketPt.px, leftBracketPt.py);
        ctx.lineTo(rightBracketPt.px, rightBracketPt.py);
        ctx.stroke();

        const dropTick = 10;
        ctx.beginPath();
        ctx.moveTo(leftBracketPt.px, leftBracketPt.py - 4);
        ctx.lineTo(leftBracketPt.px, leftBracketPt.py + dropTick);
        ctx.moveTo(rightBracketPt.px, rightBracketPt.py - 4);
        ctx.lineTo(rightBracketPt.px, rightBracketPt.py + dropTick);
        ctx.stroke();

        const drawArrow = (fromX: number, fromY: number, toX: number, toY: number) => {
          const headlen = 7;
          const angle = Math.atan2(toY - fromY, toX - fromX);
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = '#38BDF8';
          ctx.fill();
        };
        drawArrow(leftBracketPt.px + 12, leftBracketPt.py, leftBracketPt.px, leftBracketPt.py);
        drawArrow(rightBracketPt.px - 12, rightBracketPt.py, rightBracketPt.px, rightBracketPt.py);

        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#BAE6FD';
        ctx.textAlign = 'center';
        const midPx = (leftBracketPt.px + rightBracketPt.px) / 2;
        const midPy = (leftBracketPt.py + rightBracketPt.py) / 2;
        ctx.fillText(`波長 λ = ${lambda.toFixed(2)} m`, midPx, midPy - 8);
      }
    }

    ctx.restore();
  }, [
    mode,
    type,
    params,
    viewOptions,
    highlightIndex,
    secondHighlightIndex,
    camera,
    isSingleRow,
    metrics,
    lambda,
  ]);

  const renderFrameRef = useRef(renderFrame);
  renderFrameRef.current = renderFrame;

  // Render loop driven by requestAnimationFrame directly on canvas without React reconciler overhead
  useEffect(() => {
    let animId: number;
    let lastTime: number | null = null;

    const tick = (timestamp: number) => {
      if (lastTime !== null && isPlaying) {
        const deltaSec = Math.min(0.05, (timestamp - lastTime) / 1000);
        simTimeRef.current += deltaSec * params.playbackSpeed;
      }
      lastTime = timestamp;
      renderFrameRef.current();

      if (isPlaying) {
        animId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(tick);
    } else {
      renderFrameRef.current();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, params.playbackSpeed]);

  // Redraw when static props change while paused
  useEffect(() => {
    if (!isPlaying) {
      renderFrameRef.current();
    }
  }, [isPlaying, mode, type, params, viewOptions, highlightIndex, camera]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex-1 bg-slate-950 select-none overflow-hidden block"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full cursor-grab active:cursor-grabbing block touch-none"
      />

      {/* Floating View & Stage HUD Overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <div className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-md border border-slate-700/60 text-xs font-mono text-slate-300 shadow-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>
            {mode === 'traveling' ? '行進波' : '駐波'} · {type === 'longitudinal' ? '縱波' : type === 'transverse' ? '橫波' : '深水波'}
          </span>
        </div>
      </div>

      {/* Viewport Control Mini Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-lg">
        <button
          title="正面視角 (觀察橫波振動最佳)"
          onClick={() => onCameraChange({ ...camera, pitch: 0, yaw: 0, panX: 0, panY: 0 })}
          className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          正面
        </button>
        <button
          title="重置視角"
          onClick={() => onCameraChange({ pitch: 0.32, yaw: 0.18, distance: 28, panX: 0, panY: 0 })}
          className="px-2 py-1 text-xs text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors"
        >
          重置
        </button>
      </div>

      {/* Interactive Helper Hint */}
      <div className="absolute bottom-2.5 left-3 text-[11px] text-slate-500 pointer-events-none flex items-center gap-3 font-mono">
        <span>滑鼠拖曳：旋轉視角</span>
        <span>·</span>
        <span>滾輪：縮放</span>
        <span>·</span>
        <span>Shift + 拖曳：平移</span>
      </div>
    </div>
  );
};
