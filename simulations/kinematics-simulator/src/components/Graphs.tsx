import React, { useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot
} from 'recharts';
import { SimulationData } from '../types';
import { findNearestDataPoint, findNearestIndex } from '../utils/physics';

interface GraphsProps {
  data: SimulationData[];
  currentTime: number;
  maxTime: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-lg">
        <p className="text-sm text-slate-400 font-mono mb-1">t = {label?.toFixed(2)}s</p>
        <p className="text-base font-mono text-white">
          <span style={{color: payload[0].color}}>{payload[0].name}: </span>
          {payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const calculateArea = (data: SimulationData[], key: 'x'|'v'|'a', t1: number, t2: number) => {
  const start = Math.min(t1, t2);
  const end = Math.max(t1, t2);
  const pStart = findNearestDataPoint(data, start);
  const pEnd = findNearestDataPoint(data, end);
  if (!pStart || !pEnd) return 0;
  
  if (key === 'v') return pEnd.x - pStart.x;
  if (key === 'a') return pEnd.v - pStart.v;

  let area = 0;
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i].t >= start && data[i].t < end) {
      area += (data[i][key] + data[i+1][key]) / 2 * (data[i+1].t - data[i].t);
    }
  }
  return area;
};

const getSlope = (data: SimulationData[], t: number, key: 'x'|'v'|'a') => {
  const idx = findNearestIndex(data, t);
  if (idx === -1) return 0;
  if (key === 'x') return data[idx].v;
  if (key === 'v') return data[idx].a;
  if (key === 'a') {
    const p1 = data[Math.max(0, idx - 1)];
    const p2 = data[Math.min(data.length - 1, idx + 1)];
    if (p1.t === p2.t) return 0;
    return (p2.a - p1.a) / (p2.t - p1.t);
  }
  return 0;
};

type GraphType = 'x' | 'v' | 'a';
interface InteractionState {
  type: 'none' | 'click' | 'selecting' | 'selected';
  activeGraph: GraphType | null;
  t1: number | null;
  t2: number | null;
}

interface GraphCardProps {
  data: SimulationData[];
  currentTime: number;
  maxTime: number;
  dataKey: GraphType;
  title: string;
  color: string;
  unit: string;
  interaction: InteractionState;
  setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
}

const GraphCard = ({ data, currentTime, maxTime, dataKey, title, color, unit, interaction, setInteraction }: GraphCardProps) => {
  const lastTouchStartRef = useRef<{ time: number; label: number | null; x: number; y: number } | null>(null);
  const isDoubleTapRef = useRef<boolean>(false);
  const touchHandledRef = useRef<number>(0);

  const handleMouseDown = (e: any) => {
    if (Date.now() - touchHandledRef.current < 500) return;
    if (e && e.activeLabel != null) {
      setInteraction({ type: 'selecting', activeGraph: dataKey, t1: e.activeLabel, t2: e.activeLabel });
    } else {
      setInteraction({ type: 'none', activeGraph: null, t1: null, t2: null });
    }
  };
  
  const handleMouseMove = (e: any) => {
    if (Date.now() - touchHandledRef.current < 500) return;
    if (interaction.type === 'selecting' && interaction.activeGraph === dataKey && e && e.activeLabel != null) {
      setInteraction({ ...interaction, t2: e.activeLabel });
    }
  };
  
  const handleMouseUp = () => {
    if (Date.now() - touchHandledRef.current < 500) return;
    if (interaction.type === 'selecting') {
      if (interaction.t1 === interaction.t2) {
        setInteraction({ ...interaction, type: 'click' });
      } else {
        setInteraction({ ...interaction, type: 'selected' });
      }
    }
  };

  const handleTouchStart = (e: any) => {
    touchHandledRef.current = Date.now();
    const now = Date.now();
    const label = e && e.activeLabel != null ? e.activeLabel : null;
    const touch = e.nativeEvent?.touches?.[0] || e.touches?.[0];
    const touchX = touch ? touch.clientX : 0;
    const touchY = touch ? touch.clientY : 0;

    const prevTouch = lastTouchStartRef.current;

    if (
      prevTouch &&
      now - prevTouch.time < 350 &&
      Math.hypot(touchX - prevTouch.x, touchY - prevTouch.y) < 50 &&
      label != null
    ) {
      // It's a double tap
      isDoubleTapRef.current = true;
      lastTouchStartRef.current = null;
      setInteraction({
        type: 'selecting',
        activeGraph: dataKey,
        t1: label,
        t2: label
      });
    } else {
      isDoubleTapRef.current = false;
      lastTouchStartRef.current = { time: now, label, x: touchX, y: touchY };
    }
  };

  const handleTouchMove = (e: any) => {
    touchHandledRef.current = Date.now();
    if (isDoubleTapRef.current && e && e.activeLabel != null) {
      setInteraction(prev => {
        if (prev.type === 'selecting' && prev.activeGraph === dataKey) {
          return { ...prev, t2: e.activeLabel };
        }
        return prev;
      });
    }
  };

  const handleTouchEnd = () => {
    touchHandledRef.current = Date.now();
    if (isDoubleTapRef.current) {
      isDoubleTapRef.current = false;
      setInteraction(prev => {
        if (prev.type === 'selecting' && prev.activeGraph === dataKey) {
          if (prev.t1 === prev.t2 || prev.t1 === null || prev.t2 === null) {
            return { ...prev, type: 'click' };
          } else {
            return { ...prev, type: 'selected' };
          }
        }
        return prev;
      });
    }
  };

  const tStart = interaction.t1 !== null && interaction.t2 !== null ? Math.min(interaction.t1, interaction.t2) : null;
  const tEnd = interaction.t1 !== null && interaction.t2 !== null ? Math.max(interaction.t1, interaction.t2) : null;
  
  const pStart = tStart !== null ? findNearestDataPoint(data, tStart) : null;
  const pEnd = tEnd !== null ? findNearestDataPoint(data, tEnd) : null;

  const isClick = interaction.type === 'click' && tStart !== null;
  const isDrag = (interaction.type === 'selecting' || interaction.type === 'selected') && tStart !== null && tEnd !== null && tStart !== tEnd;
  const isActive = interaction.activeGraph === dataKey;

  // Tangent calculation
  let tangentSegment = null;
  let tangentSlope = 0;
  if (isClick && isActive && pStart) {
    tangentSlope = getSlope(data, tStart, dataKey);
    const dt = 1.5;
    const x1 = Math.max(0, tStart - dt);
    const x2 = Math.min(maxTime, tStart + dt);
    tangentSegment = [
      { x: x1, y: pStart[dataKey] + tangentSlope * (x1 - tStart) },
      { x: x2, y: pStart[dataKey] + tangentSlope * (x2 - tStart) }
    ];
  }

  // Secant & Area calculation
  let secantSegment = null;
  let secantSlope = 0;
  let area = 0;
  if (isDrag && isActive && pStart && pEnd) {
    secantSlope = (pEnd[dataKey] - pStart[dataKey]) / (tEnd - tStart);
    secantSegment = [
      { x: tStart, y: pStart[dataKey] },
      { x: tEnd, y: pEnd[dataKey] }
    ];
    area = calculateArea(data, dataKey, tStart, tEnd);
  }

  return (
    <div className="flex flex-col h-64 md:h-full min-h-[250px] relative select-none">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold" style={{ color }}>{title}</span>
      </div>
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded p-2 relative overflow-hidden touch-none">
        {/* Info Overlay */}
        {(isClick || isDrag) && pStart && (
          <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-700 p-3 rounded shadow-lg text-xs font-mono z-10 pointer-events-none min-w-[140px]">
            {isClick && (
              <>
                <div className="text-white mb-1 border-b border-slate-700 pb-1">t = {tStart.toFixed(2)} s</div>
                <div style={{ color }}>{dataKey} = {pStart[dataKey].toFixed(2)} {unit}</div>
                {isActive && <div className="text-yellow-400 mt-1">斜率 = {tangentSlope.toFixed(2)}</div>}
              </>
            )}
            {isDrag && pEnd && (
              <>
                <div className="text-white mb-1 border-b border-slate-700 pb-1">Δt = {(tEnd - tStart).toFixed(2)} s</div>
                <div style={{ color }}>Δ{dataKey} = {(pEnd[dataKey] - pStart[dataKey]).toFixed(2)} {unit}</div>
                {isActive && (
                  <>
                    <div className="text-yellow-400 mt-1">Δ{dataKey}/Δt = {secantSlope.toFixed(2)}</div>
                    <div className="text-pink-400">面積 = {area.toFixed(2)}</div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                     onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                     onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="t" type="number" domain={[0, maxTime]} stroke="#64748b" fontSize={13} tickCount={6} />
            <YAxis stroke="#64748b" fontSize={13} width={45} />
            <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
            
            <Line type="monotone" dataKey={dataKey} name={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            
            <ReferenceLine 
              x={currentTime} 
              stroke="#ef4444" 
              strokeWidth={1.5} 
              strokeDasharray="3 3"
              label={{
                position: 'insideBottom',
                value: `t=${currentTime.toFixed(2)}s`,
                fill: '#ef4444',
                fontSize: 12,
                fontWeight: 'bold',
                offset: 10
              }}
            />

            {/* Interaction Overlays */}
            {isClick && pStart && (
              <ReferenceDot x={tStart} y={pStart[dataKey]} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
            )}
            {isClick && isActive && tangentSegment && (
              <ReferenceLine segment={tangentSegment} stroke="#facc15" strokeWidth={2} strokeDasharray="4 4" />
            )}
            {isDrag && pStart && pEnd && (
              // @ts-ignore: recharts ReferenceArea fill type definition is missing in some versions
              <ReferenceArea x1={tStart} x2={tEnd} strokeOpacity={0} fillOpacity={0.15} fill={color} />
            )}
            {isDrag && isActive && secantSegment && (
              <ReferenceLine segment={secantSegment} stroke="#facc15" strokeWidth={2} strokeDasharray="4 4" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const Graphs: React.FC<GraphsProps> = React.memo(({ data, currentTime, maxTime }) => {
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'none', activeGraph: null, t1: null, t2: null });

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end h-8 mb-2">
        {interaction.type !== 'none' && (
          <button 
            onClick={() => setInteraction({ type: 'none', activeGraph: null, t1: null, t2: null })}
            className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 transition-colors border border-slate-700"
          >
            清除選取
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 landscape:md:grid-cols-3 gap-4 flex-1">
        <GraphCard data={data} currentTime={currentTime} maxTime={maxTime} dataKey="x" title="位置 (x) vs 時間 (t)" color="#3b82f6" unit="m" interaction={interaction} setInteraction={setInteraction} />
        <GraphCard data={data} currentTime={currentTime} maxTime={maxTime} dataKey="v" title="速度 (v) vs 時間 (t)" color="#10b981" unit="m/s" interaction={interaction} setInteraction={setInteraction} />
        <GraphCard data={data} currentTime={currentTime} maxTime={maxTime} dataKey="a" title="加速度 (a) vs 時間 (t)" color="#f59e0b" unit="m/s²" interaction={interaction} setInteraction={setInteraction} />
      </div>
    </div>
  );
});
