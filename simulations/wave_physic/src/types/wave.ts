export type WaveType = 'longitudinal' | 'transverse' | 'circular';
export type WaveMode = 'traveling' | 'standing';

export interface WaveParams {
  frequency: number; // Hz (頻率 f)
  amplitude: number; // m (振幅 A)
  waveSpeed: number; // m/s (波速 v)
  playbackSpeed: number; // 0.25x, 0.5x, 1x, 2x
}

export interface ViewOptions {
  hideWhiteBeads: boolean; // 隱藏白珠
  showWavelength: boolean; // 顯示波長
  showAmplitude: boolean; // 顯示振幅
  showTrajectory: boolean; // 顯示單珠運動軌跡
  showEquilibrium: boolean; // 顯示平衡位置
  showNodesAndAntinodes: boolean; // 顯示節點與腹點 (駐波)
  showComponents: boolean; // 顯示入射波與反射波 (駐波)
}

export interface Camera3D {
  pitch: number; // radians
  yaw: number; // radians
  distance: number;
  panX: number;
  panY: number;
}

export interface LapRecord {
  id: string;
  lapNumber: number;
  time: number; // seconds
  lapTime: number; // seconds
}

export interface TimeAction {
  type: 'step' | 'reset';
  delta?: number;
  id: number;
}

