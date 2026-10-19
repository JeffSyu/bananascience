import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Component, Connection, Port, ComponentType, ViewMode, GlobalSettings } from './types';
import { INITIAL_BATTERY_VOLTAGE, INITIAL_RESISTANCE, INITIAL_BULB_RESISTANCE, INITIAL_CONNECTOR_PORTS, DEFAULT_AMMETER_RANGE, DEFAULT_VOLTMETER_RANGE, INITIAL_GROUND_BIAS, GRID_SIZE, DEFAULT_SETTINGS } from './constants';
import { solveCircuit } from './utils/solver';
import { Play, Square, Box, Layers, Settings, X, Download, Upload, FilePlus, FileOutput, HelpCircle, Mouse, Sliders, MoreVertical } from 'lucide-react';

// Lazy load 3D visualizer to optimize initial bundle parsing and memory footprint
const Circuit3D = React.lazy(() => import('./components/Circuit3D').then(m => ({ default: m.Circuit3D })));

const generateId = () => Math.random().toString(36).substr(2, 9);

interface HistoryState {
  components: Component[];
  connections: Connection[];
}

export interface View3DSettings {
  showPotentials: boolean;
  showCurrents: boolean;
  showValues: boolean; // Resistance and Power
}

// Helper component for Toggle Switch UI
const ToggleOption = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (checked: boolean) => void }) => (
  <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white rounded-lg transition-colors">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <div className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
        className="sr-only peer" 
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </div>
  </label>
);

const App: React.FC = () => {
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  // Use array for multi-selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ComponentType | 'select' | 'scissors'>('select');
  const [isSimulating, setIsSimulating] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(true); // Default open on load
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true); // Control panel visibility
  const [showMobileMenu, setShowMobileMenu] = useState(false); // Dropdown for mobile actions
  
  // New state for 3D view visualization options
  const [view3DSettings, setView3DSettings] = useState<View3DSettings>({
    showPotentials: false,
    showCurrents: true,
    showValues: false,
  });

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('overwrite');

  const [simulationResults, setSimulationResults] = useState<{
    nodeVoltages: Record<string, number>;
    componentCurrents: Record<string, number>;
    connectionCurrents: Record<string, number>;
  }>({ nodeVoltages: {}, componentCurrents: {}, connectionCurrents: {} });

  const saveToHistory = useCallback((newComponents: Component[], newConnections: Connection[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, { components: newComponents, connections: newConnections }];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setComponents(prevState.components);
      setConnections(prevState.connections);
      setHistoryIndex(historyIndex - 1);
      setSelectedIds([]);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    if (history.length === 0) {
      saveToHistory([], []);
    }
  }, []);

  // Auto-deselect when switching to Wire or Scissors tool
  useEffect(() => {
    if (activeTool === 'wire' || activeTool === 'scissors') {
        setSelectedIds([]);
    }
  }, [activeTool]);

  const getPorts = useCallback((c: Component): Port[] => {
    const cx = 40;
    const cy = 0;
    const rad = (c.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatePoint = (x: number, y: number) => ({
      offsetX: (x - cx) * cos - (y - cy) * sin + cx,
      offsetY: (x - cx) * sin + (y - cy) * cos + cy
    });

    if (c.type === 'connector') {
        const count = c.properties.portsCount || INITIAL_CONNECTOR_PORTS;
        const ports: Port[] = [];
        // Connector starts at x=0 and adds ports every 40px (Increased from 20px)
        for (let i = 0; i < count; i++) {
            const px = i * 40;
            const p = rotatePoint(px, 0);
            ports.push({
                id: `${c.id}_p${i}`,
                componentId: c.id,
                offsetX: p.offsetX,
                offsetY: p.offsetY
            });
        }
        return ports;
    }

    if (c.type === 'ground') {
       // Ground has only 1 port, centered at 40,0 to match other components' grid alignment
       const p = rotatePoint(40, 0);
       return [
         { id: `${c.id}_p1`, componentId: c.id, offsetX: p.offsetX, offsetY: p.offsetY }
       ];
    }

    const p1 = rotatePoint(0, 0);
    const p2 = rotatePoint(80, 0);

    return [
      { id: `${c.id}_p1`, componentId: c.id, offsetX: p1.offsetX, offsetY: p1.offsetY },
      { id: `${c.id}_p2`, componentId: c.id, offsetX: p2.offsetX, offsetY: p2.offsetY }
    ];
  }, []);

  // Memoize topology key so that moving components (x, y changes only) does NOT re-run the matrix solver 60 times/sec!
  const circuitTopologyKey = useMemo(() => {
    if (!isSimulating) return '';
    const compsKey = components.map(c => 
      `${c.id}:${c.type}:${c.rotation}:${c.properties.voltage}:${c.properties.resistance}:${c.properties.isOn}:${c.properties.portsCount}:${c.properties.bias}:${c.properties.ammeterRange}:${c.properties.voltmeterRange}`
    ).join('|');
    const connsKey = connections.map(cn => `${cn.id}:${cn.sourceId}:${cn.targetId}`).join('|');
    return `${compsKey}__${connsKey}__${settings.wireResistance}__${settings.batteryResistance}`;
  }, [components, connections, isSimulating, settings.wireResistance, settings.batteryResistance]);

  useEffect(() => {
    if (!isSimulating) {
        setSimulationResults({ nodeVoltages: {}, componentCurrents: {}, connectionCurrents: {} });
        return;
    }
    const res = solveCircuit(components, connections, getPorts, settings);
    setSimulationResults(res);
  }, [circuitTopologyKey, isSimulating, getPorts, settings]);

  const handleAddComponent = useCallback((type: ComponentType, x: number, y: number) => {
    if (viewMode === '3d') {
        alert("請切換回 2D 電路圖模式以新增元件。");
        return;
    }
    const newComp: Component = {
      id: generateId(),
      type,
      x,
      y,
      rotation: 0,
      properties: {
        voltage: type === 'battery' ? INITIAL_BATTERY_VOLTAGE : undefined,
        resistance: type === 'resistor' ? INITIAL_RESISTANCE : type === 'bulb' ? INITIAL_BULB_RESISTANCE : undefined,
        isOn: type === 'switch' ? false : undefined,
        portsCount: type === 'connector' ? INITIAL_CONNECTOR_PORTS : undefined,
        ammeterRange: type === 'ammeter' ? DEFAULT_AMMETER_RANGE : undefined,
        voltmeterRange: type === 'voltmeter' ? DEFAULT_VOLTMETER_RANGE : undefined,
        bias: type === 'ground' ? INITIAL_GROUND_BIAS : undefined,
      }
    };
    setComponents(prev => {
      const nextComponents = [...prev, newComp];
      saveToHistory(nextComponents, connections);
      return nextComponents;
    });
    setActiveTool('select');
  }, [viewMode, connections, saveToHistory]);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setConnections(prev => {
      if (prev.some(c => (c.sourceId === sourceId && c.targetId === targetId) || (c.sourceId === targetId && c.targetId === sourceId))) {
        return prev;
      }
      const nextConnections = [...prev, { id: generateId(), sourceId, targetId }];
      saveToHistory(components, nextConnections);
      return nextConnections;
    });
  }, [components, saveToHistory]);

  const handleUpdateComponent = useCallback((idOrIds: string | string[], updates: Partial<Component['properties']>) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    
    // Check if we are reducing connector ports
    let nextConnections = [...connections];
    if (updates.portsCount !== undefined) {
        const connectors = components.filter(c => ids.includes(c.id) && c.type === 'connector');
        
        connectors.forEach(conn => {
            const currentCount = conn.properties.portsCount || INITIAL_CONNECTOR_PORTS;
            const newCount = updates.portsCount!;
            
            if (newCount < currentCount) {
                const portsToRemove: string[] = [];
                for(let i = newCount; i < currentCount; i++) {
                    portsToRemove.push(`${conn.id}_p${i}`);
                }
                
                nextConnections = nextConnections.filter(c => 
                    !portsToRemove.includes(c.sourceId) && !portsToRemove.includes(c.targetId)
                );
            }
        });
        setConnections(nextConnections);
    }

    const nextComponents = components.map(c => ids.includes(c.id) ? { ...c, properties: { ...c.properties, ...updates } } : c);
    setComponents(nextComponents);
    saveToHistory(nextComponents, nextConnections);
  }, [components, connections, saveToHistory]);

  const handleDelete = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const nextComponents = components.filter(c => !ids.includes(c.id));
    
    // Determine removed ports to cleanup connections
    const removedComponents = components.filter(c => ids.includes(c.id));
    const removedPorts: string[] = [];
    
    removedComponents.forEach(c => {
         if (c.type === 'connector') {
             const count = c.properties.portsCount || INITIAL_CONNECTOR_PORTS;
             for(let i = 0; i < count; i++) removedPorts.push(`${c.id}_p${i}`);
         } else if (c.type === 'ground') {
             removedPorts.push(`${c.id}_p1`);
         } else {
             removedPorts.push(`${c.id}_p1`);
             removedPorts.push(`${c.id}_p2`);
         }
    });
    
    // Also remove connection IDs passed directly
    const nextConnections = connections.filter(c => 
        !ids.includes(c.id) && 
        !removedPorts.includes(c.sourceId) && 
        !removedPorts.includes(c.targetId)
    );
    
    setComponents(nextComponents);
    setConnections(nextConnections);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    saveToHistory(nextComponents, nextConnections);
  }, [components, connections, saveToHistory]);

  const handleMoveComponents = useCallback((updates: { id: string, x: number, y: number }[]) => {
    setComponents(prev => {
        const updateMap = new Map(updates.map(u => [u.id, u]));
        return prev.map(c => {
            const update = updateMap.get(c.id);
            return update ? { ...c, x: update.x, y: update.y } : c;
        });
    });
  }, []);

  const handleMoveEnd = useCallback(() => {
    saveToHistory(components, connections);
  }, [components, connections, saveToHistory]);

  const handleRotateComponent = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    let nextComponents = [...components];

    if (ids.length === 1) {
      nextComponents = nextComponents.map(c => 
        c.id === ids[0] ? { ...c, rotation: (c.rotation + 90) % 360 } : c
      );
    } else {
      const selectedComps = components.filter(c => ids.includes(c.id));
      if (selectedComps.length === 0) return;

      const minX = Math.min(...selectedComps.map(c => c.x));
      const maxX = Math.max(...selectedComps.map(c => c.x));
      const minY = Math.min(...selectedComps.map(c => c.y));
      const maxY = Math.max(...selectedComps.map(c => c.y));
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      
      nextComponents = nextComponents.map(c => {
        if (!ids.includes(c.id)) return c;
        
        const dx = c.x - cx;
        const dy = c.y - cy;
        
        const newDx = -dy;
        const newDy = dx;
        
        const newX = cx + newDx;
        const newY = cy + newDy;

        const snappedX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

        return {
          ...c,
          x: snappedX,
          y: snappedY,
          rotation: (c.rotation + 90) % 360
        };
      });
    }
    
    setComponents(nextComponents);
    saveToHistory(nextComponents, connections);
  }, [components, connections, saveToHistory]);

  const handleSelect = useCallback((ids: string[], additive = false) => {
      if (additive) {
          setSelectedIds(prev => {
              const newSet = new Set(prev);
              ids.forEach(id => {
                  if (newSet.has(id)) newSet.delete(id);
                  else newSet.add(id);
              });
              return Array.from(newSet);
          });
      } else {
          setSelectedIds(ids);
      }
  }, []);

  const downloadJson = (data: any, filenamePrefix: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        components,
        connections,
        settings, // Include settings in export
    };
    downloadJson(data, 'circuit-all');
    setShowMobileMenu(false);
  };

  const handleExportSelection = () => {
    if (selectedIds.length === 0) return;

    // Filter components
    const exportComps = components.filter(c => selectedIds.includes(c.id));
    
    // Filter connections: both source and target must be in the selected group
    const exportConns = connections.filter(conn => {
       const getCompId = (portId: string) => portId.split('_p')[0];
       const sourceCompId = getCompId(conn.sourceId);
       const targetCompId = getCompId(conn.targetId);
       return selectedIds.includes(sourceCompId) && selectedIds.includes(targetCompId);
    });

    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        components: exportComps,
        connections: exportConns,
    };
    downloadJson(data, 'circuit-selection');
    setShowMobileMenu(false);
  };

  const handleImportClick = (mode: 'overwrite' | 'append') => {
    setImportMode(mode);
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
        fileInputRef.current.click();
    }
    setShowMobileMenu(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);

            if (data.components && Array.isArray(data.components) && data.connections && Array.isArray(data.connections)) {
                setIsSimulating(false); // Stop simulation on import
                
                let newComponents: Component[] = [];
                let newConnections: Connection[] = [];
                let finalSelectedIds: string[] = [];

                if (importMode === 'overwrite') {
                    newComponents = data.components;
                    newConnections = data.connections;
                    if (data.settings) setSettings(data.settings); // Load settings if available
                    finalSelectedIds = [];
                } else {
                    // APPEND MODE: Remap IDs to avoid conflicts
                    const idMap = new Map<string, string>();

                    // 1. Remap Components
                    const importedComponents = data.components.map((c: Component) => {
                        const newId = generateId();
                        idMap.set(c.id, newId);
                        return { ...c, id: newId };
                    });

                    // 2. Remap Connections
                    const importedConnections: Connection[] = [];
                    data.connections.forEach((conn: Connection) => {
                         // Extract component ID and port suffix from port ID (format: compId_suffix)
                         const parsePort = (pid: string) => {
                             const idx = pid.lastIndexOf('_p');
                             if (idx === -1) return { compId: pid, suffix: '' };
                             return { compId: pid.substring(0, idx), suffix: pid.substring(idx) };
                         };

                         const src = parsePort(conn.sourceId);
                         const tgt = parsePort(conn.targetId);

                         const newSrcCompId = idMap.get(src.compId);
                         const newTgtCompId = idMap.get(tgt.compId);

                         if (newSrcCompId && newTgtCompId) {
                             importedConnections.push({
                                 id: generateId(),
                                 sourceId: `${newSrcCompId}${src.suffix}`,
                                 targetId: `${newTgtCompId}${tgt.suffix}`
                             });
                         }
                    });

                    newComponents = [...components, ...importedComponents];
                    newConnections = [...connections, ...importedConnections];
                    
                    // Select only the imported items
                    finalSelectedIds = importedComponents.map((c: Component) => c.id);
                }

                setComponents(newComponents);
                setConnections(newConnections);
                saveToHistory(newComponents, newConnections);
                setSelectedIds(finalSelectedIds);
            } else {
                alert("無效的電路檔案格式");
            }
        } catch (err) {
            console.error(err);
            alert("讀取檔案時發生錯誤");
        }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key priority: Clear Selection -> Close Modals
      if (e.key === 'Escape') {
          if (activeTool === 'select' && selectedIds.length > 0) {
             setSelectedIds([]);
             return; 
          }

          setShowHelp(false);
          setShowSettings(false);
          return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete(selectedIds);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }

      // Tool shortcuts - only in 2D mode and no modifiers
      if (viewMode === '2d' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case ' ': setActiveTool('select'); e.preventDefault(); break; // Spacebar
          case 'w': setActiveTool('wire'); break; // Wire
          case 'd': setActiveTool('scissors'); break;
          case 'b': setActiveTool('battery'); break;
          case 'r': setActiveTool('resistor'); break;
          case 'l': setActiveTool('bulb'); break;
          case 's': setActiveTool('switch'); break;
          case 'c': setActiveTool('connector'); break;
          case 'v': setActiveTool('voltmeter'); break;
          case 'a': setActiveTool('ammeter'); break;
          case 'g': setActiveTool('ground'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, selectedIds, undo, viewMode, activeTool]);

  const selectedComponentObjs = useMemo(() => 
    components.filter(c => selectedIds.includes(c.id)),
    [components, selectedIds]
  );
  const selectedConnectionObjs = useMemo(() => 
    connections.filter(c => selectedIds.includes(c.id)),
    [connections, selectedIds]
  );
  
  // Icon sizes for Header
  const headerIconClass = "w-4 h-4 md:w-5 md:h-5";

  return (
    <div className="flex flex-col h-screen w-full relative">
      {/* Header: z-50 to ensure dropdowns are above PropertiesPanel (z-40) */}
      <div className="h-10 md:h-14 bg-white border-b flex items-center px-2 md:px-4 shadow-sm z-50 justify-between flex-shrink-0 relative">
        <div className="flex items-center gap-2">
           {/* Title hidden on mobile as requested */}
           <h1 className="font-bold text-xl text-gray-800 tracking-tight hidden md:block">⚡電學實驗室⚡</h1>
           
           <div className="mx-2 h-6 w-px bg-gray-200 hidden md:block"></div>
           
           <button 
             onClick={() => setIsSimulating(!isSimulating)}
             className={`flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-sm font-semibold transition-colors ${
               isSimulating 
                 ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                 : 'bg-green-100 text-green-700 hover:bg-green-200'
             }`}
           >
             {isSimulating ? <Square className={headerIconClass} fill="currentColor" /> : <Play className={headerIconClass} fill="currentColor" />}
             <span className="hidden sm:inline text-xs md:text-sm">{isSimulating ? "停止模擬" : "開始模擬"}</span>
           </button>

           <div className="flex bg-gray-100 rounded-lg p-1 ml-2 md:ml-4">
              <button 
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === '2d' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="2D 電路圖"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden md:inline">2D 電路圖</span>
              </button>
              <button 
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === '3d' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="3D 電位立體圖"
              >
                <Box className="w-4 h-4" />
                <span className="hidden md:inline">3D 電位立體圖</span>
              </button>
           </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          <div className="text-xs text-gray-500 hidden lg:block mr-2">
            {viewMode === '2d' ? '選取 + Delete 刪除 • Shift+拖曳 多選' : '旋轉: 左鍵 • 平移: 右鍵 • 縮放: 滾輪'}
          </div>
          
          <div className="h-4 md:h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

          {/* Desktop Toolbar - Hidden on Mobile */}
          <div className="hidden md:flex items-center gap-2">
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleExportSelection}
                    className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"
                    title="匯出選取元件"
                >
                    <FileOutput className={headerIconClass} />
                </button>
            )}
            
            <button 
                onClick={() => handleImportClick('append')}
                className="text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                title="匯入元件"
            >
                <FilePlus className={headerIconClass} />
            </button>

            <button 
                onClick={handleExport}
                className="text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                title="儲存檔案 (下載電路與設定)"
            >
                <Download className={headerIconClass} />
            </button>

            <button 
                onClick={() => handleImportClick('overwrite')}
                className="text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                title="開啟舊檔 (載入電路與設定)"
            >
                <Upload className={headerIconClass} />
            </button>

            <button 
                onClick={() => setShowHelp(true)}
                className="text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                title="幫助"
            >
                <HelpCircle className={headerIconClass} />
            </button>

            <button 
                onClick={() => setShowSettings(true)}
                className="text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                title="設定"
            >
                <Settings className={headerIconClass} />
            </button>
          </div>

          {/* Mobile "More" Menu - Hidden on Desktop */}
          <div className="md:hidden relative">
              <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                  <MoreVertical className="w-5 h-5" />
              </button>

              {showMobileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 flex flex-col">
                      <button 
                          onClick={() => { setShowHelp(true); setShowMobileMenu(false); }}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-100"
                      >
                          <HelpCircle size={16} /> 幫助
                      </button>
                      <button 
                          onClick={() => { setShowSettings(true); setShowMobileMenu(false); }}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-100"
                      >
                          <Settings size={16} /> 設定
                      </button>
                      
                      {selectedIds.length > 0 && (
                         <button 
                            onClick={handleExportSelection}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 text-left"
                        >
                            <FileOutput size={16} /> 匯出選取元件
                        </button>
                      )}
                                            
                      <button 
                          onClick={() => handleImportClick('append')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                          <FilePlus size={16} /> 匯入元件
                      </button>

                      <button 
                          onClick={handleExport}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                          <Download size={16} /> 儲存檔案
                      </button>

                      <button 
                          onClick={() => handleImportClick('overwrite')}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                          <Upload size={16} /> 開啟舊檔
                      </button>
                  </div>
              )}
              {/* Overlay to close menu when clicking outside */}
              {showMobileMenu && (
                  <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setShowMobileMenu(false)}
                  />
              )}
          </div>

          <input 
             type="file" 
             accept=".json" 
             ref={fileInputRef} 
             className="hidden" 
             onChange={handleFileChange}
          />
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <HelpCircle size={24} className="text-blue-600"/>
                操作說明
              </h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Shortcuts Section */}
              <div className="space-y-4">
                   <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                      <Layers size={16} /> 2D 介面快捷鍵
                   </h3>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>選取 (移動)</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">Space</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>接線 (連接)</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">W</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>剪刀 (刪除)</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">D</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>復原</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">Ctrl+Z</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>電池</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">B</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>電阻</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">R</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>燈泡</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">L</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>開關</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">S</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>連接器</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">C</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>伏特計</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">V</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>安培計</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">A</kbd>
                       </div>
                       <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                           <span>接地</span> <kbd className="font-mono font-bold bg-white px-1.5 rounded border">G</kbd>
                       </div>
                   </div>
              </div>

              {/* 3D Controls Section */}
              <div className="space-y-4">
                   <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                      <Box size={16} /> 3D 介面操作
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col items-center p-3 text-center border rounded-lg bg-gray-50">
                            <div className="relative mb-2">
                                <Mouse size={24} className="text-gray-400" />
                                <div className="absolute top-0 left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                            <span className="font-bold text-sm text-gray-700">旋轉視角</span>
                            <span className="text-xs text-gray-500">按住左鍵拖曳</span>
                        </div>
                        <div className="flex flex-col items-center p-3 text-center border rounded-lg bg-gray-50">
                            <div className="relative mb-2">
                                <Mouse size={24} className="text-gray-400" />
                                <div className="absolute top-0 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                            <span className="font-bold text-sm text-gray-700">平移視角</span>
                            <span className="text-xs text-gray-500">按住右鍵拖曳</span>
                        </div>
                        <div className="flex flex-col items-center p-3 text-center border rounded-lg bg-gray-50">
                             <div className="mb-2 text-gray-400 font-mono text-lg">↕</div>
                            <span className="font-bold text-sm text-gray-700">縮放視角</span>
                            <span className="text-xs text-gray-500">滾動滑鼠滾輪</span>
                        </div>
                   </div>
              </div>

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowHelp(false)}
                className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                開始使用
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b pb-4 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Settings size={24} className="text-gray-600" />
                設定
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    {/* Left Column: Simulation Settings */}
                    <div className="space-y-5">
                         <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-1 border-b flex items-center gap-2">
                                <Sliders size={16}/> 模擬參數設定
                            </h3>
                            <div className="space-y-6 px-1">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-semibold text-gray-700">
                                            模擬電流動畫速度
                                        </label>
                                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{settings.animationSpeed}x</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.1" 
                                        max="5" 
                                        step="0.1"
                                        value={settings.animationSpeed}
                                        onChange={(e) => setSettings({...settings, animationSpeed: parseFloat(e.target.value)})}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">調整電流流動動畫的快慢，不影響數值計算。</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        導線電阻值 (Ω)
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.001"
                                        value={settings.wireResistance}
                                        onChange={(e) => setSettings({...settings, wireResistance: Math.max(0, parseFloat(e.target.value))})}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">設定每一段導線的微小電阻值。設為 0 代表理想導線。</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        電池內電阻 (Ω)
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.001"
                                        value={settings.batteryResistance}
                                        onChange={(e) => setSettings({...settings, batteryResistance: Math.max(0, parseFloat(e.target.value))})}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">電池在負載下會有壓降。設為 0 代表理想電源。</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        安培計量測上限 (A)
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0.1"
                                        step="1"
                                        value={settings.ammeterLimit}
                                        onChange={(e) => setSettings({...settings, ammeterLimit: Math.max(0.1, parseFloat(e.target.value))})}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">若電流超過此值，儀表將顯示 "OL" (Over Load)。</p>
                                </div>
                            </div>
                         </div>
                    </div>

                    {/* Right Column: Display Settings */}
                    <div className="space-y-5">
                         {/* 2D Settings */}
                         <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-1 border-b border-gray-200 flex items-center gap-2">
                                <Layers size={16}/> 2D 顯示設定
                             </h3>
                             <div className="space-y-1">
                                <ToggleOption 
                                    label="顯示元件電流數值"
                                    checked={settings.showCurrent2D}
                                    onChange={(checked) => setSettings({...settings, showCurrent2D: checked})}
                                />
                                <ToggleOption 
                                    label="顯示端點電位數值"
                                    checked={settings.showPotentials2D}
                                    onChange={(checked) => setSettings({...settings, showPotentials2D: checked})}
                                />
                                <ToggleOption 
                                    label="顯示消耗功率數值"
                                    checked={settings.showPower2D}
                                    onChange={(checked) => setSettings({...settings, showPower2D: checked})}
                                />
                             </div>
                         </div>

                         {/* 3D Settings */}
                         <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 pb-1 border-b border-gray-200 flex items-center gap-2">
                                 <Box size={16}/> 3D 顯示設定
                              </h3>
                              <div className="space-y-1">
                                  <ToggleOption 
                                      label="顯示節點電位數值"
                                      checked={view3DSettings.showPotentials}
                                      onChange={(checked) => setView3DSettings({...view3DSettings, showPotentials: checked})}
                                  />
                                  <ToggleOption 
                                      label="顯示電流大小數值"
                                      checked={view3DSettings.showCurrents}
                                      onChange={(checked) => setView3DSettings({...view3DSettings, showCurrents: checked})}
                                  />
                                  <ToggleOption 
                                      label="顯示電阻/功率數值"
                                      checked={view3DSettings.showValues}
                                      onChange={(checked) => setView3DSettings({...view3DSettings, showValues: checked})}
                                  />
                              </div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t">
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium shadow-sm active:scale-95 transform duration-100"
              >
                完成設定
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {viewMode === '2d' && (
            <Toolbar 
            activeTool={activeTool} 
            onSelectTool={setActiveTool} 
            onClear={() => { 
                saveToHistory([], []); 
                setComponents([]); 
                setConnections([]); 
                setSelectedIds([]);
            }}
            onUndo={undo}
            canUndo={historyIndex > 0}
            />
        )}

        {viewMode === '2d' ? (
          <CircuitCanvas
            components={components}
            connections={connections}
            activeTool={activeTool}
            selectedIds={selectedIds}
            onAddComponent={handleAddComponent}
            onConnect={handleConnect}
            onSelect={handleSelect}
            onMoveComponents={handleMoveComponents}
            onMoveEnd={handleMoveEnd}
            onDelete={handleDelete}
            nodeVoltages={simulationResults.nodeVoltages} 
            componentCurrents={simulationResults.componentCurrents}
            connectionCurrents={simulationResults.connectionCurrents}
            getPorts={getPorts}
            isSimulating={isSimulating}
            settings={settings}
          />
        ) : (
          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 text-slate-500">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium">載入 3D 物理引擎與模型中...</p>
            </div>
          }>
            <Circuit3D
              components={components}
              connections={connections}
              nodeVoltages={simulationResults.nodeVoltages} 
              componentCurrents={simulationResults.componentCurrents}
              connectionCurrents={simulationResults.connectionCurrents}
              getPorts={getPorts}
              isSimulating={isSimulating}
              viewSettings={view3DSettings}
              settings={settings}
            />
          </Suspense>
        )}

        <PropertiesPanel
          selectedComponents={selectedComponentObjs}
          selectedConnections={selectedConnectionObjs}
          onUpdate={handleUpdateComponent}
          onDelete={handleDelete}
          onRotate={handleRotateComponent}
          simulationResults={simulationResults}
          getPorts={getPorts}
          viewMode={viewMode}
          isOpen={showPropertiesPanel}
          onToggle={() => setShowPropertiesPanel(!showPropertiesPanel)}
        />
      </div>
    </div>
  );
};

export default App;