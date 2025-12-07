export type CanvasTool =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'pan';

export interface LinePoint {
  x: number;
  y: number;
}

export interface LineBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Line is the unified format - can represent both drawing lines and text
export interface Line {
  id: string;
  tool: CanvasTool;
  color: string;
  thickness: number;
  points: LinePoint[];
  shape?: 'line' | 'rectangle' | 'ellipse';
  bounds?: LineBounds;
  text?: string;
  fontSize?: number;
  textWidth?: number;
  textHeight?: number;
}

// Legacy type alias for backward compatibility during migration
export type Stroke = Line;
export type StrokePoint = LinePoint;
export type StrokeBounds = LineBounds;

// Backend format types - matches what the API expects
export interface LegacyLine {
  id: string;
  tool: string;
  color: string;
  thickness: number;
  points: Array<{ x: number; y: number }>;
  shape?: 'line' | 'rectangle' | 'ellipse';
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  bounds?: { x1: number; y1: number; x2: number; y2: number };
}

export interface LegacyTextBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
  isEditing: boolean;
}

export interface LegacyDrawingData {
  lines: LegacyLine[];
  textBoxes: LegacyTextBox[];
}

