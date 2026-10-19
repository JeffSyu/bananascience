import React from 'react';
import { WaveMode } from '../types/wave';
import { BookOpen, RotateCcw } from 'lucide-react';

const WaveIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="390 265 600 265" className={className}>
    <path d="m 558.82031,268.9707 c -20.92199,0 -37.84213,10.01797 -52.13672,21.58594 -14.29458,11.56798 -26.56698,25.69681 -37.11523,39.49805 -21.09652,27.60247 -35.37891,54.76172 -35.37891,54.76172 a 25,25 0 0 0 -0.25781,0.86523 h -15.45312 a 22.5,22.5 0 0 0 -22.5,22.5 22.5,22.5 0 0 0 22.5,22.5 h 158.86132 a 22.5,22.5 0 0 0 22.5,-22.5 22.5,22.5 0 0 0 -11.11523,-19.40039 c 2.13415,-3.41445 4.4962,-7.09667 7.10156,-10.98242 -3.69198,-5.61745 -7.44564,-11.02613 -11.27344,-15.8086 -11.22714,-14.02732 -21.59804,-19.28801 -24.34374,-20.59961 -16.43062,23.23801 -27.07227,43.42579 -27.07227,43.42579 a 25,25 0 0 0 -0.36523,0.86523 H 491.8418 c 4.9206,-7.74054 10.62061,-16.32858 17.45117,-25.26562 9.04241,-11.831 19.38296,-23.336 28.84375,-30.99219 9.46078,-7.6562 17.43927,-10.45313 20.68359,-10.45313 12.20814,0 27.55106,10.53319 42.68946,29.44727 15.13841,18.91408 28.14244,43.18011 38.18945,60.58203 9.10519,15.77066 23.19824,42.76892 42.45312,66.82617 19.25489,24.05725 45.60208,48.20313 81.72657,48.20313 20.922,0 37.84212,-10.0199 52.13672,-21.58789 14.2946,-11.56798 26.56693,-25.69486 37.11523,-39.4961 21.0965,-27.60247 35.37891,-54.76367 35.37891,-54.76367 a 25,25 0 0 0 -10.41993,-33.78516 25,25 0 0 0 -33.78515,10.41993 c 0,0 -12.81559,24.10361 -30.90039,47.76562 -9.0424,11.831 -19.381,23.33598 -28.8418,30.99219 -9.4608,7.6562 -17.43929,10.45508 -20.68359,10.45508 -12.2081,0 -27.55105,-10.53319 -42.68946,-29.44727 C 706.05105,425.66795 693.047,401.40192 683,384 673.8948,368.22934 659.7998,341.23108 640.54492,317.17383 621.29003,293.11657 594.94479,268.9707 558.82031,268.9707 Z m 98.94727,0 c -10.1329,0 -19.30884,2.38143 -27.7207,6.11914 10.70728,8.95653 19.8438,19.00212 27.45507,28.51172 5.08846,6.35757 9.79291,12.84472 14.14844,19.24024 9.08478,4.62656 18.98115,13.3001 28.80664,25.57617 15.13841,18.91408 28.14245,43.18011 38.18946,60.58203 6.06993,10.51344 14.57015,26.10715 25.125,42.40234 1.78696,-0.91242 4.20304,-2.34317 7.1289,-4.71093 7.20464,-5.8304 16.93063,-16.41639 25.24805,-27.29883 1.22338,-1.60067 2.36522,-3.19791 3.53711,-4.79883 C 793.07513,403.68747 787.1085,392.93952 781.94727,384 772.84207,368.22934 758.74707,341.23108 739.49219,317.17383 720.2373,293.11657 693.89206,268.9707 657.76758,268.9707 Z m 306.65234,102.54492 a 25,25 0 0 0 -21.16797,13.30079 c 0,0 -12.81559,24.10361 -30.90039,47.76562 -9.0424,11.831 -19.38099,23.33598 -28.84179,30.99219 -2.82417,2.28547 -5.43862,4.01568 -7.91211,5.49023 -1.71394,2.35097 -3.39487,4.69418 -5.21094,7.07032 -10.68177,13.97586 -23.40176,28.68413 -38.7832,41.49609 9.49961,4.01241 19.8775,6.39844 31.22265,6.39844 20.922,0 37.84212,-10.0199 52.13672,-21.58789 14.2946,-11.56798 26.56694,-25.69486 37.11524,-39.4961 21.0965,-27.60247 35.3789,-54.76367 35.3789,-54.76367 a 25,25 0 0 0 -10.41992,-33.78516 25,25 0 0 0 -12.61719,-2.88086 z" />
  </svg>
);

interface TopNavProps {
  mode: WaveMode;
  onModeChange: (mode: WaveMode) => void;
  onOpenExplainer: () => void;
  onResetAll: () => void;
}

export const TopNav: React.FC<TopNavProps> = React.memo(({
  mode,
  onModeChange,
  onOpenExplainer,
  onResetAll,
}) => {
  return (
    <header className="h-14 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md shrink-0 z-30 select-none">
      {/* Zone 1: Brand & Left Panel Quick Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow font-bold text-slate-950 text-xs">
            <WaveIcon size={20} className = "fill-slate-100" />
          </div>
          <span className="text-sm md:text-base font-bold text-slate-100 whitespace-nowrap hidden md:inline">
            波動模擬器
          </span>
        </div>
      </div>

      {/* Zone 2: Mode Tabs (Simplified text: 行進波 / 駐波) */}
      <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
        <button
          onClick={() => onModeChange('traveling')}
          className={`px-3 md:px-5 py-1 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
            mode === 'traveling'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          行進波
        </button>
        <button
          onClick={() => onModeChange('standing')}
          className={`px-3 md:px-5 py-1 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap ${
            mode === 'standing'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          駐波
        </button>
      </div>

      {/* Zone 3: Right Panel Quick Toggle & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenExplainer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-all whitespace-nowrap"
          title="波動核心概念與公式說明"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">原理</span>
        </button>

        <button
          onClick={onResetAll}
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition-colors"
          title="重置預設參數"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});

