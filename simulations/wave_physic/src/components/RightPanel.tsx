import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Eye, Play, Pause, RotateCcw, Flag, Sparkles, Timer } from 'lucide-react';
import { WaveType, WaveMode, ViewOptions, LapRecord } from '../types/wave';

interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  mode: WaveMode;
  type: WaveType;
  viewOptions: ViewOptions;
  onViewOptionsChange: (options: ViewOptions) => void;
  onApplyPreset: (preset: 'sound' | 'water' | 'rope' | 'standing_node') => void;
  isSimRunning: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = React.memo(({
  isOpen,
  onToggle,
  mode,
  type,
  viewOptions,
  onViewOptionsChange,
  onApplyPreset,
  isSimRunning,
}) => {
  // Stopwatch Internal State
  const [syncWithSim, setSyncWithSim] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [laps, setLaps] = useState<LapRecord[]>([]);

  // Stopwatch timer loop
  useEffect(() => {
    let interval: number | null = null;
    if (isRunning) {
      const stepMs = 20; // 50Hz update
      interval = window.setInterval(() => {
        setElapsedTime((prev) => {
          if (syncWithSim && !isSimRunning) return prev;
          return prev + stepMs / 1000;
        });
      }, stepMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isSimRunning, syncWithSim]);

  const handleTogglePlay = () => setIsRunning(!isRunning);
  const handleReset = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setLaps([]);
  };
  const handleLap = () => {
    const lastTime = laps.length > 0 ? laps[0].time : 0;
    const lapTime = Math.max(0, elapsedTime - lastTime);
    const newRecord: LapRecord = {
      id: String(Date.now()),
      lapNumber: laps.length + 1,
      time: elapsedTime,
      lapTime,
    };
    setLaps([newRecord, ...laps]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return {
      mm: String(mins).padStart(2, '0'),
      ss: String(secs).padStart(2, '0'),
      cc: String(hundredths).padStart(2, '0'),
    };
  };

  const { mm, ss, cc } = formatTime(elapsedTime);

  return (
    <aside
      className={`relative h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-l border-slate-800 transition-all duration-300 z-20 shrink-0 ${
        isOpen ? 'w-72 md:w-80' : 'w-0'
      }`}
    >
      {/* Floating Toggle Button anchored on the left edge */}
      <button
        onClick={onToggle}
        className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-28 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-l-lg flex items-center justify-center transition-colors z-30"
        title={isOpen ? '收摺工具面板' : '展開工具面板'}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="absolute -left-1 w-4 h-4" />}
      </button>

      {/* Panel Content (Visible when open) */}
      <div className={`h-full flex flex-col overflow-y-auto p-4 space-y-4 text-xs ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-100 text-sm">觀測設定</span>
          </div>
          <button
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="收摺面板"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: 視覺標示開關 (Simplified check list) */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
          <label className="text-slate-400 font-medium block">顯示</label>
          <div className="grid grid-cols-2 gap-2">
            {/* 隱藏白珠 */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={viewOptions.hideWhiteBeads}
                onChange={(e) => onViewOptionsChange({ ...viewOptions, hideWhiteBeads: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className={viewOptions.hideWhiteBeads ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                觀察粒子
              </span>
            </label>

            {/* 顯示波長 */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={viewOptions.showWavelength}
                onChange={(e) => onViewOptionsChange({ ...viewOptions, showWavelength: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className={viewOptions.showWavelength ? 'text-sky-300 font-medium' : 'text-slate-300'}>
                標示波長
              </span>
            </label>

            {/* 顯示振幅 */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={viewOptions.showAmplitude}
                onChange={(e) => onViewOptionsChange({ ...viewOptions, showAmplitude: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className={viewOptions.showAmplitude ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                標示振幅
              </span>
            </label>

            {/* 顯示軌跡 */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={viewOptions.showTrajectory}
                onChange={(e) => onViewOptionsChange({ ...viewOptions, showTrajectory: e.target.checked })}
                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span className={viewOptions.showTrajectory ? 'text-amber-300 font-medium' : 'text-slate-300'}>
                粒子軌跡
              </span>
            </label>

            {/* 駐波專屬選項 */}
            {mode === 'standing' && (
              <>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={viewOptions.showNodesAndAntinodes}
                    onChange={(e) => onViewOptionsChange({ ...viewOptions, showNodesAndAntinodes: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span className={viewOptions.showNodesAndAntinodes ? 'text-emerald-300 font-medium' : 'text-slate-300'}>
                    節點/腹點
                  </span>
                </label>

                {type === 'transverse' && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewOptions.showComponents}
                      onChange={(e) => onViewOptionsChange({ ...viewOptions, showComponents: e.target.checked })}
                      className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500 cursor-pointer"
                    />
                    <span className={viewOptions.showComponents ? 'text-violet-300 font-medium' : 'text-slate-300'}>
                      入/反射波
                    </span>
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section 2: 快速情境 (Concise tags) */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>情境切換</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => onApplyPreset('rope')}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-center transition-colors font-medium"
              title="繩波橫向振動 (橫波)"
            >
              繩波
            </button>
            <button
              onClick={() => onApplyPreset('sound')}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-center transition-colors font-medium"
              title="聲波疏密傳播 (縱波)"
            >
              聲波
            </button>
            <button
              onClick={() => onApplyPreset('water')}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-center transition-colors font-medium"
              title="水面介質圓周運動 (圓形波)"
            >
              水波
            </button>
            <button
              onClick={() => onApplyPreset('standing_node')}
              className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-center transition-colors font-medium"
              title="駐波節點與腹點"
            >
              駐波
            </button>
          </div>
        </div>

        {/* Section 3: 內嵌物理實驗碼表 */}
        <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-200 font-medium">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>物理碼表</span>
            </div>
            <div className="flex items-center p-0.5 bg-slate-900 rounded border border-slate-800 text-[10px]">
              <button
                onClick={() => setSyncWithSim(true)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  syncWithSim ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400'
                }`}
              >
                同步模擬
              </button>
              <button
                onClick={() => setSyncWithSim(false)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  !syncWithSim ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400'
                }`}
              >
                真實時間
              </button>
            </div>
          </div>

          {/* LCD Digital Clock */}
          <div className="py-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80 text-center font-mono text-3xl font-bold tracking-tight text-amber-400 tabular-nums shadow-inner">
            <span>{mm}</span>
            <span className="text-amber-500/60">:</span>
            <span>{ss}</span>
            <span className="text-base text-amber-300/80">.{cc}</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={handleTogglePlay}
              className={`py-1.5 px-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1 transition-colors ${
                isRunning
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isRunning ? '暫停' : '開始'}</span>
            </button>

            <button
              onClick={handleLap}
              disabled={elapsedTime === 0}
              className="py-1.5 px-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
            >
              <Flag className="w-3 h-3 text-amber-400" />
              <span>計次</span>
            </button>

            <button
              onClick={handleReset}
              className="py-1.5 px-2 rounded-lg font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重置</span>
            </button>
          </div>

          {/* Laps List */}
          {laps.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1 pt-1.5 border-t border-slate-800/80">
              {laps.map((lap) => {
                const t = formatTime(lap.time);
                return (
                  <div
                    key={lap.id}
                    className="flex items-center justify-between px-2 py-0.5 bg-slate-900 rounded font-mono text-[10px]"
                  >
                    <span className="text-slate-400">#{lap.lapNumber}</span>
                    <span className="text-slate-300">+{lap.lapTime.toFixed(2)}s</span>
                    <span className="text-amber-300 font-semibold">
                      {t.mm}:{t.ss}.{t.cc}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
});

