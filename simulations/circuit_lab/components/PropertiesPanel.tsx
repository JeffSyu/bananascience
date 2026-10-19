
import React from 'react';
import { Component, Connection, ViewMode, Port } from '../types';
import { RotateCw, Trash2, Layers, Battery, Activity, Lightbulb, ToggleLeft, Gauge, CircuitBoard, GripHorizontal, Plus, Minus, ArrowDownToLine, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_AMMETER_RANGE, DEFAULT_VOLTMETER_RANGE } from '../constants';

interface PropertiesPanelProps {
  selectedComponents: Component[];
  selectedConnections: Connection[];
  onUpdate: (idOrIds: string | string[], updates: Partial<Component['properties']>) => void;
  onDelete: (ids: string[]) => void;
  onRotate: (ids: string[]) => void;
  viewMode: ViewMode;
  simulationResults: {
      nodeVoltages: Record<string, number>;
      componentCurrents: Record<string, number>;
      connectionCurrents: Record<string, number>;
  };
  getPorts: (c: Component) => Port[];
  isOpen: boolean;
  onToggle: () => void;
}

const getIconForType = (type: string) => {
    switch (type) {
        case 'battery': return <Battery size={14} />;
        case 'resistor': return <Activity size={14} />;
        case 'bulb': return <Lightbulb size={14} />;
        case 'switch': return <ToggleLeft size={14} />;
        case 'voltmeter': return <Gauge size={14} />;
        case 'ammeter': return <CircuitBoard size={14} />;
        case 'connector': return <GripHorizontal size={14} />;
        case 'ground': return <ArrowDownToLine size={14} />;
        default: return null;
    }
};

const getTypeName = (type: string) => {
    switch (type) {
        case 'battery': return '電池';
        case 'resistor': return '電阻';
        case 'bulb': return '燈泡';
        case 'switch': return '開關';
        case 'voltmeter': return '伏特計';
        case 'ammeter': return '安培計';
        case 'connector': return '連接器';
        case 'ground': return '接地';
        case 'wire': return '導線';
        default: return type;
    }
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  selectedComponents, 
  selectedConnections,
  onUpdate,
  onDelete,
  onRotate,
  viewMode,
  simulationResults,
  getPorts,
  isOpen,
  onToggle
}) => {
  const totalSelected = selectedComponents.length + selectedConnections.length;

  // Helper to calculate statistics for a single component
  const getComponentStats = (comp: Component) => {
      const current = simulationResults.componentCurrents[comp.id] || 0;
      let voltageDrop = 0;
      
      const ports = getPorts(comp);
      if (ports.length >= 2) {
          // Calculate max voltage diff among ports (usually just 2 ports)
          // Simple difference between first two ports
          const v1 = simulationResults.nodeVoltages[ports[0].id] || 0;
          const v2 = simulationResults.nodeVoltages[ports[1].id] || 0;
          voltageDrop = Math.abs(v1 - v2);
      }
      
      const power = (comp.type === 'resistor' || comp.type === 'bulb') 
                    ? Math.abs(current * voltageDrop) 
                    : 0;

      return { current, voltageDrop, power };
  };

  // Helper to render live stats block
  const renderLiveStats = (comp: Component) => {
      if (comp.type === 'connector' || comp.type === 'ground') return null;

      const { current, voltageDrop, power } = getComponentStats(comp);

      return (
          <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-100 text-xs">
              <div className="flex justify-between mb-1">
                  <span className="text-gray-500">電流:</span>
                  <span className="font-mono font-bold text-blue-600">{Math.abs(current).toFixed(3)} A</span>
              </div>
              <div className="flex justify-between mb-1">
                  <span className="text-gray-500">電壓:</span>
                  <span className="font-mono font-bold text-green-600">{voltageDrop.toFixed(3)} V</span>
              </div>
              {(comp.type === 'resistor' || comp.type === 'bulb') && (
                  <div className="flex justify-between">
                      <span className="text-gray-500">消耗功率:</span>
                      <span className="font-mono font-bold text-amber-600">{power.toFixed(3)} W</span>
                  </div>
              )}
              {comp.type === 'bulb' && (
                <div className="mt-1 text-[10px] text-center text-gray-400 border-t pt-1 border-gray-200">
                   亮度: {Math.min(100, Math.abs(current) * 100).toFixed(0)}%
                </div>
              )}
          </div>
      );
  };

  // Main Render Content Logic
  const renderContent = () => {
    if (totalSelected === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm text-center p-4">
            <Layers size={32} className="mb-2 opacity-20" />
            <p>未選取任何元件</p>
            <p className="text-xs mt-2 opacity-60">使用「選取工具」點擊畫面上的元件進行移動和編輯，或點擊上方「幫助」查看操作說明。</p>
        </div>
      );
    }

    // --- Multi-Selection View ---
    if (totalSelected > 1) {
        const allIds = [...selectedComponents.map(c => c.id), ...selectedConnections.map(c => c.id)];
        return (
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex-shrink-0 bg-gray-50">
                    <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs flex items-center gap-2">
                        <Layers size={14} />
                        已選取 {totalSelected} 個項目
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
                    {selectedComponents.map(comp => {
                        const isResistive = comp.type === 'resistor' || comp.type === 'bulb';
                        return (
                            <div key={comp.id} className="border border-gray-200 rounded-lg p-3 shadow-sm bg-white">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-1">
                                    <span className="text-gray-400">{getIconForType(comp.type)}</span>
                                    <span>{getTypeName(comp.type)}</span>
                                </div>
                                
                                <div className="space-y-2">
                                    {comp.type === 'battery' && (
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">電壓 (Voltage)</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={comp.properties.voltage}
                                                    onChange={(e) => onUpdate(comp.id, { voltage: parseFloat(e.target.value) })}
                                                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                    step="0.5"
                                                />
                                                <span className="text-xs text-gray-400">V</span>
                                            </div>
                                        </div>
                                    )}

                                    {isResistive && (
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">電阻 (Resistance)</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={comp.properties.resistance}
                                                    onChange={(e) => onUpdate(comp.id, { resistance: parseFloat(e.target.value) })}
                                                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                    min="0.1"
                                                    step="1"
                                                />
                                                <span className="text-xs text-gray-400">Ω</span>
                                            </div>
                                        </div>
                                    )}

                                    {comp.type === 'switch' && (
                                        <label className="flex items-center space-x-2 cursor-pointer select-none border rounded p-1 hover:bg-gray-50">
                                            <input 
                                                type="checkbox"
                                                checked={comp.properties.isOn}
                                                onChange={(e) => onUpdate(comp.id, { isOn: e.target.checked })}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-xs font-medium text-gray-700">{comp.properties.isOn ? '通路 (開啟)' : '斷路 (關閉)'}</span>
                                        </label>
                                    )}

                                    {comp.type === 'ground' && (
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">偏壓 (Bias)</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={comp.properties.bias}
                                                    onChange={(e) => onUpdate(comp.id, { bias: parseFloat(e.target.value) })}
                                                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                    step="0.5"
                                                />
                                                <span className="text-xs text-gray-400">V</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Render live stats in multi-view */}
                                {renderLiveStats(comp)}
                            </div>
                        );
                    })}

                    {selectedConnections.length > 0 && (
                        <div className="border border-gray-200 rounded-lg p-2 bg-white text-center shadow-sm">
                            <span className="text-xs text-gray-500 font-medium">
                                + 已選取 {selectedConnections.length} 條導線
                            </span>
                        </div>
                    )}
                    
                    {selectedComponents.length === 0 && selectedConnections.length > 0 && (
                        <div className="text-xs text-gray-400 text-center italic mt-10">
                            導線無可編輯屬性。
                        </div>
                    )}
                </div>

                {viewMode === '2d' && (
                <div className="p-4 border-t bg-white flex-shrink-0 flex flex-col gap-2 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => onRotate(selectedComponents.map(c => c.id))}
                        className="w-full bg-blue-50 text-blue-700 px-3 py-2 rounded text-xs hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 border border-blue-100 font-medium"
                        title="群組旋轉 90°"
                    >
                        <RotateCw size={14} />
                        群組旋轉
                    </button>
                    <button
                        onClick={() => onDelete(allIds)}
                        className="w-full bg-red-50 text-red-600 px-3 py-2 rounded text-xs hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100 font-medium"
                    >
                        <Trash2 size={14} />
                        刪除所選
                    </button>
                </div>
                )}
            </div>
        );
    }

    // --- Single Component View ---
    if (selectedComponents.length === 1) {
        const selectedComponent = selectedComponents[0];
        const { type, properties } = selectedComponent;
        const isResistive = type === 'resistor' || type === 'bulb';

        // Live Readings Calculation
        const { current, voltageDrop, power } = getComponentStats(selectedComponent);

        return (
            <div className="p-4 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    {getIconForType(type)}
                    {getTypeName(type)} 屬性
                </h3>
                <button 
                    onClick={() => onRotate([selectedComponent.id])}
                    className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                    title="旋轉 90°"
                >
                    <RotateCw size={16} />
                </button>
            </div>

            {/* Dynamic Inputs based on type */}
            {type === 'battery' && (
                <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">電壓 (V)</label>
                <input
                    type="number"
                    value={properties.voltage}
                    onChange={(e) => onUpdate(selectedComponent.id, { voltage: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    step="0.5"
                />
                </div>
            )}

            {isResistive && (
                <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">電阻 (Ω)</label>
                <input
                    type="number"
                    value={properties.resistance}
                    onChange={(e) => onUpdate(selectedComponent.id, { resistance: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    min="0.1"
                    step="1"
                />
                </div>
            )}
            
            {type === 'switch' && (
                <div>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input 
                    type="checkbox"
                    checked={properties.isOn}
                    onChange={(e) => onUpdate(selectedComponent.id, { isOn: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">通路 (開啟)</span>
                </label>
                </div>
            )}
            
            {type === 'voltmeter' && (
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">伏特計檔位 (範圍)</label>
                    <select
                        value={properties.voltmeterRange || DEFAULT_VOLTMETER_RANGE}
                        onChange={(e) => onUpdate(selectedComponent.id, { voltmeterRange: parseFloat(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="3">3 V</option>
                        <option value="10">10 V</option>
                        <option value="30">30 V</option>
                    </select>
                </div>
            )}

            {type === 'ammeter' && (
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">安培計檔位 (範圍)</label>
                    <select
                        value={properties.ammeterRange || DEFAULT_AMMETER_RANGE}
                        onChange={(e) => onUpdate(selectedComponent.id, { ammeterRange: parseFloat(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="0.1">100 mA (0.1 A)</option>
                        <option value="1">1 A</option>
                        <option value="10">10 A</option>
                    </select>
                </div>
            )}

            {type === 'ground' && (
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">偏壓 (Bias) (V)</label>
                    <input
                        type="number"
                        value={properties.bias}
                        onChange={(e) => onUpdate(selectedComponent.id, { bias: parseFloat(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        step="0.5"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        設定接地點的絕對電位。預設為 0V。
                    </p>
                </div>
            )}

            {type === 'connector' && (
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">連接點數量</label>
                    <div className="flex items-center justify-between border rounded p-1 bg-gray-50">
                        <button 
                            onClick={() => {
                                if ((properties.portsCount || 0) > 3) {
                                    onUpdate(selectedComponent.id, { portsCount: (properties.portsCount || 3) - 1 });
                                }
                            }}
                            disabled={(properties.portsCount || 0) <= 3}
                            className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 transition-all text-gray-600"
                        >
                            <Minus size={14} />
                        </button>
                        <span className="font-mono font-bold text-sm text-gray-800">{properties.portsCount}</span>
                        <button 
                            onClick={() => onUpdate(selectedComponent.id, { portsCount: (properties.portsCount || 3) + 1 })}
                            className="p-1 hover:bg-white rounded shadow-sm transition-all text-gray-600"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                        最少 3 個連接點。減少數量會自動斷開連接的導線。
                    </p>
                </div>
            )}

            {/* Live Readings */}
            {type !== 'connector' && type !== 'ground' && (
                <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">即時模擬數據</h4>
                    <div className="flex justify-between text-sm mb-1">
                    <span>電流:</span>
                    <span className="font-mono font-bold text-blue-600">
                        {Math.abs(current).toFixed(3)} A
                    </span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                        <span>電壓:</span>
                        <span className="font-mono font-bold text-green-600">
                            {voltageDrop.toFixed(3)} V
                        </span>
                    </div>
                    
                    {(type === 'bulb' || type === 'resistor') && (
                        <div className="flex justify-between text-sm mb-1">
                            <span>消耗功率:</span>
                            <span className="font-mono font-bold text-amber-600">
                                {power.toFixed(3)} W
                            </span>
                        </div>
                    )}
                    
                    {type === 'bulb' && (
                        <div className="mt-2 text-xs text-center text-gray-400 border-t pt-2 border-gray-200">
                            亮度: {Math.min(100, Math.abs(current) * 100).toFixed(0)}%
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={() => onDelete([selectedComponent.id])}
                className="mt-auto bg-red-50 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <Trash2 size={16} />
                刪除元件
            </button>
            </div>
        );
    }

    // --- Single/Multi Wire View (Fallback) ---
    return (
        <div className="p-4 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">
                    導線屬性
                </h3>
            </div>
            <p className="text-xs text-gray-500">在此模擬中，導線的電阻極小 (預設 0.003Ω)。</p>
            
            {selectedConnections.length > 0 && (
                <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">即時模擬數據</h4>
                    {selectedConnections.map((conn, idx) => {
                        const current = simulationResults.connectionCurrents[conn.id] || 0;
                        return (
                            <div key={conn.id} className="flex justify-between text-sm mb-1 border-b border-gray-200 last:border-0 pb-1 last:pb-0">
                                <span>電流 {selectedConnections.length > 1 ? `(#${idx+1})` : ''}:</span>
                                <span className="font-mono font-bold text-blue-600">
                                    {Math.abs(current).toFixed(3)} A
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <button
                onClick={() => onDelete(selectedConnections.map(c => c.id))}
                className="mt-auto bg-red-50 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <Trash2 size={16} />
                刪除導線
            </button>
        </div>
    );
  };

  return (
    <div className={`bg-white border-l border-gray-200 relative transition-all duration-300 ease-in-out z-40 ${isOpen ? 'w-64' : 'w-0'}`}>
      {/* Toggle Button - positioned outside on the left edge */}
      <button 
        onClick={onToggle}
        className="absolute -left-6 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-l-md p-1 shadow-sm text-gray-500 hover:text-blue-600 hover:bg-gray-50 z-20"
        title={isOpen ? "收合面板" : "展開面板"}
      >
        {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Content Container - overflow hidden prevents content from spilling when width is 0 */}
      <div className={`h-full overflow-hidden ${!isOpen ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200 delay-100`}>
         <div className="h-full w-64"> {/* Fixed width container to prevent layout shifts inside */}
            {renderContent()}
         </div>
      </div>
    </div>
  );
};
