import React from 'react';
import { X, BookOpen, Lightbulb, CheckCircle2 } from 'lucide-react';

interface WaveExplainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WaveExplainer: React.FC<WaveExplainerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">波動物理學習指南</h2>
              <p className="text-xs text-slate-400">Wave Physics Laboratory Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: 三大波形解析 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <span>01.</span> 波形種類與介質振動方式
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="font-bold text-white text-sm mb-1 text-sky-300">縱波 (Longitudinal)</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                介質粒子振動方向與波的行進方向<strong>平行</strong>。形成交替的「密部」與「疏部」。例如：空氣中的聲波。
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="font-bold text-white text-sm mb-1 text-amber-300">橫波 (Transverse)</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                介質粒子振動方向與波的行進方向<strong>垂直</strong>。形成「波峰」與「波谷」。例如：繩波。而依靠電磁場傳遞的電磁波也屬於一種橫波。
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <div className="font-bold text-white text-sm mb-1 text-emerald-300">圓形波 (Surface Wave)</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                結合縱波與橫波特性。波向右傳遞時，表面介質粒子在原地進行<strong>順時針圓周運動</strong>：波峰向前時、波谷向後，粒子在波峰匯聚形成尖銳波峰、波谷平緩開闊，粒子在原地打轉不隨波前進。
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: 單珠聚焦與同相位波長實驗的核心啟發 */}
        <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2.5">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>動手操作看看</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            1. <strong>粒子怎麼動？</strong> 開啟「標示波長」，聚焦在單一排或是一個粒子的振動方式，更深刻的體會到粒子不隨著波動向前的重要物理概念。
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            2. <strong>一個波多長？</strong> 開啟「標示波長」，可以看到兩個或兩組粒子，也就是<strong>同相位</strong>(同為波峰/谷)的粒子。開啟「觀察粒子」後，可以更清楚看到它們的同步運動!!
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            3. <strong>一個週期發生什麼？</strong> 使用「物理碼表」測量粒子往返振動一次所需要的時間，並測量兩個波峰/密部通過同一個粒子所花的時間。看看這測量到的這兩組時間有什麼關係？
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            4. <strong>頻率與波速的影響</strong> 波源振動快慢決定波的「頻率」、介質的性質則決定「波速」。試試看固定波源或是介質其中一項變因，看看有什麼變化？
          </p>
        </div>

        {/* Section 3: 行進波 vs 駐波 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <span>02.</span> 行進波 vs 駐波
          </h3>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">行進波 (Traveling Wave)：</strong>波形持續朝單一方向推進，能量能夠向前傳遞。
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">駐波 (Standing Wave)：</strong>由兩列振幅、頻率相同但傳播方向相反的波疊加而成。波形在空間中不推進，形成振幅為零的<strong>「節點 (Nodes)」</strong>與振動最大的<strong>「腹點 (Antinodes)」</strong>。相鄰節點間距剛好為半個波長（λ/2）。
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: 波動核心公式 */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-white">波動基本物理公式</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            <div className="p-2.5 bg-slate-950 rounded-lg text-center border border-slate-800">
              <div className="text-slate-400 text-[10px]">波速公式</div>
              <div className="text-amber-400 font-bold mt-0.5">v = f · λ = λ / T</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg text-center border border-slate-800">
              <div className="text-slate-400 text-[10px]">週期與頻率</div>
              <div className="text-emerald-400 font-bold mt-0.5">T = 1 / f</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg text-center border border-slate-800">
              <div className="text-slate-400 text-[10px]">角頻率</div>
              <div className="text-sky-400 font-bold mt-0.5">ω = 2π f</div>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg text-center border border-slate-800">
              <div className="text-slate-400 text-[10px]">波數</div>
              <div className="text-violet-400 font-bold mt-0.5">k = 2π / λ</div>
            </div>
          </div>
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
          >
            了解，開始實驗
          </button>
        </div>
      </div>
    </div>
  );
};
