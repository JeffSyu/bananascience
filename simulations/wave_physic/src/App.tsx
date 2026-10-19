import React, { useState, useEffect, useCallback } from 'react';
import { WaveType, WaveMode, WaveParams, ViewOptions, Camera3D, TimeAction } from './types/wave';
import { TopNav } from './components/TopNav';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { WaveCanvas } from './components/WaveCanvas';
import { BottomMetricsStrip } from './components/BottomMetricsStrip';
import { WaveExplainer } from './components/WaveExplainer';

export default function App() {
  // Mode: 行進波 (traveling) vs 駐波 (standing)
  const [mode, setMode] = useState<WaveMode>('traveling');

  // Wave type: 縱波 (longitudinal), 橫波 (transverse), 圓形波 (circular)
  const [type, setType] = useState<WaveType>('longitudinal');

  // Wave parameters
  const [params, setParams] = useState<WaveParams>({
    frequency: 3.0,
    amplitude: 0.49,
    waveSpeed: 30.0,
    playbackSpeed: 1.0,
  });

  // View & visualization toggles
  const [viewOptions, setViewOptions] = useState<ViewOptions>({
    hideWhiteBeads: false,
    showWavelength: false,
    showAmplitude: false,
    showTrajectory: false,
    showEquilibrium: true,
    showNodesAndAntinodes: true,
    showComponents: false,
  });

  // Highlighted column index
  const [highlightIndex, setHighlightIndex] = useState<number>(36);

  // 3D Camera State
  const [camera, setCamera] = useState<Camera3D>({
    pitch: 0.32,
    yaw: 0.18,
    distance: 28,
    panX: 0,
    panY: 0,
  });

  // Collapsible panels state (default open on wide screens)
  const [isLeftOpen, setIsLeftOpen] = useState<boolean>(true);
  const [isRightOpen, setIsRightOpen] = useState<boolean>(true);

  // Simulation playback state & step/reset signals
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeAction, setTimeAction] = useState<TimeAction | null>(null);

  // Explainer modal state
  const [showExplainer, setShowExplainer] = useState<boolean>(false);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setTimeAction({ type: 'step', delta: -0.02, id: Date.now() });
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setTimeAction({ type: 'step', delta: 0.02, id: Date.now() });
  }, []);

  const handleResetSimTime = useCallback(() => {
    setTimeAction({ type: 'reset', id: Date.now() });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === '[') {
        e.preventDefault();
        handleStepBack();
      } else if (e.key === ']') {
        e.preventDefault();
        handleStepForward();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetSimTime();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleStepBack, handleStepForward, handleResetSimTime]);

  const handleResetAll = useCallback(() => {
    setParams({
      frequency: 3.0,
      amplitude: 0.49,
      waveSpeed: 30.0,
      playbackSpeed: 1.0,
    });
    setHighlightIndex(36);
    setIsPlaying(true);
    setCamera({
      pitch: 0.32,
      yaw: 0.18,
      distance: 28,
      panX: 0,
      panY: 0,
    });
    setViewOptions({
      hideWhiteBeads: false,
      showWavelength: false,
      showAmplitude: false,
      showTrajectory: false,
      showEquilibrium: true,
      showNodesAndAntinodes: true,
      showComponents: false,
    });
    setTimeAction({ type: 'reset', id: Date.now() });
  }, []);

  // Quick Educational Presets
  const applyPreset = useCallback((preset: 'sound' | 'water' | 'rope' | 'standing_node') => {
    if (preset === 'sound') {
      setMode('traveling');
      setType('longitudinal');
      setParams({ frequency: 1.5, amplitude: 0.15, waveSpeed: 15.0, playbackSpeed: 1.0 });
      setViewOptions((prev) => ({ ...prev, showWavelength: true, showAmplitude: true, hideWhiteBeads: false }));
    } else if (preset === 'water') {
      setMode('traveling');
      setType('circular');
      setParams({ frequency: 1.5, amplitude: 0.4, waveSpeed: 18.0, playbackSpeed: 1.0 });
      setViewOptions((prev) => ({ ...prev, hideWhiteBeads: false, showTrajectory: true, showWavelength: true }));
    } else if (preset === 'rope') {
      setMode('traveling');
      setType('transverse');
      setParams({ frequency: 1.5, amplitude: 0.5, waveSpeed: 20.0, playbackSpeed: 1.0 });
      setViewOptions((prev) => ({ ...prev, showWavelength: true, showAmplitude: true, hideWhiteBeads: false }));
    } else if (preset === 'standing_node') {
      setMode('standing');
      setType('transverse');
      setParams({ frequency: 1.0, amplitude: 0.7, waveSpeed: 20.0, playbackSpeed: 1.0 });
      setViewOptions((prev) => ({ ...prev, showNodesAndAntinodes: true, showComponents: true, showWavelength: true }));
    }
    setTimeAction({ type: 'reset', id: Date.now() });
  }, []);

  const handleModeChange = useCallback((newMode: WaveMode) => {
    setMode(newMode);
    setTimeAction({ type: 'reset', id: Date.now() });
  }, []);

  const handleTypeChange = useCallback((newType: WaveType) => {
    setType(newType);
    setTimeAction({ type: 'reset', id: Date.now() });
  }, []);

  const handleToggleLeft = useCallback(() => setIsLeftOpen((prev) => !prev), []);
  const handleToggleRight = useCallback(() => setIsRightOpen((prev) => !prev), []);
  const handleOpenExplainer = useCallback(() => setShowExplainer(true), []);
  const handleCloseExplainer = useCallback(() => setShowExplainer(false), []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top Bar with Mode Switching and Panel Controls */}
      <TopNav
        mode={mode}
        onModeChange={handleModeChange}
        onOpenExplainer={handleOpenExplainer}
        onResetAll={handleResetAll}
      />

      {/* Main Multi-Panel Workspace (No Page Scroll) */}
      <div className="flex-1 w-full flex flex-row overflow-hidden relative">
        {/* Left Collapsible Panel: Source & Medium Parameters */}
        <LeftPanel
          isOpen={isLeftOpen}
          onToggle={handleToggleLeft}
          type={type}
          onTypeChange={handleTypeChange}
          params={params}
          onParamsChange={setParams}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
          highlightIndex={highlightIndex}
          onHighlightIndexChange={setHighlightIndex}
        />

        {/* Center Canvas Stage & Bottom Metrics Strip */}
        <div className="flex-1 h-full flex flex-col overflow-hidden relative min-w-0">
          <WaveCanvas
            mode={mode}
            type={type}
            params={params}
            viewOptions={viewOptions}
            highlightIndex={highlightIndex}
            camera={camera}
            onCameraChange={setCamera}
            isPlaying={isPlaying}
            timeAction={timeAction}
          />

          {/* Compact 1-line mathematical physics strip */}
          <BottomMetricsStrip params={params} mode={mode} />
        </div>

        {/* Right Collapsible Panel: Observation Toggles, Presets, and Stopwatch */}
        <RightPanel
          isOpen={isRightOpen}
          onToggle={handleToggleRight}
          mode={mode}
          type={type}
          viewOptions={viewOptions}
          onViewOptionsChange={setViewOptions}
          onApplyPreset={applyPreset}
          isSimRunning={isPlaying}
        />
      </div>

      {/* Educational Guide Modal */}
      <WaveExplainer isOpen={showExplainer} onClose={handleCloseExplainer} />
    </div>
  );
}
