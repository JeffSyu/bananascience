import React, { useState, useMemo } from 'react';
import { Crosshair, ArrowRight } from 'lucide-react';

interface SimulatorProps {
  currentX: number;
  currentV: number;
  currentA: number;
  minX: number;
  maxX: number;
}

export const Simulator: React.FC<SimulatorProps> = React.memo(({ currentX, currentV, currentA, minX: defaultMinX, maxX: defaultMaxX }) => {
  const [autoCenter, setAutoCenter] = useState(false);
  const [showVelocity, setShowVelocity] = useState(true);
  const [showAcceleration, setShowAcceleration] = useState(true);
  
  const viewWidth = defaultMaxX - defaultMinX; // Total range
  let minX = defaultMinX;
  let maxX = defaultMaxX;
  
  if (autoCenter) {
    minX = currentX - viewWidth / 2;
    maxX = currentX + viewWidth / 2;
  }
  
  // No clamping! Allows the object to go off-screen smoothly
  let percentage = ((currentX - minX) / (maxX - minX)) * 100;
  
  // Generate 9 markers across the view (memoized to avoid GC allocations during playback)
  const markers = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => minX + (viewWidth / 8) * i);
  }, [minX, viewWidth]);

  return (
    <div className="h-48 shrink-0 bg-[#0F172A] relative p-6 border-b border-slate-800 overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button 
          onClick={() => setShowVelocity(!showVelocity)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded border ${showVelocity ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'} transition-colors`}
        >
          <ArrowRight size={14} className={showVelocity ? 'text-emerald-400' : 'text-slate-400'} />
          v
        </button>
        <button 
          onClick={() => setShowAcceleration(!showAcceleration)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded border ${showAcceleration ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'} transition-colors`}
        >
          <ArrowRight size={14} className={showAcceleration ? 'text-amber-400' : 'text-slate-400'} />
          a
        </button>
      </div>

      <button 
        onClick={() => setAutoCenter(!autoCenter)}
        className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded border ${autoCenter ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'} transition-colors`}
      >
        <Crosshair size={14} />
        {autoCenter ? '追蹤: ON' : '追蹤: OFF'}
      </button>

      <div className="relative h-full flex flex-col justify-center max-w-5xl mx-auto">
        
        {/* Track / Rulers */}
        <div className="relative w-full h-1 bg-slate-700 rounded mt-8">
          {markers.map((val, i) => {
            const p = ((val - minX) / (maxX - minX)) * 100;
            return (
              <div key={i} className="absolute top-0 -translate-y-1/2 w-0.5 h-3 bg-slate-600" style={{ left: `${p}%` }}>
                <span className={`absolute top-4 left-1/2 -translate-x-1/2 text-sm font-mono whitespace-nowrap ${Math.abs(val) < 0.1 ? 'text-red-400/80 font-bold' : 'text-slate-500'}`}>
                  {Math.round(val)}m
                </span>
              </div>
            );
          })}
          {/* 0 marker (Red line) - only show if it's within the current view */}
          {0 >= minX && 0 <= maxX && (
             <div className="absolute top-0 -translate-y-1/2 w-0.5 h-5 bg-red-500/80" style={{ left: `${((0 - minX) / (maxX - minX)) * 100}%` }}></div>
          )}
        </div>
        
        {/* Object (Simple Box) */}
        <div 
          className="absolute top-[50%] md:top-[35%] flex flex-col items-center"
          style={{ left: `${percentage}%`, transform: `translate(-50%, -50%)` }}
        >
          <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-blue-500 rounded-sm border border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center relative">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/50 rounded-full"></div>
            
            {/* Vectors SVG */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <svg width="400" height="200" viewBox="-200 -100 400 200" className="overflow-visible">
                <defs>
                  <marker id="arrow-v" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                  </marker>
                  <marker id="arrow-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                  </marker>
                </defs>
                
                {showVelocity && Math.abs(currentV) > 0.1 && (
                  <g>
                    <line 
                      x1={currentV > 0 ? 3 : -3} 
                      y1={-10} 
                      x2={(currentV > 0 ? 3 : -3) + currentV * 3} 
                      y2={-10} 
                      stroke="#10b981" 
                      strokeWidth="2" 
                      markerEnd="url(#arrow-v)"
                    />
                    <text 
                      x={(currentV > 0 ? 3 : -3) + currentV * 3 + (currentV > 0 ? 10 : -10)} 
                      y={-10} 
                      fill="#10b981" 
                      className="text-[10px] md:text-sm lg:text-base font-bold font-mono"
                      textAnchor={currentV > 0 ? 'start' : 'end'} 
                      dominantBaseline="middle"
                    >
                      v: {currentV.toFixed(2)} m/s
                    </text>
                  </g>
                )}

                {showAcceleration && Math.abs(currentA) > 0.1 && (
                  <g>
                    <line 
                      x1={currentA > 0 ? 3 : -3} 
                      y1={10} 
                      x2={(currentA > 0 ? 3 : -3) + currentA * 3} 
                      y2={10} 
                      stroke="#f59e0b" 
                      strokeWidth="2" 
                      markerEnd="url(#arrow-a)"
                    />
                    <text 
                      x={(currentA > 0 ? 3 : -3) + currentA * 3 + (currentA > 0 ? 10 : -10)} 
                      y={10} 
                      fill="#f59e0b" 
                      className="text-[10px] md:text-sm lg:text-base font-bold font-mono"
                      textAnchor={currentA > 0 ? 'start' : 'end'} 
                      dominantBaseline="middle"
                    >
                      a: {currentA.toFixed(2)} m/s²
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
          <span className="text-[10px] md:text-sm lg:text-base font-bold font-mono whitespace-nowrap mt-1">x: {currentX.toFixed(1)} m</span>
        </div>
      </div>
    </div>
  );
});
