import React from 'react';
import { Play, Pause, SkipBack, SkipForward, AudioLines, Waves, Disc, ChevronLeft, ChevronRight, Sliders } from 'lucide-react';
import { WaveType, WaveParams } from '../types/wave';

interface LeftPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  type: WaveType;
  onTypeChange: (type: WaveType) => void;
  params: WaveParams;
  onParamsChange: (params: WaveParams) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  highlightIndex: number;
  onHighlightIndexChange: (idx: number) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = React.memo(({
  isOpen,
  onToggle,
  type,
  onTypeChange,
  params,
  onParamsChange,
  isPlaying,
  onTogglePlay,
  onStepBack,
  onStepForward,
  highlightIndex,
  onHighlightIndexChange,
}) => {
  return (
    <aside
      className={`relative h-full flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-800 transition-all duration-300 z-20 shrink-0 ${
        isOpen ? 'w-72 md:w-80' : 'w-0'
      }`}
    >
      {/* Floating Toggle Button anchored on the edge */}
      <button
        onClick={onToggle}
        className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-28 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-r-lg flex items-center justify-center transition-colors z-30"
        title={isOpen ? '收摺控制面板' : '展開控制面板'}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="absolute -right-1 w-4 h-4" />}
      </button>

      {/* Panel Content (Visible when open) */}
      <div className={`h-full flex flex-col overflow-y-auto p-4 space-y-4 text-xs ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-100 text-sm">參數設定</span>
          </div>
          <button
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="收摺面板"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Section 2: 播放傳輸控制 */}
        <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all shadow-sm ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={onStepBack}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
              title="上一微動 [ 鍵"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onStepForward}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
              title="下一微動 ] 鍵"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-500">速度</span>
            <select
              value={params.playbackSpeed}
              onChange={(e) => onParamsChange({ ...params, playbackSpeed: parseFloat(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="0.1">0.1</option>
              <option value="0.25">0.25</option>
              <option value="0.5">0.5</option>
              <option value="1">1.0</option>
              <option value="1.5">1.5</option>
              <option value="2">2.0</option>
            </select>
          </div>
        </div>

        {/* Section 1: 選擇波形 */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onTypeChange('longitudinal')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                type === 'longitudinal'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="縱波 (疏密波)"
            >
              <AudioLines className="w-4 h-4 mb-0.5" />
              <span>縱波</span>
            </button>

            <button
              onClick={() => onTypeChange('transverse')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                type === 'transverse'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="橫波 (高低波)"
            >
              <Waves className="w-4 h-4 mb-0.5" />
              <span>橫波</span>
            </button>

            <button
              onClick={() => onTypeChange('circular')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                type === 'circular'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="深水波 (水表面圓周波)"
            >
              <Disc className="w-4 h-4 mb-0.5" />
              <span>深水波</span>
            </button>
          </div>
        </div>

        {/* Section 3: 參數滑桿 (頻率、波速、振幅) */}
        <div className="space-y-3 pt-1">
          {/* 頻率 */}
          <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">頻率 (f)</span>
              <span className="font-mono text-amber-400 font-semibold tabular-nums">
                {params.frequency.toFixed(2)} Hz
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="6.0"
              step="0.05"
              value={params.frequency}
              onChange={(e) => onParamsChange({ ...params, frequency: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          {/* 波速 */}
          <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">波速 (v)</span>
              <span className="font-mono text-amber-400 font-semibold tabular-nums">
                {params.waveSpeed.toFixed(1)} m/s
              </span>
            </div>
            <input
              type="range"
              min="5.0"
              max="60.0"
              step="1.0"
              value={params.waveSpeed}
              onChange={(e) => onParamsChange({ ...params, waveSpeed: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          {/* 振幅 */}
          <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">振幅 (A)</span>
              <span className="font-mono text-amber-400 font-semibold tabular-nums">
                {params.amplitude.toFixed(2)} m
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.01"
              value={params.amplitude}
              onChange={(e) => onParamsChange({ ...params, amplitude: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          {/* 聚焦質點選擇 */}
          <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">標記粒子</span>
              <span className="font-mono text-slate-300 tabular-nums">
                <strong className="text-amber-400">{highlightIndex}</strong>
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="69"
              step="1"
              value={highlightIndex}
              onChange={(e) => onHighlightIndexChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </aside>
  );
});

