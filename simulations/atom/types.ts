export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  chineseName: string;
  mass: string;
  category: string;
  shells: number[]; // Number of electrons in each shell K, L, M, N...
  config: string; // Textual configuration e.g., "[Ar] 4s2 3d10"
  radius: string;
  electronegativity: string;
  oxidationStates: string;
  commonIons: string;
}

export type ElementCategory = 
  | "Alkali Metal"
  | "Alkaline Earth Metal"
  | "Transition Metal"
  | "Post-Transition Metal"
  | "Metalloid"
  | "Reactive Nonmetal"
  | "Noble Gas"
  | "Lanthanide"
  | "Actinide"
  | "Unknown";