import React, { memo } from 'react';
import { ELEMENTS } from '../constants';

interface PeriodicTableMapProps {
  z: number;
  onSelectZ?: (z: number) => void;
}

const getGridPosition = (n: number) => {
  // Row 1: H(1), He(2)
  if (n === 1) return { r: 1, c: 1 };
  if (n === 2) return { r: 1, c: 18 };

  // Row 2: Li(3)-Ne(10)
  if (n >= 3 && n <= 10) return n <= 4 ? { r: 2, c: n - 2 } : { r: 2, c: n + 8 };

  // Row 3: Na(11)-Ar(18)
  if (n >= 11 && n <= 18) return n <= 12 ? { r: 3, c: n - 10 } : { r: 3, c: n };

  // Row 4: K(19)-Kr(36)
  if (n >= 19 && n <= 36) return { r: 4, c: n - 18 };

  // Row 5: Rb(37)-Xe(54)
  if (n >= 37 && n <= 54) return { r: 5, c: n - 36 };

  // Row 6: Cs(55)-Rn(86)
  if (n >= 55 && n <= 56) return { r: 6, c: n - 54 };
  if (n >= 72 && n <= 86) return { r: 6, c: n - 72 + 4 };

  // Row 7: Fr(87)-Og(118)
  if (n >= 87 && n <= 88) return { r: 7, c: n - 86 };
  if (n >= 104 && n <= 118) return { r: 7, c: n - 104 + 4 };

  // Lanthanides (Visual Row 9)
  if (n >= 57 && n <= 71) return { r: 9, c: n - 57 + 3 };

  // Actinides (Visual Row 10)
  if (n >= 89 && n <= 103) return { r: 10, c: n - 89 + 3 };

  return { r: 0, c: 0 };
};

const CELL_SIZE = 9.2;
const GAP = 4.6;
const TOTAL_STEP = CELL_SIZE + GAP;
const VIEW_WIDTH = 18 * TOTAL_STEP - GAP;
const VIEW_HEIGHT = 10 * TOTAL_STEP - GAP;

// Precompute static layout once for all 118 elements
const PERIODIC_CELLS = Array.from({ length: 118 }, (_, i) => {
  const atomicNum = i + 1;
  const { r, c } = getGridPosition(atomicNum);
  const element = ELEMENTS[i];
  return {
    z: atomicNum,
    symbol: element?.symbol || '',
    name: element?.chineseName || '',
    x: (c - 1) * TOTAL_STEP,
    y: (r - 1) * TOTAL_STEP,
  };
});

const PeriodicTableMap: React.FC<PeriodicTableMapProps> = ({ z, onSelectZ }) => {
  return (
    <div className="absolute bottom-6 left-6 z-10 select-none">
      <div className="w-[38vw] max-w-[360px] bg-slate-900/60 p-2 rounded-xl backdrop-blur-sm border border-slate-800/80 shadow-lg transition-all hover:bg-slate-900/80 hover:border-slate-700">
        <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
          <span className="tracking-wide">週期表導航</span>
          <span className="font-mono text-sky-400 text-[10px]">點擊任一元素切換</span>
        </div>
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-auto overflow-visible cursor-pointer"
        >
          {PERIODIC_CELLS.map((cell) => {
            const isSelected = cell.z === z;
            return (
              <g
                key={cell.z}
                onClick={() => onSelectZ?.(cell.z)}
                className="group"
              >
                <title>{`${cell.z}. ${cell.symbol} - ${cell.name}`}</title>
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={1.5}
                  className={`transition-colors duration-200 cursor-pointer ${
                    isSelected
                      ? 'fill-amber-400 stroke-amber-200 stroke-[0.8] filter drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
                      : 'fill-slate-700/70 hover:fill-sky-400/80 hover:stroke-sky-300'
                  }`}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default memo(PeriodicTableMap);
