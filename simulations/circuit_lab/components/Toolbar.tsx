import React from 'react';
import { ComponentType } from '../types';
import { Lightbulb, Battery, ToggleLeft, Activity, MousePointer2, Undo, Scissors, GripHorizontal, Trash2, Cable } from 'lucide-react';

interface ToolbarProps {
  activeTool: ComponentType | 'select' | 'scissors';
  onSelectTool: (tool: ComponentType | 'select' | 'scissors') => void;
  onClear: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

// Custom Icons modified to accept className for responsive sizing instead of fixed size prop
interface IconProps {
  className?: string;
}

const VoltmeterIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 9l3 6 3-6" />
  </svg>
);

const AmmeterIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7l3 9" />
    <path d="M9 16l3-9" />
    <path d="M10 13h4" />
  </svg>
);

const GroundIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4v10" />
    <path d="M4 14h16" />
    <path d="M7 18h10" />
    <path d="M10 22h4" />
  </svg>
);

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool, onClear, onUndo, canUndo }) => {
  // Common responsive icon class: w-4 (16px) on mobile, w-5 (20px) on md
  const iconClass = "w-4 h-4 md:w-5 md:h-5";

  const tools = [
    { id: 'select', icon: MousePointer2, label: '選取' },
    { id: 'wire', icon: Cable, label: '接線' }, // Added Wire tool
    { id: 'scissors', icon: Scissors, label: '剪刀' },
    { id: 'battery', icon: Battery, label: '電池' },
    { id: 'resistor', icon: Activity, label: '電阻' },
    { id: 'bulb', icon: Lightbulb, label: '燈泡' },
    { id: 'switch', icon: ToggleLeft, label: '開關' },
    { id: 'connector', icon: GripHorizontal, label: '連接器' },
    { id: 'voltmeter', icon: VoltmeterIcon, label: '伏特計', isCustom: true },
    { id: 'ammeter', icon: AmmeterIcon, label: '安培計', isCustom: true },
    { id: 'ground', icon: GroundIcon, label: '接地', isCustom: true },
  ];

  return (
    <div className="w-12 md:w-20 bg-white border-r border-gray-200 flex flex-col items-center py-2 md:py-4 gap-1 md:gap-2 shadow-sm z-10 overflow-y-auto overflow-x-hidden flex-shrink-0 transition-all duration-300">
      
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelectTool(tool.id as any)}
          className={`
            w-8 h-8 md:w-12 md:h-12 flex-shrink-0 rounded-lg flex flex-col items-center justify-center text-xs gap-1 transition-all
            ${activeTool === tool.id 
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' 
              : 'hover:bg-gray-100 text-gray-600 border border-transparent'}
          `}
          title={tool.label}
        >
          {/* Render icon with responsive className */}
          {tool.isCustom ? (
             // @ts-ignore
             <tool.icon className={iconClass} />
          ) : (
             // @ts-ignore
             <tool.icon className={iconClass} />
          )}
          <span className="text-[9px] font-medium hidden md:block">{tool.label}</span>
        </button>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2 md:gap-3 mb-2 w-full px-1">
          <div className="w-full h-px bg-gray-200" />
          
          <button 
            onClick={onUndo}
            disabled={!canUndo}
            className={`
               w-8 h-8 md:w-auto md:h-auto md:p-2 rounded-full transition-colors flex flex-col items-center justify-center
               ${canUndo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}
            `}
            title="復原 (Ctrl+Z)"
          >
            <Undo className={iconClass} />
            <span className="text-[10px] hidden md:block">復原</span>
          </button>

          <button 
            onClick={onClear}
            className="w-8 h-8 md:w-auto md:h-auto md:p-2 rounded-full transition-colors flex flex-col items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700"
            title="全部清除"
          >
            <Trash2 className={iconClass} />
            <span className="text-[10px] hidden md:block">清空</span>
          </button>
      </div>
    </div>
  );
};