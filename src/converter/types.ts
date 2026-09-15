export type SpatialType = "AdaptiveCurve" | "ABCurve" | "Boundary" | "Flags" | "Unknown";
export type Compatibility = "compatible" | "pending" | "unsupported";

export interface SpatialElement {
  id: string;
  name: string;
  path: string;
  type: SpatialType;
  compatibility: Compatibility;
  fieldId?: string;
}

export interface FieldNode {
  id: string;
  name: string;
  spatial: SpatialElement[];
}

export interface FarmNode {
  id: string;
  name: string;
  fields: FieldNode[];
}

export interface ClientNode {
  id: string;
  name: string;
  farms: FarmNode[];
}

export interface ProjectAnalysis {
  fileName: string;
  fileSize: number;
  zipStatus: "valid" | "invalid";
  masterDataFound: boolean;
  gjsonCount: number;
  clients: ClientNode[];
  unassigned: SpatialElement[];
  spatial: SpatialElement[];
  warnings: string[];
}

export interface AdaptiveCurveGeometry {
  lines: Array<Array<[number, number]>>;
  referenceLongitude: number;
  referenceLatitude: number;
}