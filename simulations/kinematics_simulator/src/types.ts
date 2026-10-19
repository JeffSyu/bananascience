export type Mode = 'constant' | 'custom';

export type VariableType = 'x' | 'v' | 'a';

export type CustomInputMethod = 'equation' | 'points';

export interface ConstantParams {
  x0: number;
  v0: number;
  a: number;
}

export interface Point {
  id: string;
  t: number;
  val: number;
}

export interface CustomParams {
  targetVariable: VariableType;
  inputMethod: CustomInputMethod;
  equation: string;
  points: Point[];
  x0: number; // Used if target is v or a
  v0: number; // Used if target is a
}

export interface GlobalSettings {
  minX: number;
  maxX: number;
  maxTime: number;
  playbackSpeed: number;
}

export interface SimulationData {
  t: number;
  x: number;
  v: number;
  a: number;
}

