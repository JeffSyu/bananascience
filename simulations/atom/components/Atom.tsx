import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from 'react';
import { ElementData } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface AtomProps {
  element: ElementData;
  showSpin: boolean;
}

interface ElectronData {
  id: string;
  angle: number;
  shellRadius: number;
  speed: number;
  isSpinUp: boolean;
}

const SUBSHELL_CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const ANGULAR_QUANTUM: Record<string, number> = { s: 0, p: 1, d: 2, f: 3 };
const NOBLE_CORE: Record<string, string> = {
  "[He]": "1s2",
  "[Ne]": "1s2 2s2 2p6",
  "[Ar]": "1s2 2s2 2p6 3s2 3p6",
  "[Kr]": "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6",
  "[Xe]": "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6",
  "[Rn]": "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6"
};

const SHELL_NAMES = ["K", "L", "M", "N", "O", "P", "Q"];

// Cache for expanded configs to avoid repeated string replacements
const configCache = new Map<string, string>();
const getFullConfig = (config: string): string => {
  if (configCache.has(config)) {
    return configCache.get(config)!;
  }
  let full = config;
  for (const [core, expansion] of Object.entries(NOBLE_CORE)) {
    if (full.includes(core)) {
      full = full.replace(core, expansion);
    }
  }
  configCache.set(config, full);
  return full;
};

const getSpinsForElement = (config: string): Record<number, boolean[]> => {
  const fullConfig = getFullConfig(config);
  const shellSpins: Record<number, boolean[]> = {};
  const parts = fullConfig.trim().split(/\s+/);
  
  for (const part of parts) {
    const match = part.match(/(\d+)([spdf])(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      const type = match[2];
      const count = parseInt(match[3], 10);
      const capacity = SUBSHELL_CAPACITY[type] || 2;
      if (!shellSpins[n]) shellSpins[n] = [];
      const halfCap = capacity / 2;
      for (let k = 0; k < count; k++) {
        shellSpins[n].push(k < halfCap);
      }
    }
  }
  return shellSpins;
};

const Atom: React.FC<AtomProps> = ({ element, showSpin }) => {
  const [selectedShell, setSelectedShell] = useState<number | null>(null);
  const electronElementsRef = useRef<(SVGCircleElement | null)[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Close shell modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedShell !== null) {
        setSelectedShell(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShell]);

  // Compute electron orbit parameters
  const electrons = useMemo(() => {
    const list: ElectronData[] = [];
    const spinMap = getSpinsForElement(element.config);
    const baseRadius = 60;
    const gap = 35;

    element.shells.forEach((electronCount, shellIndex) => {
      const n = shellIndex + 1;
      const radius = baseRadius + (shellIndex * gap);
      const speed = (0.5 / n) * (n % 2 === 0 ? 1 : -1); 
      const spins = spinMap[n] || [];

      for (let i = 0; i < electronCount; i++) {
        const startAngle = (i / electronCount) * 2 * Math.PI;
        const isSpinUp = (i < spins.length) ? spins[i] : (i % 2 === 0);
        list.push({
          id: `e-${shellIndex}-${i}`,
          angle: startAngle,
          shellRadius: radius,
          speed: speed,
          isSpinUp: isSpinUp
        });
      }
    });
    return list;
  }, [element.shells, element.config]);

  // Reset electron element refs array length when electrons change
  useEffect(() => {
    electronElementsRef.current = electronElementsRef.current.slice(0, electrons.length);
  }, [electrons.length]);

  // Smooth continuous requestAnimationFrame loop without SVG re-creation
  useEffect(() => {
    let isCancelled = false;

    const animate = (timestamp: number) => {
      if (isCancelled) return;
      const elapsed = timestamp * 0.001;
      const center = 300;
      const elements = electronElementsRef.current;

      for (let i = 0; i < electrons.length; i++) {
        const circle = elements[i];
        if (circle) {
          const e = electrons[i];
          const currentAngle = e.angle + (e.speed * elapsed);
          const cx = center + Math.cos(currentAngle) * e.shellRadius;
          const cy = center + Math.sin(currentAngle) * e.shellRadius;
          circle.setAttribute('cx', cx.toFixed(2));
          circle.setAttribute('cy', cy.toFixed(2));
        }
      }

      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [electrons]);

  // Selected shell detailed breakdown
  const selectedShellDetails = useMemo(() => {
    if (selectedShell === null) return null;
    const n = selectedShell;
    const fullConfig = getFullConfig(element.config);
    const subshells = fullConfig.trim().split(/\s+/).filter(s => s.startsWith(n.toString()));
    const shellName = SHELL_NAMES[n - 1] || "?";
    const maxCapacity = 2 * Math.pow(n, 2);
    
    const subshellData = subshells.map(part => {
      const match = part.match(/(\d+)([spdf])(\d+)/);
      if (!match) return null;
      const type = match[2];
      const count = parseInt(match[3], 10);
      const l = ANGULAR_QUANTUM[type] ?? 0;
      const orbitals = (SUBSHELL_CAPACITY[type] || 2) / 2;
      
      const orbitalElectrons = Array.from({ length: orbitals }, (_, i) => {
        const spins: boolean[] = [];
        if (count > i) spins.push(true); 
        if (count > i + orbitals) spins.push(false); 
        return spins;
      });

      return { type, count, l, orbitalElectrons };
    }).filter(Boolean);

    return { n, shellName, maxCapacity, subshellData };
  }, [selectedShell, element.config]);

  const nucleusColor = CATEGORY_COLORS[element.category] || "#94a3b8";
  const shellRadii = useMemo(() => element.shells.map((_, i) => 60 + (i * 35)), [element.shells]);

  const handleShellClick = useCallback((shellNumber: number) => {
    setSelectedShell(prev => (prev === shellNumber ? null : shellNumber));
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-transparent">
      {/* Declarative SVG Canvas */}
      <svg 
        viewBox="0 0 600 600"
        className="w-full h-full max-w-[700px] max-h-[700px] relative z-10"
        style={{ minHeight: '320px' }}
      >
        <defs>
          <radialGradient id={`nucleus-glow-${element.z}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
            <stop offset="60%" stopColor={nucleusColor} stopOpacity={0.9} />
            <stop offset="100%" stopColor={nucleusColor} stopOpacity={1} />
          </radialGradient>
        </defs>

        <g>
          {/* Shell Orbits */}
          {shellRadii.map((radius, idx) => {
            const shellNum = idx + 1;
            const isSelected = selectedShell === shellNum;
            return (
              <g 
                key={`shell-${shellNum}`}
                className="cursor-pointer group"
                onClick={() => handleShellClick(shellNum)}
              >
                {/* Transparent wider target for easy touch/mouse clicking */}
                <circle
                  cx={300}
                  cy={300}
                  r={radius}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={24}
                />
                {/* Visible orbit ring */}
                <circle
                  cx={300}
                  cy={300}
                  r={radius}
                  fill="none"
                  stroke={isSelected ? "#facc15" : "#334155"}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={isSelected ? "none" : "4 4"}
                  strokeOpacity={isSelected ? 1 : 0.65}
                  className="transition-colors duration-200 group-hover:stroke-sky-400 group-hover:stroke-opacity-90"
                />
              </g>
            );
          })}

          {/* Nucleus Glow & Center */}
          <circle
            cx={300}
            cy={300}
            r={26}
            fill={`url(#nucleus-glow-${element.z})`}
            stroke={nucleusColor}
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 12px ${nucleusColor})` }}
          />

          {/* Element Symbol in Nucleus */}
          <text
            x={300}
            y={307}
            textAnchor="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="bold"
            fontSize="18"
            fill="#0f172a"
            className="select-none pointer-events-none"
          >
            {element.symbol}
          </text>

          {/* Electrons */}
          {electrons.map((e, index) => {
            const fillColor = showSpin 
              ? (e.isSpinUp ? "#38bdf8" : "#f472b6") 
              : "#38bdf8";

            return (
              <circle
                key={e.id}
                ref={(el) => { electronElementsRef.current[index] = el; }}
                cx={300}
                cy={300}
                r={6}
                fill={fillColor}
                stroke="#0f172a"
                strokeWidth={1}
                className="transition-colors duration-200"
                style={{ 
                  filter: `drop-shadow(0 0 4px ${fillColor})`,
                  willChange: 'cx, cy'
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Selected Shell Inspector Modal */}
      {selectedShellDetails && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedShell(null)}
          />
          <div className="relative w-full max-w-sm bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-5 overflow-y-auto max-h-[90%] text-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedShell(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              aria-label="關閉"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {selectedShellDetails.shellName} 殼層
                </h3>
                <span className="bg-sky-500/15 text-sky-400 text-xs font-mono px-2 py-0.5 rounded border border-sky-500/30">
                  主量子數 n = {selectedShellDetails.n}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-300 font-medium">
                殼層容量: <span className="text-sky-300 font-bold">{element.shells[selectedShellDetails.n - 1] ?? 0}</span> / {selectedShellDetails.maxCapacity} 個電子
              </div>                  
            </div>

            <div className="space-y-4">
              {selectedShellDetails.subshellData.map((sub, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-end mb-2 px-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-white">{selectedShellDetails.n}{sub.type}</span>
                      <span className="text-xs text-sky-400 font-mono">(角量子數 l = {sub.l})</span>
                    </div>
                    <div className="text-xs font-bold text-slate-400 font-mono">
                      填充: {sub.count} e⁻
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 group-hover:border-slate-700 transition-colors">
                    {sub.orbitalElectrons.map((spins, orbitalIdx) => {
                      const ml = orbitalIdx - Math.floor(sub.orbitalElectrons.length / 2);
                      return (
                        <div key={orbitalIdx} className="flex flex-col items-center flex-1 min-w-[32px] max-w-[44px]">
                          <div className="w-full aspect-[6/5] border border-slate-700 rounded-lg flex flex-row items-center justify-center bg-slate-950/60 relative overflow-hidden shadow-inner">
                            <div className="flex gap-0.5 items-center justify-center">
                              {spins.map((isUp, eIdx) => (
                                <div 
                                  key={eIdx} 
                                  className={`text-lg leading-none font-bold select-none ${isUp ? 'text-sky-400' : 'text-pink-400'}`}
                                  style={{ transform: isUp ? 'none' : 'rotate(180deg)' }}
                                >
                                  ↑
                                </div>
                              ))}
                              {spins.length === 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-700/60"></div>}
                            </div>
                          </div>
                          <div className="mt-1 text-[9px] text-slate-400 font-mono tabular-nums leading-none">
                            {ml > 0 ? `+${ml}` : ml}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedShellDetails.subshellData.length === 0 && (
                <div className="text-slate-500 text-center py-6 text-sm">此組態中無亞軌域填充</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend & Hint */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 items-end pointer-events-none z-20">
        {showSpin && (
          <div className="flex flex-col gap-1 bg-slate-900/85 p-2 rounded-lg border border-slate-700/80 text-[11px] font-mono text-slate-300 backdrop-blur-sm shadow-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_4px_#38bdf8]"></span> 自旋向上 (Spin Up)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shadow-[0_0_4px_#f472b6]"></span> 自旋向下 (Spin Down)
            </div>
          </div>
        )}
        <div className="text-[11px] text-sky-400/80 font-mono bg-slate-900/60 px-2 py-0.5 rounded backdrop-blur-sm border border-slate-800">
          提示：點擊同心軌道查看殼層詳細軌域
        </div>
      </div>
    </div>
  );
};

export default memo(Atom);
