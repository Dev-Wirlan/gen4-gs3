export type SpatialType = "AdaptiveCurve" | "ABLine" | "ABCurve" | "Boundary" | "Flags" | "Unknown";
export type Compatibility = "compatible" | "pending" | "unsupported";

export interface SpatialElement {
  id: string;
  guid?: string;
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
  adaptiveCurves: SpatialElement[];
  abLines: SpatialElement[];
  boundaries: SpatialElement[];
  flags: SpatialElement[];
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

export interface MasterSpatialRecord {
  guid: string;
  name: string;
  fieldId?: string;
  path?: string;
  type: SpatialType;
}

export interface CurvePoint {
  longitude: number;
  latitude: number;
  z?: number;
  originalIndex: number;
  lineIndex: number;
}

export interface AdaptiveCurveLine {
  points: CurvePoint[];
}

export interface AdaptiveCurveGeometry {
  curveId?: string;
  referenceLongitude: number;
  referenceLatitude: number;
  curveReference?: CurvePoint;
  firstGeometryPoint?: CurvePoint;
  lines: AdaptiveCurveLine[];
  metadata: Record<string, unknown>;
}

export interface NormalizedCurve {
  curveId?: string;
  referenceLongitude: number;
  referenceLatitude: number;
  curveReference?: CurvePoint;
  firstGeometryPoint?: CurvePoint;
  lines: AdaptiveCurveLine[];
  metadata: Record<string, unknown>;
}

export interface CurveTrackRecord {
  x: number;
  y: number;
  type: number;
}
