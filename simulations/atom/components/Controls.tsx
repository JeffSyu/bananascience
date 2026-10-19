import React, { ChangeEvent, useState, memo } from 'react';
import { ELEMENTS } from '../constants';

interface ControlsProps {
  z: number;
  setZ: (z: number) => void;
  showSpin: boolean;
  setShowSpin: (s: boolean | ((prev: boolean) => boolean)) => void;
}

const Controls: React.FC<ControlsProps> = ({ z, setZ, showSpin, setShowSpin }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchError, setSearchError] = useState(false);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    setZ(parseInt(e.target.value, 10));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    if (val < 1) val = 1;
    if (val > 118) val = 118;
    setZ(val);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim().toLowerCase();
    if (!term) return;

    // Direct atomic number matching
    const parsedNum = parseInt(term, 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 118) {
      setZ(parsedNum);
      setSearchTerm("");
      setSearchError(false);
      return;
    }
    
    // Name and symbol matching
    const match = 
      ELEMENTS.find(el => el.symbol.toLowerCase() === term) ||
      ELEMENTS.find(el => el.chineseName === term) ||
      ELEMENTS.find(el => el.name.toLowerCase() === term) ||
      ELEMENTS.find(el => el.symbol.toLowerCase().startsWith(term)) ||
      ELEMENTS.find(el => el.chineseName.startsWith(term)) ||
      ELEMENTS.find(el => el.name.toLowerCase().startsWith(term));

    if (match) {
      setZ(match.z);
      setSearchTerm("");
      setSearchError(false);
    } else {
      setSearchError(true);
      setTimeout(() => setSearchError(false), 800);
    }
  };

  const increment = () => setZ(Math.min(118, z + 1));
  const decrement = () => setZ(Math.max(1, z - 1));

  const currentElement = ELEMENTS[z - 1] || ELEMENTS[0];

  return (
    <div className="relative bg-slate-800/95 backdrop-blur-md transition-all duration-300">
      {/* Collapse/Expand Handle */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 px-7 bg-slate-800 border-t border-x border-slate-700 rounded-t-xl text-slate-400 hover:text-sky-400 hover:bg-slate-750 flex items-center justify-center transition-colors shadow-lg z-50 focus:outline-none"
        aria-label={isExpanded ? "收起控制列" : "展開控制列"}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Main Controls Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-3 sm:p-4 lg:p-5 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
          
          {/* Atomic Number Slider Control */}
          <div className="flex-1 w-full flex flex-col gap-1.5 md:gap-2">
            <div className="flex justify-between items-center text-slate-300 text-sm font-semibold">
              <label htmlFor="z-slider" className="flex items-center gap-2 cursor-pointer">
                <span>原子序 (Atomic Number)</span>
              </label>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-sky-400 text-base font-bold">Z = {z}</span>
                <span className="text-xs text-slate-400">({currentElement.symbol} - {currentElement.chineseName})</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={decrement}
                disabled={z <= 1}
                className="w-9 h-9 rounded-full flex shrink-0 items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors border border-slate-600 shadow-sm"
                aria-label="減小原子序"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              
              <input
                id="z-slider"
                type="range"
                min="1"
                max="118"
                value={z}
                onChange={handleSliderChange}
                className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 touch-none"
              />
              
              <button 
                onClick={increment}
                disabled={z >= 118}
                className="w-9 h-9 rounded-full flex shrink-0 items-center justify-center bg-slate-700 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors border border-slate-600 shadow-sm"
                aria-label="增加原子序"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Manual Input, Spin Toggle & Search */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto">
             
            {/* Spin Toggle Button */}
            <div className="relative group shrink-0">
              <button
                onClick={() => setShowSpin(prev => !prev)}
                className={`
                  relative flex items-center gap-2 px-3 h-9 rounded-lg border transition-all text-xs font-medium whitespace-nowrap shadow-sm
                  ${showSpin 
                    ? 'bg-sky-950/70 border-sky-400 text-sky-300 ring-1 ring-sky-400/40' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}
                `}
                aria-pressed={showSpin}
              >
                <span className={`w-2 h-2 rounded-full ${showSpin ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' : 'bg-slate-500'}`}></span>
                <span>自旋顯示：{showSpin ? '開啟' : '關閉'}</span>
              </button>
            </div>

            {/* Jump to Z Input */}
            <div className="relative group shrink-0">
              <div className="relative flex items-center bg-slate-900 rounded-lg border border-slate-700 h-9 px-2 shadow-sm">
                <span className="text-slate-400 text-xs font-medium mr-1.5 select-none">Z:</span>
                <input
                  type="number"
                  min="1"
                  max="118"
                  value={z}
                  onChange={handleInputChange}
                  className="w-10 sm:w-12 h-full bg-transparent text-white font-mono focus:outline-none text-center text-xs sm:text-sm font-semibold"
                  aria-label="輸入指定原子序"
                />
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative group grow md:grow-0 w-full md:w-auto min-w-[120px] mb-0">
              <div className={`relative flex items-center bg-slate-900 rounded-lg border transition-colors h-9 shadow-sm ${
                searchError ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-700 focus-within:border-sky-500'
              }`}>
                <button type="submit" className="pl-2.5 pr-1.5 text-slate-400 hover:text-white transition-colors h-full flex items-center" aria-label="搜尋">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="搜尋 (名稱/符號/Z)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-36 h-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-xs font-medium rounded-r-lg pr-2"
                  autoComplete="off"
                />
              </div>
            </form>
            
            {/* Quick summary for desktop */}
            <div className="hidden xl:block text-right min-w-[100px]">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">當前選擇</div>
              <div className="font-bold text-white text-xs truncate max-w-[130px]">{currentElement.chineseName} ({currentElement.name})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Controls);