import React from 'react';
import { WaveParams, WaveMode } from '../types/wave';
import { calculateMetrics } from '../utils/physics';

interface BottomMetricsStripProps {
  params: WaveParams;
  mode: WaveMode;
}

export const BottomMetricsStrip: React.FC<BottomMetricsStripProps> = React.memo(({ params, mode }) => {
  const metrics = calculateMetrics(params);

  return (
    <div className="h-11 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-300 font-mono shrink-0 select-none overflow-x-auto gap-4">
      <div className="flex items-center gap-4 md:gap-8 shrink-0">
        {/* 波長 λ */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">波長 λ:</span>
          <span className="text-sky-300 font-bold tabular-nums">
            {metrics.wavelength.toFixed(2)} m
          </span>
        </div>

        {/* 週期 T */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">週期 T:</span>
          <span className="text-emerald-300 font-bold tabular-nums">
            {metrics.period.toFixed(3)} s
          </span>
        </div>

        {/* 頻率 f */}
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="text-slate-500">頻率 f:</span>
          <span className="text-cyan-300 font-bold tabular-nums">
            {params.frequency.toFixed(2)} Hz
          </span>
        </div>

        {/* 角頻率 ω */}
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="text-slate-500">角頻率 ω:</span>
          <span className="text-amber-300 font-bold tabular-nums">
            {metrics.angularFreq.toFixed(2)} rad/s
          </span>
        </div>


        {/* 波數 k */}
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="text-slate-500">波數 k:</span>
          <span className="text-violet-300 font-bold tabular-nums">
            {metrics.waveNumber.toFixed(2)} rad/m
          </span>
        </div>

        {/* 駐波節點間距 */}
        {mode === 'standing' && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">節點距 (λ/2):</span>
            <span className="text-rose-300 font-bold tabular-nums">
              {(metrics.wavelength / 2).toFixed(2)} m
            </span>
          </div>
        )}
      </div>

      {/* Physics Fundamental Equation */}
      <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 font-semibold">
          v = f · λ = {params.waveSpeed.toFixed(1)} m/s
        </span>
      </div>
    </div>
  );
});

