import React, { useState, useMemo, memo } from 'react';
import { ElementData } from '../types';
import { CATEGORY_COLORS, CATEGORY_CHINESE } from '../constants';

interface InfoPanelProps {
  element: ElementData;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ element }) => {
  const [isPropertiesOpen, setPropertiesOpen] = useState(true);
  const color = CATEGORY_COLORS[element.category] || "#94a3b8";
  const categoryCn = CATEGORY_CHINESE[element.category] || element.category;

  // Memoized configuration parser for superscripts (e.g., 2p6 -> 2p⁶)
  const renderedConfig = useMemo(() => {
    return element.config.split(' ').map((part, i) => {
      if (part.startsWith('[')) {
        return <span key={i} className="text-slate-500 mr-2">{part}</span>;
      }
      
      const match = part.match(/^(\d+[spdf])(\d+)$/);
      if (match) {
        return (
          <span key={i} className="mr-2 inline-block">
            {match[1]}<sup className="text-[0.65em] font-semibold">{match[2]}</sup>
          </span>
        );
      }
      
      return <span key={i} className="mr-2 inline-block">{part}</span>;
    });
  }, [element.config]);

  // Memoized ion charge parser (e.g., Fe3+ -> Fe³⁺)
  const renderedIons = useMemo(() => {
    const text = element.commonIons;
    if (text === '-' || !text) return <span className="text-slate-400">-</span>;
    
    const parts = text.split(/,\s*/);
    return parts.map((ion, i) => {
      const match = ion.match(/^(.*?)(\d*[+\-])$/);
      const content = match ? (
        <>
          {match[1]}
          <sup className="text-[0.75em] ml-0.5 font-semibold">{match[2]}</sup>
        </>
      ) : ion;

      return (
        <span key={i}>
          {content}
          {i < parts.length - 1 && <span className="text-slate-500 mr-1.5">,</span>}
        </span>
      );
    });
  }, [element.commonIons]);

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4 overflow-y-auto">
      {/* Header Section */}
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-baseline gap-2">
              {element.chineseName}
              <span className="text-lg sm:text-xl font-normal text-slate-400">{element.name}</span>
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span 
                className="inline-block px-2.5 py-0.5 rounded text-xs font-bold text-slate-900 uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: color }}
              >
                {categoryCn}
              </span>
              <span className="text-xs text-slate-400 font-mono">符號: {element.symbol}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl sm:text-5xl font-black text-slate-700 select-none tracking-tighter">
              {element.z}
            </div>
            <div className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
              質量: {element.mass} u
            </div>
          </div>
        </div>
      </div>

      {/* Configuration & Shell Distribution */}
      <div className="space-y-3">
        <div className="bg-slate-900/60 p-3.5 sm:p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-1.5">
            <h3 className="text-slate-400 text-xs font-semibold tracking-wider">電子組態 Configuration</h3>
            <span className="text-[10px] text-sky-400/80 font-mono">基態</span>
          </div>
          <div className="font-mono text-base sm:text-lg text-sky-300 break-words leading-relaxed">
            {renderedConfig}
          </div>
        </div>

        <div className="bg-slate-900/60 p-3.5 sm:p-4 rounded-xl border border-slate-800 shadow-sm">
          <h3 className="text-slate-400 text-xs font-semibold mb-2.5 tracking-wider">殼層電子分佈 Shell Population</h3>
          <div className="flex flex-wrap gap-2">
            {element.shells.map((count, i) => (
              <div key={i} className="flex flex-col items-center group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-800/80 group-hover:bg-slate-700/80 border border-slate-700 group-hover:border-sky-500/50 text-slate-100 font-bold text-sm transition-all shadow-inner">
                  {count}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  n={i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Section (Collapsible) */}
      <div className="space-y-2 border-t border-slate-800/80 pt-2">
        <button 
          onClick={() => setPropertiesOpen(prev => !prev)}
          className="w-full flex items-center justify-between group focus:outline-none py-1.5 px-1 rounded hover:bg-slate-800/40 transition-colors"
          aria-expanded={isPropertiesOpen}
        >
          <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 group-hover:text-white transition-colors">
            物理與化學性質 Properties
          </span>
          <div className={`p-1 rounded transition-colors duration-200 ${isPropertiesOpen ? 'text-sky-400' : 'text-slate-500'}`}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-4 w-4 transition-transform duration-200 ${isPropertiesOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <div 
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isPropertiesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className="grid grid-cols-2 gap-2.5 pt-1 pb-2">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] tracking-wider text-slate-400 mb-1">原子半徑 Radius</div>
                <div className="text-sm font-semibold text-slate-200">
                  {element.radius} {element.radius !== '-' && 'pm'}
                </div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="text-[11px] tracking-wider text-slate-400 mb-1">電負度 Electronegativity</div>
                <div className="text-sm font-semibold text-slate-200">{element.electronegativity}</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 col-span-2">
                <div className="text-[11px] tracking-wider text-slate-400 mb-1">常見氧化數 Oxidation States</div>
                <div className="text-sm font-semibold text-slate-200 truncate">{element.oxidationStates}</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 col-span-2">
                <div className="text-[11px] tracking-wider text-slate-400 mb-1">常見離子 Common Ions</div>
                <div className="text-sm font-semibold text-slate-200 truncate">{renderedIons}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(InfoPanel);