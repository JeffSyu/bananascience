import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Component, Connection, Port, ComponentType, GlobalSettings } from '../types';
import { GRID_SIZE, COLORS, SHORT_CIRCUIT_CURRENT, COLOR_VOLTAGE_LOW, COLOR_VOLTAGE_HIGH, INITIAL_CONNECTOR_PORTS } from '../constants';

interface CircuitCanvasProps {
  components: Component[];
  connections: Connection[];
  activeTool: ComponentType | 'select' | 'scissors';
  selectedIds: string[];
  onAddComponent: (type: ComponentType, x: number, y: number) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onSelect: (ids: string[], additive?: boolean) => void;
  onMoveComponents: (updates: { id: string, x: number, y: number }[]) => void;
  onMoveEnd: () => void;
  onDelete: (ids: string[]) => void;
  nodeVoltages: Record<string, number>;
  componentCurrents: Record<string, number>;
  connectionCurrents: Record<string, number>;
  getPorts: (c: Component) => Port[];
  isSimulating: boolean;
  settings: GlobalSettings;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  components,
  connections,
  activeTool,
  selectedIds,
  onAddComponent,
  onConnect,
  onSelect,
  onMoveComponents,
  onMoveEnd,
  onDelete,
  nodeVoltages,
  componentCurrents,
  connectionCurrents,
  getPorts,
  isSimulating,
  settings
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Update drag state to include touch specific info
  const [dragState, setDragState] = useState<{ 
    startX: number; 
    startY: number; 
    initialPositions: Record<string, { x: number; y: number }>;
    hasMoved: boolean; 
    touchedId?: string; // ID of the component that initiated the touch
    wasSelectedAtStart?: boolean; // Was this component selected when touch started?
  } | null>(null);
  
  const [tempWire, setTempWire] = useState<{ startPortId: string; endX: number; endY: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);

  // Pre-calculate port positions in O(N) map to avoid O(N*P) nested loops on every single line and gradient
  const portPositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    components.forEach(c => {
      const ports = getPorts(c);
      ports.forEach(p => {
        map.set(p.id, { x: c.x + p.offsetX, y: c.y + p.offsetY });
      });
    });
    return map;
  }, [components, getPorts]);

  const getPortPosition = (portId: string): { x: number, y: number } => {
    return portPositionMap.get(portId) || { x: 0, y: 0 };
  };

  // Check for Short Circuit Globally to trigger effect
  const hasGlobalShortCircuit = useMemo(() => {
    if (!isSimulating) return false;
    const highWire = Object.values(connectionCurrents).some(c => Math.abs(c) > SHORT_CIRCUIT_CURRENT);
    const highComp = Object.values(componentCurrents).some(c => Math.abs(c) > SHORT_CIRCUIT_CURRENT);
    return highWire || highComp;
  }, [componentCurrents, connectionCurrents, isSimulating]);

  // Calculate global min/max voltage for color scaling
  const { minVoltage, maxVoltage } = useMemo<{ minVoltage: number; maxVoltage: number }>(() => {
    const rawValues = Object.values(nodeVoltages);
    // Convert to numbers explicitly to handle any potential type issues
    const values = rawValues.map(v => Number(v)).filter(n => !isNaN(n));
    
    if (values.length === 0) return { minVoltage: 0, maxVoltage: 9 };
    
    // Use loop instead of spread operator to avoid TS errors with large arrays or type inference issues
    let min = values[0];
    let max = values[0];
    
    for (let i = 1; i < values.length; i++) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    
    if (max - min < 0.1) {
       max = min + 1; 
    }
    return { minVoltage: min, maxVoltage: max };
  }, [nodeVoltages]);

  const getVoltageColor = (voltage: number) => {
    const min = minVoltage;
    const max = maxVoltage;
    const t = Math.max(0, Math.min(1, (voltage - min) / (max - min)));
    
    // Explicitly cast to tuple to ensure elements are treated as numbers
    const low = COLOR_VOLTAGE_LOW as [number, number, number];
    const high = COLOR_VOLTAGE_HIGH as [number, number, number];
    
    const r = Math.round(low[0] + t * (high[0] - low[0]));
    const g = Math.round(low[1] + t * (high[1] - low[1]));
    const b = Math.round(low[2] + t * (high[2] - low[2]));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getMousePos = (e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;
    return { x, y };
  };

  // Helper for Touch Coordinates
  const getTouchPos = (e: React.TouchEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM || e.changedTouches.length === 0) return { x: 0, y: 0 };
    
    const touch = e.changedTouches[0];
    const x = (touch.clientX - CTM.e) / CTM.a;
    const y = (touch.clientY - CTM.f) / CTM.d;
    return { x, y };
  };

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // --- MOUSE HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getMousePos(e);
    
    // Add Component Mode
    // Don't create component if tool is select, scissors, OR wire
    if (activeTool !== 'select' && activeTool !== 'scissors' && activeTool !== 'wire' && !(e.target as Element).closest('g')) {
      onAddComponent(activeTool, snapToGrid(x), snapToGrid(y));
      return;
    }

    // Scissors Mode
    if (activeTool === 'scissors') return;

    // Selection Mode - Box Select Start
    if (activeTool === 'select') {
      if (e.target === svgRef.current) {
          setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      }
    }
  };

  const handlePortMouseDown = (e: React.MouseEvent, portId: string) => {
    e.stopPropagation();
    if (activeTool !== 'wire') return; // Only allow connection in wire tool

    // CLICK-TO-CONNECT
    if (tempWire) {
        if (tempWire.startPortId !== portId) {
            onConnect(tempWire.startPortId, portId);
            setTempWire(null);
        } else {
            setTempWire(null);
        }
        return;
    }

    const { x, y } = getMousePos(e);
    setTempWire({ startPortId: portId, endX: x, endY: y });
  };

  const handlePortMouseUp = (e: React.MouseEvent, portId: string) => {
    e.stopPropagation();
    if (activeTool !== 'wire') return;
    
    if (tempWire && tempWire.startPortId !== portId) {
      onConnect(tempWire.startPortId, portId);
      setTempWire(null);
    }
  };

  const handleComponentMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === 'scissors') {
        onDelete([id]);
        return;
    }
    
    // Only allow drag moving in select mode
    if (activeTool === 'select') {
      const { x, y } = getMousePos(e);
      
      // Rule 5: Only components in selected state can be dragged
      if (selectedIds.includes(id)) {
          // Calculate initial positions for ALL selected components relative to the drag start
          const initialPositions: Record<string, {x:number, y:number}> = {};
          
          components.forEach(c => {
             if (selectedIds.includes(c.id)) {
                 initialPositions[c.id] = { x: c.x, y: c.y };
             }
          });

          setDragState({ 
            startX: x, 
            startY: y, 
            initialPositions,
            hasMoved: false 
          });
      }
    }
  };
  
  const handleComponentMouseUp = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      
      // If we were dragging and actually moved, we don't change selection
      // We rely on the global handleMouseUp (via svg/mouseLeave) to clean up dragState if we dragged
      // But if we released here, we should ensure clean up.
      if (dragState && dragState.hasMoved) {
          onMoveEnd();
          setDragState(null);
          return;
      }

      // Logic for Static Click
      if (activeTool === 'select') {
          const isSelected = selectedIds.includes(id);

          if (!isSelected) {
              // Rule 1: Single click unselected component -> Select it
              onSelect([id], e.shiftKey);
          } else {
              // It is selected
              if (selectedIds.length === 1 && selectedIds[0] === id) {
                  // Rule 2: Single click already selected single component -> Cancel selection
                  if (!e.shiftKey) onSelect([]);
              } else {
                  // Rule 3: Single click already selected component group -> Select ONLY this component
                  if (!e.shiftKey) onSelect([id]);
                  else onSelect([id], true); // Shift key behavior: toggle off
              }
          }
      }
      
      // Reset drag state if it existed but didn't move
      setDragState(null);
  };

  const handleWireClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (activeTool === 'scissors') {
          onDelete([id]);
      } else if (activeTool === 'select') {
          onSelect([id], e.shiftKey);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMousePos(e);
    
    // Safety check: If no buttons are pressed, we shouldn't be dragging.
    // This fixes the "sticky component" bug where drag continues after mouse up outside window.
    if (dragState && e.buttons === 0) {
        if (dragState.hasMoved) onMoveEnd();
        setDragState(null);
        return;
    }
    
    if (dragState) {
      const dist = Math.hypot(x - dragState.startX, y - dragState.startY);
      
      // Threshold to consider it a move (prevents jitters)
      if (dragState.hasMoved || dist > 2) {
          if (!dragState.hasMoved) {
              setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
          }

          const dx = x - dragState.startX;
          const dy = y - dragState.startY;

          const updates = Object.entries(dragState.initialPositions).map(([compId, val]) => {
              const initPos = val as { x: number, y: number };
              return {
                id: compId,
                x: snapToGrid(initPos.x + dx),
                y: snapToGrid(initPos.y + dy)
              };
          });

          onMoveComponents(updates);
      }
    }

    if (tempWire) {
      setTempWire({ ...tempWire, endX: x, endY: y });
    }

    if (selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragState && dragState.hasMoved) {
        onMoveEnd();
    }
    setDragState(null);
    setTempWire(null);

    if (selectionBox) {
        const x1 = Math.min(selectionBox.startX, selectionBox.endX);
        const x2 = Math.max(selectionBox.startX, selectionBox.endX);
        const y1 = Math.min(selectionBox.startY, selectionBox.endY);
        const y2 = Math.max(selectionBox.startY, selectionBox.endY);

        const isClick = Math.abs(selectionBox.endX - selectionBox.startX) < 5 && 
                        Math.abs(selectionBox.endY - selectionBox.startY) < 5;

        if (isClick) {
            if (!e.shiftKey) onSelect([]);
        } else {
            const ids: string[] = [];
            // Rectangle Intersection Logic
            components.forEach(c => {
                let w = 80;
                if (c.type === 'connector') {
                     w = (c.properties.portsCount || 3) * 40;
                }
                
                // Component Bounding Box (Approximate)
                // Components are usually centered Y at 0 in their local space, hitting -25 to +25 roughly
                // X is from 0 to w
                const cLeft = c.x;
                const cRight = c.x + w;
                const cTop = c.y - 25;
                const cBottom = c.y + 25;
                
                // Check Intersection: !(Left > Right || Right < Left || Top > Bottom || Bottom < Top)
                const intersects = !(cLeft > x2 || cRight < x1 || cTop > y2 || cBottom < y1);
                
                if (intersects) {
                    ids.push(c.id);
                }
            });
            
            // For connections, we can stick to checking endpoints or center
            connections.forEach(conn => {
                const start = getPortPosition(conn.sourceId);
                const end = getPortPosition(conn.targetId);
                // Check if either end is inside OR if the line crosses the rect (too complex? Stick to endpoints + midpoint for now)
                // Simplified: Check endpoints
                const p1Inside = start.x >= x1 && start.x <= x2 && start.y >= y1 && start.y <= y2;
                const p2Inside = end.x >= x1 && end.x <= x2 && end.y >= y1 && end.y <= y2;
                if (p1Inside && p2Inside) {
                    ids.push(conn.id);
                }
            });

            if (ids.length > 0) {
                onSelect(ids, e.shiftKey);
            } else if (!e.shiftKey) {
                onSelect([]);
            }
        }
        setSelectionBox(null);
    }
  };

  // --- TOUCH HANDLERS (Optimized for Mobile) ---

  const handleComponentTouchStart = (e: React.TouchEvent, id: string) => {
      e.stopPropagation();
      if (activeTool === 'scissors') {
          onDelete([id]);
          return;
      }

      const { x, y } = getTouchPos(e);

      if (activeTool === 'select') {
          // For touch dragging, we MUST select the component immediately to let it move.
          // But we record if it was selected BEFORE this touch so we can handle toggle on tap.
          const wasSelected = selectedIds.includes(id);
          
          let targets = selectedIds;
          if (!wasSelected) {
              onSelect([id]); 
              targets = [id];
          }

          // Prepare drag immediately
          const initialPositions: Record<string, {x:number, y:number}> = {};
          components.forEach(c => {
             if (targets.includes(c.id)) {
                 initialPositions[c.id] = { x: c.x, y: c.y };
             }
          });

          setDragState({ 
            startX: x, 
            startY: y, 
            initialPositions,
            hasMoved: false,
            touchedId: id,
            wasSelectedAtStart: wasSelected
          });
      }
  };

  const handlePortTouchStart = (e: React.TouchEvent, portId: string) => {
      e.stopPropagation();
      if (activeTool !== 'wire') return; // Only allow wire tool

      const { x, y } = getTouchPos(e);

      // Support Tap-Tap connection style on mobile
      if (tempWire) {
          if (tempWire.startPortId !== portId) {
              onConnect(tempWire.startPortId, portId);
          }
          setTempWire(null);
      } else {
          setTempWire({ startPortId: portId, endX: x, endY: y });
      }
  };

  const handleWireTouchStart = (e: React.TouchEvent, id: string) => {
      e.stopPropagation();
      if (activeTool === 'scissors') {
          onDelete([id]);
      } else if (activeTool === 'select') {
          onSelect([id]);
      }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
      // Background touch
      const { x, y } = getTouchPos(e);
      if (activeTool === 'select') {
          setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      } else if (activeTool !== 'scissors' && activeTool !== 'wire') {
          onAddComponent(activeTool, snapToGrid(x), snapToGrid(y));
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const { x, y } = getTouchPos(e);

      // Dragging Components
      if (dragState) {
          if (!dragState.hasMoved) {
              const dist = Math.hypot(x - dragState.startX, y - dragState.startY);
              // INCREASED THRESHOLD: Allow small finger movements (jitter) without triggering drag
              if (dist > 8) {
                  setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
              }
          }

          if (dragState.hasMoved) {
              const dx = x - dragState.startX;
              const dy = y - dragState.startY;
              const updates = Object.entries(dragState.initialPositions).map(([compId, val]) => {
                  const initPos = val as { x: number, y: number };
                  return {
                    id: compId,
                    x: snapToGrid(initPos.x + dx),
                    y: snapToGrid(initPos.y + dy)
                  };
              });
              onMoveComponents(updates);
          }
      }

      // Dragging Wire
      if (tempWire) {
          setTempWire({ ...tempWire, endX: x, endY: y });
      }

      // Box Selection
      if (selectionBox) {
          setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      // Finish Dragging
      if (dragState) {
          if (dragState.hasMoved) {
              onMoveEnd();
          } else if (dragState.touchedId && activeTool === 'select') {
              // TAP Logic (did not move > 8px)
              // If it was selected at start, toggle it off (or single select it if it was part of a group)
              if (dragState.wasSelectedAtStart) {
                  if (selectedIds.length > 1) {
                      // Group -> Single
                      onSelect([dragState.touchedId]);
                  } else {
                      // Single -> Deselect
                      onSelect([]);
                  }
              }
              // If !wasSelectedAtStart, we already selected it in TouchStart, so we leave it selected.
          }
          setDragState(null);
      }

      // Finish Wire (Snap to port if close)
      if (tempWire) {
          const { x, y } = getTouchPos(e);
          // Simple hit detection for snap-to-connect on release
          let targetPortId: string | null = null;
          
          for (const c of components) {
              const ports = getPorts(c);
              for (const p of ports) {
                  if (p.id === tempWire.startPortId) continue;
                  const pPos = { x: c.x + p.offsetX, y: c.y + p.offsetY };
                  // Increased touch snap radius to 30px
                  if (Math.hypot(pPos.x - x, pPos.y - y) < 30) {
                      targetPortId = p.id;
                      break;
                  }
              }
              if (targetPortId) break;
          }
          
          if (targetPortId) {
              onConnect(tempWire.startPortId, targetPortId);
              setTempWire(null); 
          }
          else {
               // Calculate distance from start wire pos
               const startPos = getPortPosition(tempWire.startPortId);
               // If dragged further than 30px and released in empty space, cancel wire.
               // If released close to start (Tap), keep wire for second tap.
               if (Math.hypot(x - startPos.x, y - startPos.y) > 30) {
                   setTempWire(null); 
               }
          }
      }

      // Finish Selection Box
      if (selectionBox) {
          const x1 = Math.min(selectionBox.startX, selectionBox.endX);
          const x2 = Math.max(selectionBox.startX, selectionBox.endX);
          const y1 = Math.min(selectionBox.startY, selectionBox.endY);
          const y2 = Math.max(selectionBox.startY, selectionBox.endY);
          
          const isTap = Math.abs(selectionBox.endX - selectionBox.startX) < 5 && 
                        Math.abs(selectionBox.endY - selectionBox.startY) < 5;
          
          if (isTap) {
             onSelect([]);
          } else {
             const ids: string[] = [];
             components.forEach(c => {
                 let w = 80;
                 if (c.type === 'connector') {
                     w = (c.properties.portsCount || 3) * 40;
                 }
                 const cLeft = c.x;
                 const cRight = c.x + w;
                 const cTop = c.y - 25;
                 const cBottom = c.y + 25;
                 const intersects = !(cLeft > x2 || cRight < x1 || cTop > y2 || cBottom < y1);
                 
                 if (intersects) ids.push(c.id);
             });
             if (ids.length > 0) onSelect(ids);
             else onSelect([]);
          }
          setSelectionBox(null);
      }
  };


  const getFlowStyle = (current: number) => {
    if (!isSimulating || Math.abs(current) < 0.01) return {};
    // Adjust animation speed based on settings
    const baseDuration = Math.max(0.2, 2 / Math.abs(current)); 
    const duration = baseDuration / settings.animationSpeed;

    return {
      strokeDasharray: '5, 5',
      animation: `${current > 0 ? 'flow' : 'flow-reverse'} ${duration}s linear infinite`,
      opacity: 0.8
    };
  };

  const renderComponentShape = (comp: Component) => {
      const isSelected = selectedIds.includes(comp.id);
      const current = isSimulating ? (componentCurrents[comp.id] || 0) : 0;
      const isShortCircuit = Math.abs(current) > SHORT_CIRCUIT_CURRENT;
      const strokeColor = isShortCircuit ? COLORS.wireShort : (isSelected ? COLORS.selected : 'black');
      const strokeWidth = isShortCircuit ? "4" : "2";
      
      const flowLine = (isSimulating && Math.abs(current) > 0.01) ? (
        <line x1="0" y1="0" x2="80" y2="0" stroke="yellow" strokeWidth="2" 
              style={getFlowStyle(current)} pointerEvents="none" />
      ) : null;
      
      // Default hit area for most components
      const defaultHitArea = <rect x="0" y="-20" width="80" height="40" fill="transparent" />;

      let shape = null;
      let hitArea = defaultHitArea;

      switch (comp.type) {
          case 'resistor':
              shape = (
                  <g>
                      <path d="M0,0 L15,0 L20,-10 L30,10 L40,-10 L50,10 L60,-10 L65,0 L80,0" 
                            fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
                      {flowLine}
                  </g>
              );
              break;
          case 'battery':
              shape = (
                  <g>
                      <path d="M0,0 L35,0 M35,-15 L35,15 M45,-8 L45,8 M45,0 L80,0" 
                            fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <text x="25" y="-20" fontSize="10" fill="gray" transform="rotate(0)">+</text>
                      {isSimulating && Math.abs(current) > 0.01 && (
                        <>
                           <line x1="0" y1="0" x2="35" y2="0" stroke="yellow" strokeWidth="2" style={getFlowStyle(current)} />
                           <line x1="45" y1="0" x2="80" y2="0" stroke="yellow" strokeWidth="2" style={getFlowStyle(current)} />
                        </>
                      )}
                  </g>
              );
              break;
          case 'bulb':
              const brightness = isSimulating ? Math.min(1, Math.abs(current) * 2) : 0;
              const bulbFill = brightness > 0 ? `rgba(255, 230, 0, ${brightness})` : 'white';
              
              shape = (
                  <g>
                      <line x1="0" y1="0" x2="26" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <line x1="54" y1="0" x2="80" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <circle cx="40" cy="0" r="14" fill={bulbFill} stroke={strokeColor} strokeWidth={strokeWidth} />
                      <g transform="translate(40, 0)">
                        <line x1="-9" y1="-9" x2="9" y2="9" stroke={strokeColor} strokeWidth={strokeWidth} />
                        <line x1="9" y1="-9" x2="-9" y2="9" stroke={strokeColor} strokeWidth={strokeWidth} />
                      </g>
                      {isSimulating && brightness > 0 && (
                           <circle cx="40" cy="0" r="22" fill={`rgba(255, 230, 0, ${brightness * 0.4})`} filter="blur(4px)" pointerEvents="none" />
                      )}
                      {isSimulating && Math.abs(current) > 0.01 && (
                          <>
                            <line x1="0" y1="0" x2="26" y2="0" stroke="yellow" strokeWidth="2" style={getFlowStyle(current)} pointerEvents="none"/>
                            <line x1="54" y1="0" x2="80" y2="0" stroke="yellow" strokeWidth="2" style={getFlowStyle(current)} pointerEvents="none"/>
                          </>
                      )}
                  </g>
              );
              break;
          case 'switch':
              const angle = comp.properties.isOn ? 0 : -30;
              shape = (
                  <g>
                      <line x1="0" y1="0" x2="30" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <line x1="50" y1="0" x2="80" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <circle cx="30" cy="0" r="2" fill="black" />
                      <line x1="30" y1="0" x2="50" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} transform={`rotate(${angle} 30 0)`} />
                      {comp.properties.isOn && flowLine}
                  </g>
              );
              break;
          case 'voltmeter': {
              const p1 = `${comp.id}_p1`;
              const p2 = `${comp.id}_p2`;
              const val = isSimulating ? Math.abs((nodeVoltages[p1] || 0) - (nodeVoltages[p2] || 0)) : 0;
              shape = (
                  <g>
                      <line x1="0" y1="0" x2="20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <line x1="60" y1="0" x2="80" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <rect x="20" y="-15" width="40" height="30" fill="#f3f4f6" stroke={strokeColor} strokeWidth={strokeWidth} rx="4" />
                      <text x="40" y="-2" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">{val.toFixed(2)}V</text>
                      <text x="40" y="10" textAnchor="middle" fontSize="8" fill="#6b7280">VOLT</text>
                  </g>
              );
              break;
          }
          case 'ammeter': {
              const val = Math.abs(current);
              const limit = settings.ammeterLimit || 10;
              const displayVal = val > limit ? "OL" : `${val.toFixed(2)}A`;
              const textColor = val > limit ? 'red' : '#374151';
              shape = (
                  <g>
                      <line x1="0" y1="0" x2="20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <line x1="60" y1="0" x2="80" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
                      <rect x="20" y="-15" width="40" height="30" fill="#f3f4f6" stroke={strokeColor} strokeWidth={strokeWidth} rx="4" />
                      <text x="40" y="-2" textAnchor="middle" fontSize="10" fontWeight="bold" fill={textColor}>{displayVal}</text>
                      <text x="40" y="10" textAnchor="middle" fontSize="8" fill="#6b7280">AMP</text>
                      {flowLine}
                  </g>
              );
              break;
          }
          case 'connector': {
              const count = comp.properties.portsCount || INITIAL_CONNECTOR_PORTS;
              // Spacing 40px
              const width = (count - 1) * 40;
              // Reduce hit area height to 43px (centered at y=0, so -21.5 to +21.5)
              const hitHeight = 43;
              const hitY = -hitHeight / 2;
              const paddingX = 20;
              
              // Expanded hit area but smaller height
              hitArea = <rect x={-paddingX} y={hitY} width={width + (paddingX * 2)} height={hitHeight} fill="rgba(0,0,0,0)" pointerEvents="all" />;
              
              shape = (
                  <g>
                      <line x1="0" y1="0" x2={width} y2="0" stroke={COLORS.connector} strokeWidth="6" strokeLinecap="round" />
                      {/* Highlight if selected - matches hitArea dimensions */}
                      {isSelected && (
                          <rect 
                              x={-paddingX} 
                              y={hitY} 
                              width={width + (paddingX * 2)} 
                              height={hitHeight} 
                              fill="transparent" 
                              stroke={COLORS.selected} 
                              strokeWidth="1" 
                              strokeDasharray="4 2" 
                              rx="4" 
                          />
                      )}
                  </g>
              );
              break;
          }
          case 'ground': {
              const bias = comp.properties.bias || 0;
              // Port is at (40, 0).
              // Draw short wire from (40, 0) down to (40, 15)
              // Symbol below (40, 15)
              hitArea = <rect x="20" y="0" width="40" height="40" fill="transparent" />;
              shape = (
                  <g>
                      <line x1="40" y1="0" x2="40" y2="15" stroke={COLORS.ground} strokeWidth="2" />
                      {/* Ground Symbol Lines */}
                      <line x1="30" y1="15" x2="50" y2="15" stroke={COLORS.ground} strokeWidth="2" />
                      <line x1="34" y1="19" x2="46" y2="19" stroke={COLORS.ground} strokeWidth="2" />
                      <line x1="38" y1="23" x2="42" y2="23" stroke={COLORS.ground} strokeWidth="2" />
                      
                      {/* Label or Value */}
                      <text x="40" y="35" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#4b5563">
                          {bias === 0 ? "GND" : `${bias}V`}
                      </text>
                  </g>
              );
              break;
          }
      }
      return <>{hitArea}{shape}</>;
  };

  return (
    <div className="flex-1 bg-white overflow-hidden relative select-none">
      <div className="absolute inset-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`, backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }} 
      />
      
      {/* Short Circuit Global Visual Warning */}
      {hasGlobalShortCircuit && (
          <div className="absolute inset-0 pointer-events-none z-50 animate-pulse" 
               style={{ boxShadow: 'inset 0 0 100px rgba(239, 68, 68, 0.4)' }}>
          </div>
      )}
      
      <svg 
        ref={svgRef}
        className={`w-full h-full ${activeTool === 'select' ? 'cursor-default' : activeTool === 'scissors' ? 'cursor-crosshair' : activeTool === 'wire' ? 'cursor-crosshair' : 'cursor-pointer'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        
        style={{ touchAction: 'none' }}
      >
        <defs>
          {connections.map(conn => {
            if (!isSimulating) return null;
            const current = connectionCurrents[conn.id] || 0;
            if (Math.abs(current) > SHORT_CIRCUIT_CURRENT) return null;

            const start = getPortPosition(conn.sourceId);
            const end = getPortPosition(conn.targetId);
            const v1 = nodeVoltages[conn.sourceId] || 0;
            const v2 = nodeVoltages[conn.targetId] || 0;
            
            return (
              <linearGradient 
                key={`grad-${conn.id}`} 
                id={`grad-${conn.id}`} 
                gradientUnits="userSpaceOnUse"
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
              >
                <stop offset="0%" stopColor={getVoltageColor(v1)} />
                <stop offset="100%" stopColor={getVoltageColor(v2)} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Wires */}
        {connections.map(conn => {
            const start = getPortPosition(conn.sourceId);
            const end = getPortPosition(conn.targetId);
            const current = isSimulating ? (connectionCurrents[conn.id] || 0) : 0;
            const isShortCircuit = Math.abs(current) > SHORT_CIRCUIT_CURRENT;
            const isSelected = selectedIds.includes(conn.id);
            
            let strokeStyle = COLORS.wire;
            if (isSelected) strokeStyle = COLORS.selected;

            if (isSimulating) {
               if (isShortCircuit) {
                  strokeStyle = COLORS.wireShort;
               } else if (!isSelected) {
                  strokeStyle = `url(#grad-${conn.id})`;
               }
            }

            const width = isShortCircuit ? "4" : (isSelected ? "4" : "3");
            
            return (
                <g key={conn.id} onClick={(e) => handleWireClick(e, conn.id)} onTouchStart={(e) => handleWireTouchStart(e, conn.id)}>
                    <line 
                        x1={start.x} y1={start.y}
                        x2={end.x} y2={end.y}
                        stroke="transparent"
                        strokeWidth="20"
                        strokeLinecap="round"
                        className="hover:stroke-gray-200 hover:opacity-30 cursor-pointer"
                    />
                    <line 
                        x1={start.x} y1={start.y}
                        x2={end.x} y2={end.y}
                        stroke={strokeStyle}
                        strokeWidth={width}
                        strokeLinecap="round"
                    />
                    {isSimulating && Math.abs(current) > 0.01 && (
                        <line 
                            x1={start.x} y1={start.y}
                            x2={end.x} y2={end.y}
                            stroke={isShortCircuit ? 'white' : '#fbbf24'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={getFlowStyle(current)}
                            pointerEvents="none"
                        />
                    )}
                </g>
            );
        })}

        {tempWire && (
            <line 
                x1={getPortPosition(tempWire.startPortId).x}
                y1={getPortPosition(tempWire.startPortId).y}
                x2={tempWire.endX}
                y2={tempWire.endY}
                stroke={COLORS.wireActive}
                strokeWidth="2"
                strokeDasharray="5,5"
            />
        )}

        {components.map(comp => {
            const ports = getPorts(comp);
            const isSelected = selectedIds.includes(comp.id);
            const current = isSimulating ? (componentCurrents[comp.id] || 0) : 0;
            let power = 0;
            if (isSimulating && (comp.type === 'resistor' || comp.type === 'bulb')) {
               const resistance = comp.properties.resistance || 0;
               power = current * current * resistance;
            }

            // Determine port hit area radius based on device
            // Mobile: 32x32 -> r=16
            // Desktop: 27x27 -> r=13.5
            const portHitRadius = isMobile ? 16 : 13.5;

            return (
                <g 
                    key={comp.id} 
                    transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation}, 40, 0)`}
                    onMouseDown={(e) => handleComponentMouseDown(e, comp.id)}
                    onMouseUp={(e) => handleComponentMouseUp(e, comp.id)}
                    onTouchStart={(e) => handleComponentTouchStart(e, comp.id)}
                    className={`hover:opacity-80 ${activeTool === 'scissors' ? 'cursor-pointer' : activeTool === 'select' ? 'cursor-move' : 'cursor-default'}`}
                >
                    {isSelected && comp.type !== 'connector' && (
                         <rect x="-5" y="-25" width="90" height="50" fill="transparent" stroke={COLORS.selected} strokeWidth="1" strokeDasharray="4 2" rx="4" />
                    )}

                    {renderComponentShape(comp)}

                    {/* 2D Visualization Data: Current */}
                    {settings.showCurrent2D && comp.type !== 'connector' && comp.type !== 'ground' && isSimulating && (
                        <text x="40" y="-35" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#2563eb" className="pointer-events-none select-none" transform={`rotate(${-comp.rotation} 40 -35)`}>
                            {Math.abs(current).toFixed(2)}A
                        </text>
                    )}

                    {/* 2D Visualization Data: Power */}
                    {settings.showPower2D && (comp.type === 'resistor' || comp.type === 'bulb') && isSimulating && (
                         <text x="40" y="-25" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#d97706" className="pointer-events-none select-none" transform={`rotate(${-comp.rotation} 40 -25)`}>
                             {power.toFixed(2)}W
                         </text>
                    )}
                    
                    {ports.map((port, idx) => {
                        // Updated localX for 40px spacing on connector
                        let localX = 0;
                        if (comp.type === 'connector') {
                            localX = idx * 40;
                        } else if (comp.type === 'ground') {
                            localX = 40;
                        } else {
                            localX = (port.id.endsWith('_p1') ? 0 : 80);
                        }
                        
                        const v = isSimulating ? (nodeVoltages[port.id] || 0) : 0;
                        const portFill = isSimulating ? getVoltageColor(v) : COLORS.port;
                        
                        return (
                            <g key={port.id}>
                                {/* Only render the interactive hit area circle when using Wire Tool. 
                                    This prevents it from blocking component selection clicks in Cursor Tool. */}
                                {activeTool === 'wire' && (
                                    <circle 
                                        cx={localX}
                                        cy={0}
                                        r={portHitRadius} 
                                        fill="transparent"
                                        className="cursor-crosshair"
                                        onMouseDown={(e) => handlePortMouseDown(e, port.id)}
                                        onMouseUp={(e) => handlePortMouseUp(e, port.id)}
                                        onTouchStart={(e) => handlePortTouchStart(e, port.id)}
                                    />
                                )}
                                <circle 
                                    cx={localX}
                                    cy={0}
                                    r={6}
                                    fill={portFill}
                                    stroke="white"
                                    strokeWidth="1"
                                    className="pointer-events-none transition-colors"
                                />
                                {/* 2D Visualization Data: Potentials */}
                                {settings.showPotentials2D && isSimulating && (
                                     <text x={localX} y={-15} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#16a34a" className="pointer-events-none select-none" transform={`rotate(${-comp.rotation} ${localX} -15)`}>
                                        {v.toFixed(1)}V
                                     </text>
                                )}
                            </g>
                        );
                    })}
                    {(comp.type === 'battery' || comp.type === 'resistor') && (
                        <text x="40" y="30" textAnchor="middle" fontSize="10" className="pointer-events-none select-none text-gray-500" transform={`rotate(${-comp.rotation} 40 30)`}>
                            {comp.type === 'battery' ? `${comp.properties.voltage}V` : 
                             comp.type === 'resistor' ? `${comp.properties.resistance}Ω` : ''}
                        </text>
                    )}
                </g>
            );
        })}

        {selectionBox && (
            <rect 
                x={Math.min(selectionBox.startX, selectionBox.endX)}
                y={Math.min(selectionBox.startY, selectionBox.endY)}
                width={Math.abs(selectionBox.endX - selectionBox.startX)}
                height={Math.abs(selectionBox.endY - selectionBox.startY)}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth="1"
                strokeDasharray="4,4"
            />
        )}
      </svg>
    </div>
  );
};