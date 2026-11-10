export interface InspectorInfo {
  name: string;
  icon: string;
  state: string;
  mass: number;
  velocity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  material: string;
  colliders: number;
  health: string;
  extra: string;
}
