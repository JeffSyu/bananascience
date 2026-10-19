import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Upload } from 'lucide-react';
import { CustomParams, VariableType, Point, CustomInputMethod } from '../types';

interface CustomModePanelProps {
  params: CustomParams;
  onChange: (params: CustomParams) => void;
  maxTime: number;
}

export const CustomModePanel: React.FC<CustomModePanelProps> = ({ params, onChange, maxTime }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(params, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `custom_motion_config_${params.targetVariable}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (typeof parsed === 'object' && parsed !== null) {
          const validParams: CustomParams = {
            targetVariable: ['x', 'v', 'a'].includes(parsed.targetVariable) ? parsed.targetVariable : params.targetVariable,
            x0: typeof parsed.x0 === 'number' && !isNaN(parsed.x0) ? parsed.x0 : params.x0,
            v0: typeof parsed.v0 === 'number' && !isNaN(parsed.v0) ? parsed.v0 : params.v0,
            inputMethod: ['points', 'equation'].includes(parsed.inputMethod) ? parsed.inputMethod : params.inputMethod,
            equation: typeof parsed.equation === 'string' ? parsed.equation : params.equation,
            points: Array.isArray(parsed.points) ? parsed.points.map((p: any) => ({
              id: p.id || Math.random().toString(36).substr(2, 9),
              t: typeof p.t === 'number' ? p.t : 0,
              val: typeof p.val === 'number' ? p.val : 0,
            })) : params.points
          };
          onChange(validParams);
        } else {
          alert('無效的 JSON 檔案');
        }
      } catch (err) {
        alert('解析 JSON 檔案失敗');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleVariableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...params, targetVariable: e.target.value as VariableType });
  };

  const handleMethodChange = (method: CustomInputMethod) => {
    onChange({ ...params, inputMethod: method });
  };

  const handleEquationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...params, equation: e.target.value });
  };

  const [localInit, setLocalInit] = useState({
    x0: String(params.x0),
    v0: String(params.v0)
  });

  useEffect(() => {
    setLocalInit({
      x0: String(params.x0),
      v0: String(params.v0)
    });
  }, [params.x0, params.v0]);

  const handleInitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalInit(prev => ({ ...prev, [name]: value }));
    
    if (value !== '' && value !== '-' && !isNaN(Number(value))) {
      onChange({ ...params, [name]: Number(value) });
    }
  };

  const handleInitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let num = Number(value);
    if (isNaN(num)) num = 0;
    onChange({ ...params, [name]: num });
    setLocalInit(prev => ({ ...prev, [name]: String(num) }));
  };

  // SVG Coordinate mapping
  const width = 400;
  const height = 300;
  const padding = 20;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const tMax = maxTime;
  const valMax = 50; // depends on variable, let's say +/- 50

  const getSvgCoords = (t: number, val: number) => {
    const x = padding + (t / tMax) * innerWidth;
    const y = padding + innerHeight / 2 - (val / valMax) * (innerHeight / 2);
    return { x, y };
  };

  const getChartCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { t: 0, val: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    let t = ((svgP.x - padding) / innerWidth) * tMax;
    let val = ((padding + innerHeight / 2 - svgP.y) / (innerHeight / 2)) * valMax;
    
    t = Math.max(0, Math.min(tMax, t));
    val = Math.max(-valMax, Math.min(valMax, val));
    
    return { t: Number(t.toFixed(1)), val: Number(val.toFixed(1)) };
  };

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const pointerDownCoords = useRef<{ x: number, y: number } | null>(null);

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') {
      setDraggingPoint(target.id);
      pointerDownCoords.current = { x: e.clientX, y: e.clientY };
      target.setPointerCapture(e.pointerId);

      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        const point = params.points.find(p => p.id === target.id);
        if (point) {
          setEditingPoint(point);
          setDraggingPoint(null);
          try { target.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      }, 500);
    } else {
      // Add new point
      const coords = getChartCoords(e.clientX, e.clientY);
      const newPoint: Point = { id: Math.random().toString(36).substr(2, 9), ...coords };
      const newPoints = [...params.points, newPoint].sort((a, b) => a.t - b.t);
      onChange({ ...params, points: newPoints });
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPoint) {
      if (pointerDownCoords.current) {
        const dx = e.clientX - pointerDownCoords.current.x;
        const dy = e.clientY - pointerDownCoords.current.y;
        if (Math.hypot(dx, dy) > 5) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        } else if (longPressTimer.current) {
          // If within threshold and timer is still active, don't move yet
          return;
        }
      }

      const coords = getChartCoords(e.clientX, e.clientY);
      const newPoints = params.points.map(p => 
        p.id === draggingPoint ? { ...p, ...coords } : p
      ).sort((a, b) => a.t - b.t);
      onChange({ ...params, points: newPoints });
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (draggingPoint) {
      const target = e.target as SVGElement;
      try { target.releasePointerCapture(e.pointerId); } catch(err) {}
      setDraggingPoint(null);
    }
  };

  const polylinePoints = useMemo(() => {
    return params.points.map(p => {
      const c = getSvgCoords(p.t, p.val);
      return `${c.x},${c.y}`;
    }).join(' ');
  }, [params.points, maxTime]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          自訂運動參數
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportJSON}
            title="另存 JSON 設定檔"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded border border-slate-700 transition-colors"
          >
            <Download size={13} />
            <span>另存設定</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="載入 JSON 設定檔"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded border border-slate-700 transition-colors"
          >
            <Upload size={13} />
            <span>載入設定</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-slate-400 mb-2">目標變數</label>
          <select 
            value={params.targetVariable} 
            onChange={handleVariableChange}
            className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[12px] font-mono text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="x">位置 (x-t)</option>
            <option value="v">速度 (v-t)</option>
            <option value="a">加速度 (a-t)</option>
          </select>
        </div>

        {/* Initial values needed if v or a is selected */}
        {(params.targetVariable === 'v' || params.targetVariable === 'a') && (
          <div>
            <label className="block  text-[12px] font-bold text-slate-400 mb-1">初始位置 (x₀)</label>
            <input 
              type="text" 
              name="x0"
              value={localInit.x0} 
              onChange={handleInitChange}
              onBlur={handleInitBlur}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500"
            />
          </div>
        )}
        
        {params.targetVariable === 'a' && (
          <div>
            <label className="block  text-[12px] font-bold text-slate-400 mb-1">初始速度 (v₀)</label>
            <input 
              type="text" 
              name="v0"
              value={localInit.v0} 
              onChange={handleInitChange}
              onBlur={handleInitBlur}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="pt-3 border-t border-slate-800">
          <div className="flex bg-slate-800 p-1 rounded-md border border-slate-700 mb-4">
            <button
              onClick={() => handleMethodChange('points')}
              className={`flex-1 px-3 py-1  text-[12px] font-medium rounded transition-all ${params.inputMethod === 'points' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              點設定
            </button>
            <button
              onClick={() => handleMethodChange('equation')}
              className={`flex-1 px-3 py-1  text-[12px] font-medium rounded transition-all ${params.inputMethod === 'equation' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              函數設定
            </button>
          </div>

          {params.inputMethod === 'equation' ? (
            <div>
              <label className="block  text-[12px] font-bold text-slate-400 mb-1">
                函數  {params.targetVariable}(t) = 
              </label>
              <input 
                type="text" 
                value={params.equation} 
                onChange={handleEquationChange}
                placeholder="e.g. 2*sin(t) + t"
                className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-2">支援函數sin, cos, ^(次方)及數學常數e、pi</p>
            </div>
          ) : (
            <div>
              <div className="w-full overflow-hidden bg-[#0F172A] rounded border border-slate-700">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto cursor-crosshair touch-none select-none"
                  onPointerDown={handleSvgPointerDown}
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  onPointerCancel={handleSvgPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Grid */}
                  <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeDasharray="4 4" />
                  <line x1={padding} y1={padding} x2={padding} y2={height-padding} stroke="#334155" />
                  <line x1={width-padding} y1={padding} x2={width-padding} y2={height-padding} stroke="#334155" />
                  
                  {/* Lines */}
                  {params.points.length > 0 && (
                    <polyline points={polylinePoints} fill="none" stroke="#3b82f6" strokeWidth="2" />
                  )}
                  
                  {/* Points */}
                  {params.points.map(p => {
                    const c = getSvgCoords(p.t, p.val);
                    return (
                      <g key={p.id} className="group">
                        {/* Visible point */}
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r="6"
                          fill="#0F172A"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          className="pointer-events-none group-hover:stroke-white transition-colors"
                        />
                        {/* Invisible touch target */}
                        <circle
                          id={p.id}
                          cx={c.x}
                          cy={c.y}
                          r="18"
                          fill="transparent"
                          className="cursor-pointer"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingPoint(p);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex justify-end mt-2">
                <button 
                  onClick={() => onChange({ ...params, points: [] })}
                  className="px-4 text-[12px] text-red-400 hover:text-red-300 font-bold uppercase"
                >
                  清空
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">拖曳移動術據點<br />電腦滑鼠右鍵雙擊開啟數值介面<br />觸控裝置長按開啟數值介面</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Point Modal */}
      {editingPoint && (
        <EditPointModal 
          point={editingPoint}
          targetVariable={params.targetVariable}
          maxTime={maxTime}
          onSave={(updatedPoint) => {
            const newPoints = params.points.map(p => p.id === updatedPoint.id ? updatedPoint : p).sort((a, b) => a.t - b.t);
            onChange({ ...params, points: newPoints });
            setEditingPoint(null);
          }}
          onDelete={() => {
            const newPoints = params.points.filter(p => p.id !== editingPoint.id);
            onChange({ ...params, points: newPoints });
            setEditingPoint(null);
          }}
          onClose={() => setEditingPoint(null)}
        />
      )}
    </section>
  );
};

interface EditPointModalProps {
  point: Point;
  targetVariable: string;
  maxTime: number;
  onSave: (p: Point) => void;
  onDelete: () => void;
  onClose: () => void;
}

const EditPointModal: React.FC<EditPointModalProps> = ({ point, targetVariable, maxTime, onSave, onDelete, onClose }) => {
  const [localT, setLocalT] = useState(String(point.t));
  const [localVal, setLocalVal] = useState(String(point.val));

  const handleSave = () => {
    let newT = Number(localT);
    if (isNaN(newT)) newT = 0;
    newT = Math.max(0, Math.min(maxTime, newT));
    
    let newVal = Number(localVal);
    if (isNaN(newVal)) newVal = 0;
    newVal = Math.max(-50, Math.min(50, newVal));

    onSave({ ...point, t: newT, val: newVal });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1E293B] p-5 rounded-lg border border-slate-700 w-64 shadow-2xl">
        <h4 className="text-white text-sm font-bold mb-4">編輯數值</h4>
        <div className="space-y-3">
          <div>
            <label className="block  text-[12px] text-slate-400 mb-1">時間 (t) {maxTime}s內 </label>
            <input 
              type="text" 
              value={localT} 
              onChange={e => setLocalT(e.target.value)}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block  text-[12px] text-slate-400 mb-1">數值 ({targetVariable})</label>
            <input 
              type="text" 
              value={localVal} 
              onChange={e => setLocalVal(e.target.value)}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button 
            onClick={onDelete}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 font-bold mr-auto"
          >
            刪除
          </button>
          <button 
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white font-bold transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-bold hover:bg-blue-500 transition-colors shadow-sm"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};
