import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Mode, ConstantParams, CustomParams, GlobalSettings } from './types';
import { generateConstantMotionData, generateCustomMotionData, findCurrentDataPoint } from './utils/physics';
import { ControlPanel } from './components/ControlPanel';
import { CustomModePanel } from './components/CustomModePanel';
import { Graphs } from './components/Graphs';
import { Simulator } from './components/Simulator';
import { Play, Pause, SkipBack, Rewind, ChevronLeft, ChevronRight, Settings, Motorbike } from 'lucide-react';

const PolylineIcon = ({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M 4 20 L 9 9 L 15 14 L 21 4" />
  </svg>
);

const HalfParabolaIcon = ({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M 4 20 Q 12 20 20 4 L 17 5 M 20 4 L 21 7" />
  </svg>
);

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  onSave: (s: GlobalSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState({
    minX: String(settings.minX),
    maxX: String(settings.maxX),
    maxTime: String(settings.maxTime),
    playbackSpeed: settings.playbackSpeed,
  });

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({
        minX: String(settings.minX),
        maxX: String(settings.maxX),
        maxTime: String(settings.maxTime),
        playbackSpeed: settings.playbackSpeed,
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    let minX = Number(localSettings.minX);
    if (isNaN(minX)) minX = 0;
    let maxX = Number(localSettings.maxX);
    if (isNaN(maxX)) maxX = 0;
    let maxTime = Number(localSettings.maxTime);
    if (isNaN(maxTime) || maxTime < 0) maxTime = 10;
    if (maxTime > 500) maxTime = 500;
    
    onSave({
      minX,
      maxX,
      maxTime,
      playbackSpeed: localSettings.playbackSpeed
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1E293B] p-6 rounded-lg border border-slate-700 w-80 shadow-2xl">
        <h2 className="text-white text-base font-bold mb-4 flex items-center gap-2">
          <Settings size={18} />
          系統設定
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">模擬範圍下限 (min X)</label>
            <input 
              type="text" 
              value={localSettings.minX} 
              onChange={e => setLocalSettings({...localSettings, minX: e.target.value})}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">模擬範圍上限 (max X)</label>
            <input 
              type="text" 
              value={localSettings.maxX} 
              onChange={e => setLocalSettings({...localSettings, maxX: e.target.value})}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">模擬時間上限 (s)</label>
            <input 
              type="text" 
              value={localSettings.maxTime} 
              onChange={e => setLocalSettings({...localSettings, maxTime: e.target.value})}
              className="w-full bg-[#0F172A] border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 flex justify-between">
              <span>模擬速度</span>
              <span className="text-blue-400 font-mono">{localSettings.playbackSpeed}x</span>
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="10" 
              step="0.1"
              value={localSettings.playbackSpeed}
              onChange={e => setLocalSettings({...localSettings, playbackSpeed: Number(e.target.value)})}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded transition-colors"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<Mode>('constant');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rewindMultiplier, setRewindMultiplier] = useState<0 | 1 | 2 | 4>(0);
  const [time, setTime] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [settings, setSettings] = useState<GlobalSettings>({
    minX: -200,
    maxX: 200,
    maxTime: 10,
    playbackSpeed: 1,
  });

  const [constantParams, setConstantParams] = useState<ConstantParams>({
    x0: 0,
    v0: 0,
    a: 2,
  });

  const [customParams, setCustomParams] = useState<CustomParams>({
    targetVariable: 'v',
    inputMethod: 'equation',
    equation: '5 * sin(t)',
    points: [
      { id: '1', t: 0, val: 0 },
      { id: '2', t: 5, val: 20 },
      { id: '3', t: 10, val: 0 }
    ],
    x0: 0,
    v0: 0,
  });

  const animationRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(null);
  
  useEffect(() => {
    if (time > settings.maxTime) {
      setTime(settings.maxTime);
    }
  }, [settings.maxTime, time]);

  const deferredConstantParams = useDeferredValue(constantParams);
  const deferredCustomParams = useDeferredValue(customParams);

  const data = useMemo(() => {
    if (mode === 'constant') {
      return generateConstantMotionData(deferredConstantParams, settings.maxTime);
    } else {
      return generateCustomMotionData(deferredCustomParams, settings.maxTime);
    }
  }, [mode, deferredConstantParams, deferredCustomParams, settings.maxTime]);

  const togglePlay = () => {
    if (isPlaying || rewindMultiplier > 0) {
      setIsPlaying(false);
      setRewindMultiplier(0);
    } else {
      if (time >= settings.maxTime) setTime(0);
      setIsPlaying(true);
      setRewindMultiplier(0);
    }
  };

  const handleRewind = () => {
    setIsPlaying(false);
    if (rewindMultiplier === 0) setRewindMultiplier(1);
    else if (rewindMultiplier === 1) setRewindMultiplier(2);
    else if (rewindMultiplier === 2) setRewindMultiplier(4);
    else if (rewindMultiplier === 4) setRewindMultiplier(1);
  };

  const reset = () => {
    setIsPlaying(false);
    setRewindMultiplier(0);
    setTime(0);
  };

  useEffect(() => {
    if (isPlaying || rewindMultiplier > 0) {
      lastTimeRef.current = performance.now();
      const updateTime = (now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const rawDelta = ((now - lastTimeRef.current) / 1000) * settings.playbackSpeed; // in seconds
        lastTimeRef.current = now;
        
        setTime(prev => {
          if (rewindMultiplier > 0) {
            const next = prev - rawDelta * rewindMultiplier;
            if (next <= 0) {
              setRewindMultiplier(0);
              return 0;
            }
            return next;
          } else {
            const next = prev + rawDelta;
            if (next >= settings.maxTime) {
              setIsPlaying(false);
              return settings.maxTime;
            }
            return next;
          }
        });
        
        animationRef.current = requestAnimationFrame(updateTime);
      };
      animationRef.current = requestAnimationFrame(updateTime);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, rewindMultiplier, settings.playbackSpeed, settings.maxTime]);

  // Find current data point using binary search
  const currentDataPoint = findCurrentDataPoint(data, time);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0F172A] text-slate-200 overflow-hidden font-sans">
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 bg-[#1E293B] border-b border-slate-700 z-20 gap-2 sm:gap-4">
        <div className="hidden sm:flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 text-blue-400">
            <Motorbike size={20} />
            <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap">直線運動實驗室</h1>
          </div>
        </div>

        <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-4 flex-1">
          <button 
            onClick={reset}
            className="p-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            title="重設"
          >
            <SkipBack size={16} />
          </button>
          <button 
            onClick={handleRewind}
            className={`p-2 rounded transition-colors flex items-center gap-1 ${rewindMultiplier > 0 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="倒退"
          >
            <Rewind size={16} />
            {rewindMultiplier > 0 && <span className="text-xs font-bold">{rewindMultiplier}x</span>}
          </button>
          <button 
            onClick={togglePlay}
            className="px-4 sm:px-6 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 shadow-md transition-all flex items-center gap-2 text-sm font-bold"
          >
            {(isPlaying || rewindMultiplier > 0) ? <Pause size={16} /> : <Play size={16} />}
            <span className="hidden sm:inline">{(isPlaying || rewindMultiplier > 0) ? 'PAUSE' : 'RUN'}</span>
          </button>
        </div>
        
        <div className="flex gap-2 flex-1 justify-end">
          <div className="flex bg-slate-800 p-1 rounded-md border border-slate-700">
            <button
              onClick={() => setMode('constant')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${mode === 'constant' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="等加速度模式"
            >
              <HalfParabolaIcon size={14} />
              <span className="hidden lg:inline">等加速度模式</span>
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${mode === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="自訂運動模式"
            >
              <PolylineIcon size={14} />
              <span className="hidden lg:inline">自訂運動模式</span>
            </button>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 ml-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <aside className={`absolute top-0 bottom-0 left-0 ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'} bg-[#111827] border-r border-slate-800 flex flex-col overflow-y-auto overflow-x-hidden transition-transform duration-300 ease-in-out z-30 shadow-2xl`}>
          <div className="w-80 p-4 flex flex-col gap-6">
            {mode === 'constant' ? (
              <ControlPanel params={constantParams} onChange={setConstantParams} />
            ) : (
              <CustomModePanel params={customParams} onChange={setCustomParams} maxTime={settings.maxTime} />
            )}
          </div>
        </aside>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-16 bg-[#1E293B] border-y border-r border-slate-700 rounded-r-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-transform duration-300 ease-in-out z-40 cursor-pointer shadow-[2px_0_5px_rgba(0,0,0,0.2)] ${isSidebarOpen ? 'translate-x-80' : 'translate-x-0'}`}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1d] z-10 w-full">
          <Simulator currentX={currentDataPoint.x} currentV={currentDataPoint.v} currentA={currentDataPoint.a} minX={settings.minX} maxX={settings.maxX} />
          <div className="flex-1 overflow-y-auto p-4">
            <Graphs data={data} currentTime={time} maxTime={settings.maxTime} />
          </div>
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onSave={(s) => {
          setSettings(s);
          setIsSettingsOpen(false);
        }} 
      />
    </div>
  );
}
