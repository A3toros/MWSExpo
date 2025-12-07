import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Canvas, Group, Path, Rect, Skia, Text as SkiaText, useFont, useTouchHandler, type SkPath } from '@shopify/react-native-skia';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { CanvasTool, Line, LegacyDrawingData, LegacyTextBox } from '../types/drawing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;
const DEFAULT_COLORS = ['#111827', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7'];
const DEFAULT_THICKNESSES = [2, 4, 6, 10, 16];
const PAN_MOMENTUM_FACTOR = 0.2;
const PINCH_MOMENTUM_FACTOR = 0.05;
const MOMENTUM_DURATION = 240;
const RESET_DURATION = 220;
const MOMENTUM_EASING = Easing.out(Easing.cubic);
const MIN_DRAW_DISTANCE = 0.75;
const ICON_COLOR = '#e2e8f0';
const ICON_ACTIVE = '#38bdf8';
const ICON_DISABLED = '#475569';

type LinePoint = Line['points'][number];

interface ShapePreview {
  tool: 'line' | 'rectangle' | 'ellipse';
  start: { x: number; y: number };
  current: { x: number; y: number };
}

const distanceBetweenPoints = (a: LinePoint, b: LinePoint) => {
  'worklet';
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const buildSmoothPath = (points: LinePoint[]) => {
  const path = Skia.Path.Make();
  if (!points.length) return path;
  path.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    return path;
  }
  if (points.length === 2) {
    path.lineTo(points[1].x, points[1].y);
    return path;
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path.quadTo(current.x, current.y, midX, midY);
  }
  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  path.quadTo(penultimate.x, penultimate.y, last.x, last.y);
  return path;
};

const buildLinePath = (line: Line) => {
  if (line.shape === 'line' && line.points.length) {
    const path = Skia.Path.Make();
    const start = line.points[0];
    const end = line.points[line.points.length - 1] ?? start;
    path.moveTo(start.x, start.y);
    path.lineTo(end.x, end.y);
    return path;
  }

  if (line.shape === 'rectangle' && line.bounds) {
    const { x1, y1, x2, y2 } = line.bounds;
    const path = Skia.Path.Make();
    path.addRect({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    return path;
  }

  if (line.shape === 'ellipse' && line.bounds) {
    const { x1, y1, x2, y2 } = line.bounds;
    const path = Skia.Path.Make();
    path.addOval({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    return path;
  }

  return buildSmoothPath(line.points);
};

// Ensure the active line in refs is reflected in React state immediately
// Used at stroke end so the line persists when preview is cleared
const syncLineToStateImmediate = (
  lineId: string | null,
  linesRefCurrent: Line[],
  setLinesState: React.Dispatch<React.SetStateAction<Line[]>>,
) => {
  if (!lineId) return;
  const refLine = linesRefCurrent.find((l) => l.id === lineId);
  if (!refLine) return;
  setLinesState((prev) => {
    const idx = prev.findIndex((l) => l.id === lineId);
    if (idx === -1) {
      return [...prev, { ...refLine, points: refLine.points.slice() }];
    }
    const updated = prev.slice();
    updated[idx] = { ...refLine, points: refLine.points.slice() };
    return updated;
  });
};

// Fast preview path builder - simple line connection without smoothing for real-time performance
// Uses sliding window: only last 100 points for constant-time performance (like Sketchbook)
const buildFastPreviewPath = (points: LinePoint[]) => {
  if (points.length < 2) return null;
  const path = Skia.Path.Make();
  
  // Sliding window: only use last 100 points for preview (constant time, no exponential lag)
  // This matches how professional apps like Sketchbook handle preview rendering
  const PREVIEW_WINDOW_SIZE = 100;
  const startIndex = points.length > PREVIEW_WINDOW_SIZE ? points.length - PREVIEW_WINDOW_SIZE : 0;
  const previewPoints = points.slice(startIndex);
  
  if (previewPoints.length < 2) return null;
  
  path.moveTo(previewPoints[0].x, previewPoints[0].y);
  for (let i = 1; i < previewPoints.length; i++) {
    path.lineTo(previewPoints[i].x, previewPoints[i].y);
  }
  return path;
};

const buildPreviewPath = (preview: ShapePreview) => {
  const { start, current, tool } = preview;
  const path = Skia.Path.Make();
  if (tool === 'line') {
    path.moveTo(start.x, start.y);
    path.lineTo(current.x, current.y);
    return path;
  }
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  if (tool === 'rectangle') {
    path.addRect({ x: minX, y: minY, width, height });
  } else if (tool === 'ellipse') {
    path.addOval({ x: minX, y: minY, width, height });
  }
  return path;
};

interface CanvasSize {
  width: number;
  height: number;
}

const clampPanWorklet = (
  rawX: number,
  rawY: number,
  zoomLevel: number,
  viewportWidth: number,
  viewportHeight: number,
  logicalWidth: number,
  logicalHeight: number,
) => {
  'worklet';
  const contentWidth = logicalWidth * zoomLevel;
  const contentHeight = logicalHeight * zoomLevel;
  const extraWidth = viewportWidth - contentWidth;
  const extraHeight = viewportHeight - contentHeight;
  
  // When content is smaller than viewport (zoomed out), allow free panning
  // When content is larger than viewport (zoomed in), clamp to prevent showing empty space
  if (extraWidth >= 0) {
    // Content smaller than viewport - allow panning (no clamp or very loose clamp)
    // Allow panning within reasonable bounds (e.g., ±viewport size)
    const minX = -viewportWidth;
    const maxX = viewportWidth;
    const minY = -viewportHeight;
    const maxY = viewportHeight;
    return {
      x: Math.max(minX, Math.min(maxX, rawX)),
      y: Math.max(minY, Math.min(maxY, rawY)),
    };
  } else {
    // Content larger than viewport - clamp to prevent empty space
    const minX = extraWidth;
    const maxX = 0;
    const minY = extraHeight;
    const maxY = 0;
    return {
      x: Math.max(minX, Math.min(maxX, rawX)),
      y: Math.max(minY, Math.min(maxY, rawY)),
    };
  }
};

const clampPanJS = (
  rawX: number,
  rawY: number,
  zoomLevel: number,
  viewport: CanvasSize,
  logical: CanvasSize,
) => {
  const contentWidth = logical.width * zoomLevel;
  const contentHeight = logical.height * zoomLevel;
  const extraWidth = viewport.width - contentWidth;
  const extraHeight = viewport.height - contentHeight;
  const minX = extraWidth >= 0 ? extraWidth / 2 : extraWidth;
  const maxX = extraWidth >= 0 ? extraWidth / 2 : 0;
  const minY = extraHeight >= 0 ? extraHeight / 2 : extraHeight;
  const maxY = extraHeight >= 0 ? extraHeight / 2 : 0;
  return {
    x: Math.max(minX, Math.min(maxX, rawX)),
    y: Math.max(minY, Math.min(maxY, rawY)),
  };
};

export interface FullscreenCanvasSnapshot extends LegacyDrawingData {
  tool: CanvasTool;
  color: string;
  thickness: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface FullscreenCanvasProps {
  initialLines?: Line[];
  initialTextBoxes?: LegacyTextBox[];
  initialTool?: CanvasTool;
  initialColor?: string;
  initialThickness?: number;
  colorPalette?: string[];
  thicknessOptions?: number[];
  onChange?: (snapshot: FullscreenCanvasSnapshot) => void;
  onExit?: (snapshot: FullscreenCanvasSnapshot) => void;
}

const FullscreenCanvas: React.FC<FullscreenCanvasProps> = ({
  initialLines = [],
  initialTextBoxes = [],
  initialTool = 'pencil',
  initialColor,
  initialThickness,
  colorPalette = DEFAULT_COLORS,
  thicknessOptions = DEFAULT_THICKNESSES,
  onChange,
  onExit,
}) => {
  const canvasWidth = SCREEN_WIDTH;
  const canvasHeight = SCREEN_HEIGHT;

  const [selectedTool, setSelectedTool] = useState<CanvasTool>(initialTool);
  const selectedToolRef = useRef<CanvasTool>(initialTool); // For JS thread access
  const selectedToolShared = useSharedValue<CanvasTool>(initialTool); // For worklet access - THIS IS THE KEY!
  const toolAtStartRef = useRef<CanvasTool>(initialTool); // Capture tool at stroke start
  const [color, setColor] = useState(initialColor ?? colorPalette[0]);
  const [thickness, setThickness] = useState(initialThickness ?? thicknessOptions[1]);
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [textBoxes, setTextBoxes] = useState<LegacyTextBox[]>(initialTextBoxes);
  const [undoneLines, setUndoneLines] = useState<Line[]>([]);
  const [undoneTextBoxes, setUndoneTextBoxes] = useState<LegacyTextBox[]>([]);
  const [zoomSnapshot, setZoomSnapshot] = useState(1);
  const [panSnapshot, setPanSnapshot] = useState({ x: 0, y: 0 });
  const [showBrushSheet, setShowBrushSheet] = useState(false);
  const [showColorSheet, setShowColorSheet] = useState(false);
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);

  const canvasViewportRef = useRef<CanvasSize>({ width: canvasWidth, height: canvasHeight });
  const logicalSizeRef = useRef<CanvasSize>({ width: canvasWidth, height: canvasHeight });
  const viewportWidth = useSharedValue(canvasWidth);
  const viewportHeight = useSharedValue(canvasHeight);
  const logicalWidth = useSharedValue(canvasWidth);
  const logicalHeight = useSharedValue(canvasHeight);
  const activeLineIdRef = useRef<string | null>(null);
  const activeLineIdShared = useSharedValue<string | null>(null);
  const activeLinePreviewRef = useRef<{ id: string; points: LinePoint[]; color: string; thickness: number; tool: string } | null>(null);
  const activeLinePreviewPathRef = useRef<SkPath | null>(null);
  const [activeLinePreviewVersion, setActiveLinePreviewVersion] = useState(0);
  const linesRef = useRef<Line[]>(initialLines);
  const textBoxesRef = useRef(initialTextBoxes);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const linePathCacheRef = useRef<Map<string, { path: SkPath; version: number }>>(new Map());
  const pendingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const shapeDraftRef = useRef<ShapePreview | null>(null);
  const shapePreviewRef = useRef<ShapePreview | null>(null);
  const [shapePreviewVersion, setShapePreviewVersion] = useState(0); // Version counter to trigger re-render
  const [isTextModalVisible, setIsTextModalVisible] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textFontSize, setTextFontSize] = useState(24);
  const textPositionRef = useRef<{ x: number; y: number } | null>(null);
  const textBoxDraftRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const textBoxPreviewRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [textBoxPreviewVersion, setTextBoxPreviewVersion] = useState(0); // Version counter to trigger re-render
  const previewUpdateRafRef = useRef<number | null>(null);

  // Load base font for text rendering (we'll use a reasonable default size)
  const baseFont = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 16);

  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const gestureBlock = useSharedValue(0);
  const toolAtStartShared = useSharedValue<CanvasTool>(initialTool);
  
  // Two-finger gesture tracking (like web app - raw touch events)
  const lastTouchCenter = useSharedValue<{ x: number; y: number } | null>(null);
  const lastTouchDistance = useSharedValue<number | null>(null);
  const twoFingerStartZoom = useSharedValue(1);
  const twoFingerStartPanX = useSharedValue(0);
  const twoFingerStartPanY = useSharedValue(0);
  
  // Single-finger pan tracking (when pan tool is active)
  const singleFingerPanStart = useSharedValue<{ x: number; y: number } | null>(null);
  const singleFingerPanOrigin = useSharedValue<{ x: number; y: number }>({ x: 0, y: 0 });
  const singleFingerPanActive = useSharedValue(false); // Track if pan is active (after touch slop)
  const TOUCH_SLOP = 5; // Reduced threshold for smoother pan activation (was 10)

  useEffect(() => {
    linePathCacheRef.current.clear();
    setLines(initialLines);
    setTextBoxes(initialTextBoxes);
  }, [initialLines, initialTextBoxes, initialTool]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // Update ref immediately when tool changes (before useEffect)
  const setTool = useCallback((tool: CanvasTool) => {
    const previousTool = selectedToolRef.current;
    selectedToolRef.current = tool; // Update ref for JS thread
    selectedToolShared.value = tool; // Update shared value for worklets - CRITICAL!
    setSelectedTool(tool);
  }, [selectedToolShared]);

  useEffect(() => {
    selectedToolRef.current = selectedTool; // Also update in useEffect for safety
    selectedToolShared.value = selectedTool; // Update shared value for worklets
    // Cancel any active stroke when switching to pan tool
    if (selectedTool === 'pan') {
      // Cancel any pending flush
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
      pendingPointsRef.current = [];
      
      // Clear preview
      activeLinePreviewRef.current = null;
      activeLinePreviewPathRef.current = null;
      setActiveLinePreviewVersion((v) => v + 1);
      
      // Cancel preview update RAF
      if (previewUpdateRafRef.current !== null) {
        cancelAnimationFrame(previewUpdateRafRef.current);
        previewUpdateRafRef.current = null;
      }
      
      // Clear active line
      activeLineIdRef.current = null;
      activeLineIdShared.value = null;
    }
  }, [selectedTool]);

  useEffect(() => {
    textBoxesRef.current = textBoxes;
  }, [textBoxes]);

  const buildSnapshot = useCallback((): FullscreenCanvasSnapshot => {
    const { width: logicalWidthCurrent, height: logicalHeightCurrent } = logicalSizeRef.current;
    return {
      lines,
      textBoxes,
      tool: selectedTool,
      color,
      thickness,
      canvasWidth: logicalWidthCurrent,
      canvasHeight: logicalHeightCurrent,
    };
  }, [color, lines, selectedTool, textBoxes, thickness]);

  useEffect(() => {
    if (onChange) {
      onChange(buildSnapshot());
    }
  }, [buildSnapshot, onChange]);

  // Web app pattern: Throttle React state updates using RAF (like rafThrottle)
  const panZoomRafRef = useRef<number | null>(null);
  const pendingPanZoomRef = useRef<{ zoom: number; panX: number; panY: number } | null>(null);
  
  const updateZoomPanState = useCallback((nextZoom: number, nextPanX: number, nextPanY: number) => {
    // Update refs immediately (for immediate access in callbacks)
    zoomRef.current = nextZoom;
    panRef.current = { x: nextPanX, y: nextPanY };
    
    // Store pending state update
    pendingPanZoomRef.current = { zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    
    // Web app's rafThrottle pattern: cancel previous RAF, schedule new one
    if (panZoomRafRef.current !== null) {
      cancelAnimationFrame(panZoomRafRef.current);
    }
    
    panZoomRafRef.current = requestAnimationFrame(() => {
      if (pendingPanZoomRef.current) {
        // Update React state (triggers re-render) - throttled to 60fps
        setZoomSnapshot(pendingPanZoomRef.current.zoom);
        setPanSnapshot({ x: pendingPanZoomRef.current.panX, y: pendingPanZoomRef.current.panY });
        pendingPanZoomRef.current = null;
      }
      panZoomRafRef.current = null;
    });
  }, []);

  // Sync shared values to React state - throttled to 60fps using RAF (like web app)
  useAnimatedReaction(
    () => ({ zoom: zoom.value, panX: panX.value, panY: panY.value }),
    (values) => {
      // Throttle React state updates to 60fps (shared values update immediately on UI thread)
      runOnJS(updateZoomPanState)(values.zoom, values.panX, values.panY);
    },
    [updateZoomPanState],
  );


  const toCanvasPoint = useCallback((x: number, y: number) => {
    const { x: panXValue, y: panYValue } = panRef.current;
    const currentZoom = zoomRef.current;
    return {
      x: (x - panXValue) / currentZoom,
      y: (y - panYValue) / currentZoom,
    };
  }, []);

  const startFreehandStroke = useCallback(
    (point: { x: number; y: number }, providedLineId?: string) => {
      // Use tool captured at stroke start (prevents issues if tool changes mid-stroke)
      const tool = toolAtStartRef.current;
      // CRITICAL: Use ref, not state - state can be stale in callbacks
      const currentTool = selectedToolRef.current;
      
      // CRITICAL: Block drawing when pan tool is active - check refs only (state is async/stale)
      if (tool === 'pan' || currentTool === 'pan') {
        // Also clear any active line that might have been started
        activeLineIdRef.current = null;
        activeLineIdShared.value = null;
        return; // DO NOT CREATE LINE
      }
      
      // Handle text tool differently - create textbox draft
      if (tool === 'text') {
        textBoxDraftRef.current = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
        textBoxPreviewRef.current = { startX: point.x, startY: point.y, endX: point.x, endY: point.y };
        setTextBoxPreviewVersion((v) => v + 1);
        return;
      }

      // Handle shape tools (line, rectangle, ellipse) - create shape draft
      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        const preview: ShapePreview = {
          tool: tool,
          start: point,
          current: point,
        };
        shapeDraftRef.current = preview;
        shapePreviewRef.current = preview;
        setShapePreviewVersion((v) => v + 1);
        return;
      }

      // Handle freehand tools (pencil, eraser)
      // Note: pan tool is already handled and returned early at the start of this function
      const lineId = providedLineId || `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const line: Line = {
        id: lineId,
        tool: tool,
        color,
        thickness,
        points: [point],
      };
      activeLineIdRef.current = lineId;
      // Shared value already set in worklet if providedLineId exists
      if (!providedLineId) {
        activeLineIdShared.value = lineId;
      }
      
      // Create preview for real-time drawing
      activeLinePreviewRef.current = {
        id: lineId,
        points: [point],
        color,
        thickness,
        tool: tool,
      };
      activeLinePreviewPathRef.current = null; // Will be built on first update
      setActiveLinePreviewVersion((v) => v + 1);
      
      // Sketchbook approach: Add to ref immediately, sync to state later
      linesRef.current = [...linesRef.current, line];
      
      // Sync to React state (triggers re-render for onChange callback)
      setLines((prev) => {
        return [...prev, line];
      });
      setUndoneLines([]);
      linePathCacheRef.current.delete(lineId);
    },
    [color, thickness], // Removed selectedTool - we use ref instead
  );

  const flushPendingPoints = useCallback(() => {
    rafIdRef.current = null;
    
    if (pendingPointsRef.current.length === 0) {
      return;
    }

    // Prefer the explicit active id; fall back to preview id if needed (safety)
    const activeId = activeLineIdRef.current || activeLinePreviewRef.current?.id || null;
    if (!activeId) {
      pendingPointsRef.current = [];
      return;
    }

    // Sketchbook approach: Sync ref state to React state periodically
    // The ref already has all points (updated immediately), we just sync to React state
    const activeLine = linesRef.current.find((l) => l.id === activeId);
    if (!activeLine) {
      pendingPointsRef.current = [];
      return;
    }

    // Filter points by minimum distance (already done in ref, but ensure state matches)
    const pointsToAdd = pendingPointsRef.current;
    pendingPointsRef.current = [];

    // Sync ref state to React state - only update the active line
    setLines((prev) => {
      const lineIndex = prev.findIndex((line) => line.id === activeId);
      if (lineIndex === -1) return prev;
      
      // Use the ref's current state (which has all points already)
      const refLine = linesRef.current.find((l) => l.id === activeId);
      if (!refLine) return prev;
      
      // Only update if points actually changed
      const prevLine = prev[lineIndex];
      if (prevLine.points.length === refLine.points.length) {
        return prev; // No change, skip update
      }
      
      linePathCacheRef.current.delete(activeId);
      
      // Create new array with updated line (more efficient than map)
      const updated = prev.slice(); // Clone array
      updated[lineIndex] = {
        ...refLine,
        points: refLine.points.slice(), // Copy points from ref
      };
      return updated;
    });
  }, []);

  const appendFreehandPoint = useCallback((point: { x: number; y: number }, providedLineId?: string) => {
    // Use tool captured at stroke start (prevents issues if tool changes mid-stroke)
    const tool = toolAtStartRef.current;
    // CRITICAL: Use ref, not state - state can be stale in callbacks
    const currentTool = selectedToolRef.current;
    
    // CRITICAL: Block drawing when pan tool is active - check refs only (state is async/stale)
    if (tool === 'pan' || currentTool === 'pan') {
      return; // DO NOT ADD POINTS
    }
    
    // Handle text tool - update textbox draft
    if (tool === 'text' && textBoxDraftRef.current) {
      textBoxDraftRef.current.endX = point.x;
      textBoxDraftRef.current.endY = point.y;
      // Update ref immediately, but only trigger re-render periodically (batched)
      if (previewUpdateRafRef.current === null) {
        previewUpdateRafRef.current = requestAnimationFrame(() => {
          // Batch both preview updates together if needed
          setTextBoxPreviewVersion((v) => v + 1);
          if (shapePreviewRef.current) {
            setShapePreviewVersion((v) => v + 1);
          }
          previewUpdateRafRef.current = null;
        });
      }
      return;
    }

    // Handle shape tools - update shape draft
    if ((tool === 'line' || tool === 'rectangle' || tool === 'ellipse') && shapeDraftRef.current) {
      shapeDraftRef.current.current = point;
      if (shapePreviewRef.current) {
        shapePreviewRef.current.current = point;
      }
      // Update ref immediately, but only trigger re-render periodically (batched)
      if (previewUpdateRafRef.current === null) {
        previewUpdateRafRef.current = requestAnimationFrame(() => {
          // Batch both preview updates together if needed
          setShapePreviewVersion((v) => v + 1);
          if (textBoxPreviewRef.current) {
            setTextBoxPreviewVersion((v) => v + 1);
          }
          previewUpdateRafRef.current = null;
        });
      }
      return;
    }

    const activeId = providedLineId || activeLineIdRef.current || activeLinePreviewRef.current?.id || null;
    if (!activeId) {
      return;
    }

    // Web app pattern: Update preview immediately; throttle React bumps to 60fps
    if (activeLinePreviewRef.current && activeLinePreviewRef.current.id === activeId) {
      // Always update points immediately (like web app's currentLine state update)
      activeLinePreviewRef.current.points.push(point);
      
      // Rebuild preview path immediately for zero-lag feedback
      if (activeLinePreviewRef.current.points.length > 1) {
        activeLinePreviewPathRef.current = buildFastPreviewPath(activeLinePreviewRef.current.points);
        // Trigger re-render at most once per frame (60fps) to reduce JS thrash
        if (previewRafRef.current === null) {
          previewRafRef.current = requestAnimationFrame(() => {
            setActiveLinePreviewVersion((v) => v + 1);
            previewRafRef.current = null;
          });
        }
      }
    }

    // State sync: accumulate points; commit at stroke end to avoid render thrash
    pendingPointsRef.current.push(point);

    // Update the active line in ref immediately (for state sync)
    const activeLine = linesRef.current.find((l) => l.id === activeId);
    if (activeLine) {
      activeLine.points.push(point);
    }

    // Do not flush during stroke; preview is already real-time.
    // We flush once on stroke end (flushAndFinishStroke) to keep React updates minimal.
  }, [selectedTool, flushPendingPoints]);

  const finishFreehandStroke = useCallback(() => {
    // Handle text tool - open modal
    if (selectedTool === 'text' && textBoxDraftRef.current) {
      setIsTextModalVisible(true);
      setTextDraft('');
      return;
    }

    // Handle shape tools - finalize shape
    if ((selectedTool === 'line' || selectedTool === 'rectangle' || selectedTool === 'ellipse') && shapeDraftRef.current) {
      const draft = shapeDraftRef.current;
      const start = draft.start;
      const end = draft.current;
      
      // Only create shape if there's meaningful distance
      const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      if (dist < 5) {
        // Too small, discard
        shapeDraftRef.current = null;
        shapePreviewRef.current = null;
        setShapePreviewVersion((v) => v + 1);
        return;
      }

      const lineId = `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const line: Line = {
        id: lineId,
        tool: selectedTool,
        color,
        thickness,
        points: [start, end], // Store start and end points
        shape: selectedTool === 'line' ? 'line' : selectedTool === 'rectangle' ? 'rectangle' : 'ellipse',
        bounds: {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
        },
      };

      // Sketchbook approach: Update ref immediately
      linesRef.current = [...linesRef.current, line];
      
      setLines((prev) => [...prev, line]);
      setUndoneLines([]);
      linePathCacheRef.current.delete(lineId);
      shapeDraftRef.current = null;
      shapePreviewRef.current = null;
      setShapePreviewVersion((v) => v + 1);
      return;
    }

    const finishedId = activeLineIdRef.current;
    if (!finishedId) {
      // No active stroke - might have been cancelled or already finished
      return;
    }

    // Finalize immediately (no async delay)
    // First ensure React state has the final stroke (from refs)
    syncLineToStateImmediate(finishedId, linesRef.current, setLines);

    const line = linesRef.current.find((item) => item.id === finishedId);
    if (line && line.points.length > 0) {
      linePathCacheRef.current.set(finishedId, {
        path: buildLinePath(line),
        version: line.points.length,
      });
    } else if (line && line.points.length === 0) {
      // Line with no points - remove it
      setLines((prev) => prev.filter((l) => l.id !== finishedId));
    }
    if (activeLineIdRef.current === finishedId) {
      activeLineIdRef.current = null;
      activeLineIdShared.value = null;
      // Clear preview
      activeLinePreviewRef.current = null;
      activeLinePreviewPathRef.current = null;
      setActiveLinePreviewVersion((v) => v + 1);
    }
    pendingPointsRef.current = [];
  }, [selectedTool, color, thickness]);

  const flushAndFinishStroke = useCallback(() => {
    // Flush any pending points first
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushPendingPoints();
    // Then finish the stroke
    finishFreehandStroke();
  }, [finishFreehandStroke, flushPendingPoints]);

  const cancelActiveStroke = useCallback(() => {
    // Cancel any pending flush
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    pendingPointsRef.current = [];
    
    // Clear preview
    activeLinePreviewRef.current = null;
    activeLinePreviewPathRef.current = null;
    setActiveLinePreviewVersion((v) => v + 1);

    // Cancel preview update RAF
    if (previewUpdateRafRef.current !== null) {
      cancelAnimationFrame(previewUpdateRafRef.current);
      previewUpdateRafRef.current = null;
    }

    // Cancel textbox draft if active
    if (selectedTool === 'text' && textBoxDraftRef.current) {
      textBoxDraftRef.current = null;
      textBoxPreviewRef.current = null;
      setTextBoxPreviewVersion((v) => v + 1);
      return;
    }

    // Cancel shape draft if active
    if ((selectedTool === 'line' || selectedTool === 'rectangle' || selectedTool === 'ellipse') && shapeDraftRef.current) {
      shapeDraftRef.current = null;
      shapePreviewRef.current = null;
      setShapePreviewVersion((v) => v + 1);
      return;
    }

    const activeId = activeLineIdRef.current;
    if (!activeId) return;
    activeLineIdRef.current = null;
    activeLineIdShared.value = null;
    linePathCacheRef.current.delete(activeId);
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== activeId);
      return next.length === prev.length ? prev : next;
    });
  }, [selectedTool]);

  const handleTextSubmit = useCallback(() => {
    if (!textDraft.trim() || !textBoxDraftRef.current) {
      setIsTextModalVisible(false);
      textBoxDraftRef.current = null;
      textBoxPreviewRef.current = null;
      setTextBoxPreviewVersion((v) => v + 1);
      return;
    }

    const box = textBoxDraftRef.current;
    const rectX = Math.min(box.startX, box.endX);
    const rectY = Math.min(box.startY, box.endY);
    const rectW = Math.max(Math.abs(box.endX - box.startX), 100); // Minimum width
    const rectH = Math.max(Math.abs(box.endY - box.startY), 40); // Minimum height

    const newTextBox: LegacyTextBox = {
      id: Date.now(),
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      text: textDraft.trim(),
      fontSize: textFontSize,
      color: color,
      isEditing: false,
    };

    setTextBoxes((prev) => [...prev, newTextBox]);
    setUndoneTextBoxes([]);
    setIsTextModalVisible(false);
    setTextDraft('');
    textBoxDraftRef.current = null;
    textBoxPreviewRef.current = null;
    setTextBoxPreviewVersion((v) => v + 1);
  }, [textDraft, textFontSize, color]);

  const handleTextCancel = useCallback(() => {
    setIsTextModalVisible(false);
    setTextDraft('');
    textBoxDraftRef.current = null;
    textBoxPreviewRef.current = null;
    setTextBoxPreviewVersion((v) => v + 1);
  }, []);

  const startStrokeAtPoint = useCallback(
    (x: number, y: number, lineId?: string) => {
      const point = toCanvasPoint(x, y);
      startFreehandStroke(point, lineId);
    },
    [startFreehandStroke, toCanvasPoint],
  );

  const appendStrokePoint = useCallback(
    (x: number, y: number, lineId?: string) => {
      const point = toCanvasPoint(x, y);
      appendFreehandPoint(point, lineId);
    },
    [appendFreehandPoint, toCanvasPoint],
  );

  const handleUndo = useCallback(() => {
    setLines((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice(0, -1);
      const removed = prev[prev.length - 1];
      linePathCacheRef.current.delete(removed.id);
      setUndoneLines((prevUndone) => [removed, ...prevUndone]);
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setUndoneLines((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      linePathCacheRef.current.delete(first.id);
      setLines((prevLines) => [...prevLines, first]);
      return rest;
    });
  }, []);

  const handleClear = useCallback(() => {
    setLines([]);
    setTextBoxes([]);
    setUndoneLines([]);
    setUndoneTextBoxes([]);
    linePathCacheRef.current.clear();
  }, []);

  const updateCanvasViewport = useCallback(
    (layoutWidth: number, layoutHeight: number) => {
      if (!layoutWidth || !layoutHeight) return;
      canvasViewportRef.current = { width: layoutWidth, height: layoutHeight };
      viewportWidth.value = layoutWidth;
      viewportHeight.value = layoutHeight;
    },
    [viewportHeight, viewportWidth],
  );


  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(250)
        .cancelsTouchesInView(false) // Don't cancel single touches - let them reach Canvas
        .onBegin(() => {
          gestureBlock.value = 1;
        })
        .onEnd(() => {
          const vpW = viewportWidth.value;
          const vpH = viewportHeight.value;
          const lgW = logicalWidth.value;
          const lgH = logicalHeight.value;
          const targetZoom = 1;
          const rawX = (vpW - lgW * targetZoom) / 2;
          const rawY = (vpH - lgH * targetZoom) / 2;
          const clamped = clampPanWorklet(rawX, rawY, targetZoom, vpW, vpH, lgW, lgH);
          zoom.value = withTiming(targetZoom, {
            duration: RESET_DURATION,
            easing: MOMENTUM_EASING,
          });
          panX.value = withTiming(clamped.x, {
            duration: RESET_DURATION,
            easing: MOMENTUM_EASING,
          });
          panY.value = withTiming(
            clamped.y,
            {
              duration: RESET_DURATION,
              easing: MOMENTUM_EASING,
            },
          );
          gestureBlock.value = 0;
        })
        .onTouchesCancelled(() => {
          gestureBlock.value = 0;
        }),
    [gestureBlock, logicalHeight, logicalWidth, panX, panY, viewportHeight, viewportWidth, zoom],
  );

  // Two-finger pan gesture - separate from pinch for better control
  const twoFingerPanGesture = useMemo(() => {
    return Gesture.Pan()
        .minPointers(2)
        .cancelsTouchesInView(false)
        .shouldCancelWhenOutside(false)
        .onBegin((event: any) => {
          'worklet';
          const currentTool = selectedToolShared.value; // Use shared value, not ref!
          if (currentTool !== 'pan') {
            return;
          }
          gestureBlock.value = 1;
          runOnJS(cancelActiveStroke)();
          twoFingerStartPanX.value = panX.value;
          twoFingerStartPanY.value = panY.value;
          lastTouchCenter.value = { x: event.x, y: event.y };
        })
        .onUpdate((event: any) => {
          'worklet';
          const currentTool = selectedToolShared.value; // Use shared value, not ref!
          if (currentTool !== 'pan') {
            return;
          }
          if (lastTouchCenter.value) {
            // Web app pattern: Calculate delta from translation (smooth, direct)
            const dx = event.translationX;
            const dy = event.translationY;
            const rawPanX = twoFingerStartPanX.value + dx;
            const rawPanY = twoFingerStartPanY.value + dy;
            
            // Clamp pan values
            const vpW = viewportWidth.value;
            const vpH = viewportHeight.value;
            const lgW = logicalWidth.value;
            const lgH = logicalHeight.value;
            const clamped = clampPanWorklet(rawPanX, rawPanY, zoom.value, vpW, vpH, lgW, lgH);
            
            // Update pan values directly (shared values update on UI thread - smooth)
            // React state updates are throttled via useAnimatedReaction + RAF
            panX.value = clamped.x;
            panY.value = clamped.y;
          }
        })
        .onEnd(() => {
          'worklet';
          gestureBlock.value = 0;
          lastTouchCenter.value = null;
        });
  }, [cancelActiveStroke, gestureBlock, logicalHeight, logicalWidth, panX, panY, twoFingerStartPanX, twoFingerStartPanY, viewportHeight, viewportWidth, zoom]);

  // Two-finger zoom gesture - Pinch handles zoom (scale change)
  // Only enabled when pan tool is active
  const twoFingerZoomGesture = useMemo(() => {
    return Gesture.Pinch()
        .cancelsTouchesInView(false) // Don't cancel Canvas touch handler
        .shouldCancelWhenOutside(false)
        .onBegin((event: any) => {
          'worklet';
          const currentTool = selectedToolShared.value; // Use shared value, not ref!
          // Only allow pinch/pan when pan tool is selected
          if (currentTool !== 'pan') {
            return;
          }
          
          gestureBlock.value = 1;
          runOnJS(cancelActiveStroke)();
          
          // Store initial zoom
          twoFingerStartZoom.value = zoom.value;
          
          // Calculate initial center from focal point (center between two touches)
          const focalX = event.focalX;
          const focalY = event.focalY;
          lastTouchCenter.value = { x: focalX, y: focalY };
          twoFingerStartPanX.value = panX.value;
          twoFingerStartPanY.value = panY.value;
          
        })
        .onUpdate((event: any) => {
          'worklet';
          const currentTool = selectedToolShared.value; // Use shared value, not ref!
          // Only allow zoom when pan tool is selected
          if (currentTool !== 'pan') {
            return;
          }
          
          // Calculate zoom from scale change (pinch gesture)
          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, twoFingerStartZoom.value * event.scale),
          );
          
          // Update zoom (pan is handled by twoFingerPanGesture)
          zoom.value = nextZoom;
          
          // Clamp pan to new zoom level
          const vpW = viewportWidth.value;
          const vpH = viewportHeight.value;
          const lgW = logicalWidth.value;
          const lgH = logicalHeight.value;
          const clamped = clampPanWorklet(panX.value, panY.value, nextZoom, vpW, vpH, lgW, lgH);
          panX.value = clamped.x;
          panY.value = clamped.y;
          
        })
        .onEnd(() => {
          'worklet';
          lastTouchCenter.value = null;
          lastTouchDistance.value = null;
          gestureBlock.value = 0;
        });
  }, [cancelActiveStroke, gestureBlock, logicalHeight, logicalWidth, panX, panY, twoFingerStartPanX, twoFingerStartPanY, twoFingerStartZoom, viewportHeight, viewportWidth, zoom]);

  // Single-finger drawing handler - uses Skia's useTouchHandler
  // Skia's useTouchHandler only provides x, y (no numberOfTouches)
  // For two-finger gestures, GestureDetector sets gestureBlock.value = 1 to block drawing
  const singleFingerDrawingHandler = useTouchHandler({
    onStart: ({ x, y }) => {
      'worklet';
      
      // CRITICAL: Use shared value, not ref - refs don't work in worklets!
      const currentTool = selectedToolShared.value;
      // CRITICAL: Check for pan tool FIRST - before anything else
      if (currentTool === 'pan') {
        const currentPanX = panX.value;
        const currentPanY = panY.value;
        // Capture tool at stroke start
        toolAtStartShared.value = 'pan';
        runOnJS((tool: CanvasTool) => { 
          toolAtStartRef.current = 'pan';
        })('pan');
        singleFingerPanStart.value = { x, y };
        singleFingerPanOrigin.value = { x: currentPanX, y: currentPanY };
        singleFingerPanActive.value = false; // Reset - will activate after touch slop
        return; // CRITICAL: Exit early - do NOT allow drawing
      }
      
      // Capture tool at stroke start (like DrawingCanvas) to prevent issues if tool changes mid-stroke
      toolAtStartShared.value = currentTool;
      runOnJS((tool: CanvasTool) => { toolAtStartRef.current = tool; })(currentTool);
      
      // Only allow drawing if gestureBlock is 0 (no two-finger gesture active)
      // GestureDetector will set gestureBlock.value = 1 when two fingers are detected
      if (gestureBlock.value === 0) {
        const lineId = `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        activeLineIdShared.value = lineId;
        runOnJS(startStrokeAtPoint)(x, y, lineId);
      } else {
      }
    },
    
    onActive: ({ x, y }) => {
      'worklet';
      
      // CRITICAL: Check for pan tool FIRST - before any drawing
      // Use shared value, not ref - refs don't work in worklets!
      const currentToolInActive = selectedToolShared.value;
      if (toolAtStartShared.value === 'pan' || currentToolInActive === 'pan') {
        // If pan start wasn't captured in onStart (race condition), capture it here
        if (!singleFingerPanStart.value) {
          singleFingerPanStart.value = { x, y };
          singleFingerPanOrigin.value = { x: panX.value, y: panY.value };
          singleFingerPanActive.value = false;
          return; // Wait for next frame to start panning
        }
        
        if (singleFingerPanStart.value) {
          const dx = x - singleFingerPanStart.value.x;
          const dy = y - singleFingerPanStart.value.y;
          
          // Check touch slop threshold (like Sketchbook) - only activate pan after threshold
          if (!singleFingerPanActive.value) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance >= TOUCH_SLOP) {
              singleFingerPanActive.value = true;
            } else {
              // Not enough movement yet - don't pan, but also don't draw
              return;
            }
          }
          
          // Web app pattern: Calculate pan position from origin + delta (smooth, direct)
          const rawPanX = singleFingerPanOrigin.value.x + dx;
          const rawPanY = singleFingerPanOrigin.value.y + dy;
          
          // Clamp pan values to bounds
          const vpW = viewportWidth.value;
          const vpH = viewportHeight.value;
          const lgW = logicalWidth.value;
          const lgH = logicalHeight.value;
          const currentZoom = zoom.value;
          const clamped = clampPanWorklet(rawPanX, rawPanY, currentZoom, vpW, vpH, lgW, lgH);
          
          // Update pan values directly (shared values update on UI thread - smooth like web app)
          // React state updates are throttled to 60fps via useAnimatedReaction + RAF
          panX.value = clamped.x;
          panY.value = clamped.y;
          
        } else {
        }
        return;
      }
      
      // Only allow drawing if gestureBlock is 0 (no two-finger gesture active)
      if (gestureBlock.value === 0) {
        let activeId = activeLineIdShared.value;
        
        // FALLBACK: If onStart didn't fire (GestureDetector intercepted), start stroke here
        // BUT ONLY IF NOT PAN TOOL
        if (!activeId) {
          const currentToolInActive = selectedToolShared.value; // Use shared value, not ref!
          if (currentToolInActive === 'pan' || toolAtStartShared.value === 'pan') {
            return;
          }
          activeId = `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          activeLineIdShared.value = activeId;
          runOnJS(startStrokeAtPoint)(x, y, activeId);
          // Don't add point yet - let startStrokeAtPoint handle the first point
          return;
        }
        
        runOnJS(appendStrokePoint)(x, y, activeId);
      } else {
      }
    },
    
    onEnd: () => {
      'worklet';
      
      // Clear single-finger pan if active
      if (toolAtStartShared.value === 'pan') {
        singleFingerPanStart.value = null;
        singleFingerPanActive.value = false;
        return;
      }
      
      // Only finish drawing if gestureBlock is 0 (no two-finger gesture active)
      if (gestureBlock.value === 0) {
        runOnJS(flushAndFinishStroke)();
      } else {
      }
    },
  });

  // Canvas gestures - combine double-tap, two-finger pan, and two-finger zoom
  // Use Simultaneous so all can work together
  // Single-finger drawing is handled by singleFingerDrawingHandler
  const canvasGestures = useMemo(() => {
    return Gesture.Simultaneous(doubleTapGesture, twoFingerPanGesture, twoFingerZoomGesture);
  }, [doubleTapGesture, twoFingerPanGesture, twoFingerZoomGesture]);

  const zoomLabel = useMemo(() => `${Math.round(zoomSnapshot * 100)}%`, [zoomSnapshot]);

  const applyZoomMultiplier = useCallback(
    (multiplier: number) => {
      const viewport = canvasViewportRef.current;
      const logical = logicalSizeRef.current;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * multiplier));
      const clamped = clampPanJS(panRef.current.x, panRef.current.y, nextZoom, viewport, logical);
      if (
        Math.abs(nextZoom - zoomRef.current) < 0.0001 &&
        Math.abs(clamped.x - panRef.current.x) < 0.0001 &&
        Math.abs(clamped.y - panRef.current.y) < 0.0001
      ) {
        return;
      }
      zoom.value = withTiming(nextZoom, {
        duration: RESET_DURATION,
        easing: MOMENTUM_EASING,
      });
      panX.value = withTiming(clamped.x, {
        duration: RESET_DURATION,
        easing: MOMENTUM_EASING,
      });
      panY.value = withTiming(
        clamped.y,
        {
          duration: RESET_DURATION,
          easing: MOMENTUM_EASING,
        },
      );
    },
    [panX, panY, zoom],
  );

  const ToolbarButton = ({
    icon,
    label,
    onPress,
    active,
    disabled,
  }: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    label: string;
    onPress: () => void;
    active?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.iconButton,
        active && styles.iconButtonActive,
        disabled && styles.iconButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={disabled ? ICON_DISABLED : active ? ICON_ACTIVE : ICON_COLOR}
      />
      <Text
        numberOfLines={1}
        style={styles.iconCaption}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const isSheetOpen = showBrushSheet || showColorSheet || showLayerSheet || showToolsSheet;

  const renderLine = useCallback((line: Line) => {
    if (line.points.length === 0) {
      return null;
    }
    const version = line.points.length;
    const cached = linePathCacheRef.current.get(line.id);
    const path = cached && cached.version === version ? cached.path : buildLinePath(line);
    if (!cached || cached.version !== version) {
      linePathCacheRef.current.set(line.id, { path, version });
    }
    const isEraser = line.tool === 'eraser';
    return (
      <Path
        key={line.id}
        path={path}
        color={isEraser ? '#FFFFFF' : line.color}
        style="stroke"
        strokeWidth={isEraser ? line.thickness * 2 : line.thickness}
        strokeCap="round"
        strokeJoin="round"
      />
    );
  }, []);

  // Memoize rendered lines to prevent unnecessary re-renders when lines haven't changed
  // Use lines.length and a hash of line IDs to detect changes more efficiently
  const linesHash = useMemo(() => {
    return lines.map((l) => `${l.id}-${l.points.length}`).join('|');
  }, [lines]);
  
  const renderedLines = useMemo(() => {
    return lines.map(renderLine).filter((line) => line !== null);
  }, [linesHash, renderLine]);

  // Memoize textBoxes rendering to prevent re-rendering all textboxes when only one changes
  const textBoxesHash = useMemo(() => {
    return textBoxes.map((tb) => `${tb.id}-${tb.text?.length || 0}`).join('|');
  }, [textBoxes]);
  
  const renderedTextBoxes = useMemo(() => {
    return textBoxes.map((textBox) => (
      <Group key={textBox.id}>
        <Rect
          x={textBox.x}
          y={textBox.y}
          width={textBox.width}
          height={textBox.height}
          color={textBox.color}
          style="stroke"
          strokeWidth={1}
        />
        {baseFont && textBox.text && (
          <Group
            transform={[
              { translateX: textBox.x + 4 },
              { translateY: textBox.y + textBox.fontSize + 4 },
              { scale: textBox.fontSize / 16 }, // Scale based on fontSize relative to base 16
            ]}
          >
            <SkiaText
              x={0}
              y={0}
              text={textBox.text}
              color={textBox.color}
              font={baseFont}
            />
          </Group>
        )}
      </Group>
    ));
  }, [textBoxesHash, baseFont]);

  const toggleBrushSheet = useCallback(() => {
    setShowBrushSheet((prev) => !prev);
    setShowColorSheet(false);
    setShowLayerSheet(false);
    setShowToolsSheet(false);
  }, []);

  const toggleColorSheet = useCallback(() => {
    setShowColorSheet((prev) => !prev);
    setShowBrushSheet(false);
    setShowLayerSheet(false);
    setShowToolsSheet(false);
  }, []);

  const toggleLayerSheet = useCallback(() => {
    setShowLayerSheet((prev) => !prev);
    setShowBrushSheet(false);
    setShowColorSheet(false);
    setShowToolsSheet(false);
  }, []);

  const toggleToolsSheet = useCallback(() => {
    setShowToolsSheet((prev) => !prev);
    setShowBrushSheet(false);
    setShowColorSheet(false);
    setShowLayerSheet(false);
  }, []);

  const closeAllSheets = useCallback(() => {
    setShowBrushSheet(false);
    setShowColorSheet(false);
    setShowLayerSheet(false);
    setShowToolsSheet(false);
  }, []);

  const handleResetView = useCallback(() => {
    const viewport = canvasViewportRef.current;
    const logical = logicalSizeRef.current;
    const targetZoom = 1;
    const rawX = (viewport.width - logical.width * targetZoom) / 2;
    const rawY = (viewport.height - logical.height * targetZoom) / 2;
    const clamped = clampPanJS(rawX, rawY, targetZoom, viewport, logical);
    zoom.value = withTiming(targetZoom, {
      duration: RESET_DURATION,
      easing: MOMENTUM_EASING,
    });
    panX.value = withTiming(clamped.x, {
      duration: RESET_DURATION,
      easing: MOMENTUM_EASING,
    });
    panY.value = withTiming(clamped.y, {
      duration: RESET_DURATION,
      easing: MOMENTUM_EASING,
    });
    closeAllSheets();
  }, [closeAllSheets, panX, panY, zoom]);

  const handleExit = useCallback(() => {
    closeAllSheets();
    onExit?.(buildSnapshot());
  }, [buildSnapshot, closeAllSheets, onExit]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={handleExit}>
          <MaterialCommunityIcons name="close" size={26} color={ICON_COLOR} />
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topToolbarRow}
          style={styles.topToolbarScroll}
        >
          <ToolbarButton 
            icon="hand-back-left" 
            label="Pan" 
            onPress={() => {
              setTool('pan');
            }} 
            disabled={false}
            active={selectedTool === 'pan'}
          />
          <ToolbarButton icon="undo-variant" label="Undo" onPress={handleUndo} disabled={!lines.length} />
          <ToolbarButton icon="redo-variant" label="Redo" onPress={handleRedo} disabled={!undoneLines.length} />
          <ToolbarButton icon="trash-can-outline" label="Clear" onPress={handleClear} disabled={!lines.length && !textBoxes.length} />
        </ScrollView>
      </View>

      <View
        style={styles.canvasShell}
        onLayout={(event) => {
          const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
          updateCanvasViewport(layoutWidth, layoutHeight);
          logicalSizeRef.current = { width: layoutWidth, height: layoutHeight };
          logicalWidth.value = layoutWidth;
          logicalHeight.value = layoutHeight;
        }}
      >
        <GestureDetector gesture={canvasGestures}>
          <Canvas 
            style={styles.canvasSurface} 
            onTouch={singleFingerDrawingHandler}
            onLayout={() => {
            }}
          >
            <Group
              transform={[
                { translateX: panSnapshot.x },
                { translateY: panSnapshot.y },
                { scale: zoomSnapshot },
              ]}
            >
              {renderedLines}
              {/* Render active line preview for real-time drawing - optimized to prevent lag */}
              {activeLinePreviewRef.current && activeLinePreviewPathRef.current && activeLinePreviewRef.current.points.length > 1 && (() => {
                const preview = activeLinePreviewRef.current!;
                const isEraser = preview.tool === 'eraser';
                // Use cached path to avoid rebuilding on every render
                return (
                  <Path
                    key={`preview-${preview.id}-${activeLinePreviewVersion}`}
                    path={activeLinePreviewPathRef.current}
                    color={isEraser ? '#FFFFFF' : preview.color}
                    style="stroke"
                    strokeWidth={isEraser ? preview.thickness * 2 : preview.thickness}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                );
              })()}
              {/* Render textboxes */}
              {renderedTextBoxes}
              {/* Render shape preview while drawing */}
              {shapePreviewRef.current && (
                <Path
                  path={buildPreviewPath(shapePreviewRef.current)}
                  color={color}
                  style="stroke"
                  strokeWidth={thickness}
                  strokeCap="round"
                  strokeJoin="round"
                />
              )}
              {/* Render textbox preview while drawing */}
              {textBoxPreviewRef.current && (
                <Rect
                  x={Math.min(textBoxPreviewRef.current.startX, textBoxPreviewRef.current.endX)}
                  y={Math.min(textBoxPreviewRef.current.startY, textBoxPreviewRef.current.endY)}
                  width={Math.abs(textBoxPreviewRef.current.endX - textBoxPreviewRef.current.startX)}
                  height={Math.abs(textBoxPreviewRef.current.endY - textBoxPreviewRef.current.startY)}
                  color={color}
                  style="stroke"
                  strokeWidth={1}
                />
              )}
            </Group>
          </Canvas>
        </GestureDetector>
      </View>

      <View style={styles.bottomStripContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomStrip}
        >
          <TouchableOpacity
            style={[styles.quickButton, showColorSheet && styles.quickButtonActive]}
            onPress={toggleColorSheet}
          >
            <View style={[styles.colorSwatchFill, { backgroundColor: color }]} />
            <Text style={styles.quickLabel}>Color</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, showToolsSheet && styles.quickButtonActive]}
            onPress={toggleToolsSheet}
          >
            <MaterialCommunityIcons 
              name={
                selectedTool === 'pencil' ? 'pencil' :
                selectedTool === 'line' ? 'vector-line' :
                selectedTool === 'ellipse' ? 'circle-outline' :
                selectedTool === 'rectangle' ? 'square-outline' :
                selectedTool === 'text' ? 'format-text' :
                selectedTool === 'pan' ? 'hand-back-left' :
                'tools'
              } 
              size={20} 
              color={ICON_COLOR} 
            />
            <Text style={styles.quickLabel}>Tools</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, showBrushSheet && styles.quickButtonActive]}
            onPress={toggleBrushSheet}
          >
            <MaterialCommunityIcons name="brush" size={20} color={ICON_COLOR} />
            <Text style={styles.quickLabel}>Size {thickness}</Text>
          </TouchableOpacity>
          <View style={styles.quickZoomGroup}>
            <TouchableOpacity
              style={styles.quickIconButton}
              onPress={() => applyZoomMultiplier(1 / 1.2)}
            >
              <MaterialCommunityIcons name="magnify-minus-outline" size={22} color={ICON_COLOR} />
            </TouchableOpacity>
            <Text style={styles.zoomLabel}>{zoomLabel}</Text>
            <TouchableOpacity
              style={styles.quickIconButton}
              onPress={() => applyZoomMultiplier(1.2)}
            >
              <MaterialCommunityIcons name="magnify-plus-outline" size={22} color={ICON_COLOR} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {isSheetOpen && (
        <Animated.View style={styles.sheetContainer}>
          {showBrushSheet && (
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Brush Size</Text>
              <View style={styles.sheetRow}>
                {thicknessOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.thicknessOption, option === thickness && styles.thicknessOptionActive]}
                    onPress={() => {
                      setThickness(option);
                      setShowBrushSheet(false);
                    }}
                  >
                    <View style={[styles.thicknessPreview, { height: option }]} />
                    <Text style={styles.sheetLabel}>{option}px</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {showColorSheet && (
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Colors</Text>
              <View style={styles.sheetRow}>
                {colorPalette.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.colorOption, { backgroundColor: option }, option === color && styles.colorOptionActive]}
                    onPress={() => {
                      setColor(option);
                      setShowColorSheet(false);
                    }}
                  />
                ))}
              </View>
            </View>
          )}
          {showToolsSheet && (
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Tools</Text>
              <View style={styles.sheetRow}>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'pencil' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('pencil');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="pencil" size={24} color={selectedTool === 'pencil' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'pencil' && styles.toolLabelActive]}>Brush</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'line' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('line');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="vector-line" size={24} color={selectedTool === 'line' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'line' && styles.toolLabelActive]}>Line</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'ellipse' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('ellipse');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="circle-outline" size={24} color={selectedTool === 'ellipse' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'ellipse' && styles.toolLabelActive]}>Circle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'rectangle' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('rectangle');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="square-outline" size={24} color={selectedTool === 'rectangle' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'rectangle' && styles.toolLabelActive]}>Square</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'text' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('text');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="format-text" size={24} color={selectedTool === 'text' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'text' && styles.toolLabelActive]}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolOption, selectedTool === 'pan' && styles.toolOptionActive]}
                  onPress={() => {
                    setTool('pan');
                    setShowToolsSheet(false);
                  }}
                >
                  <MaterialCommunityIcons name="hand-back-left" size={24} color={selectedTool === 'pan' ? ICON_ACTIVE : ICON_COLOR} />
                  <Text style={[styles.sheetLabel, selectedTool === 'pan' && styles.toolLabelActive]}>Pan</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {showLayerSheet && (
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Layers</Text>
              <View style={styles.layerList}>
                <TouchableOpacity
                  style={[styles.layerRow, styles.layerRowActive]}
                  onPress={() => setShowLayerSheet(false)}
                >
                  <MaterialCommunityIcons name="layers" size={20} color={ICON_ACTIVE} />
                  <Text style={styles.layerLabel}>Layer 1</Text>
                  <MaterialCommunityIcons name="check" size={18} color={ICON_ACTIVE} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.layerRow, styles.layerRowDisabled]} disabled>
                  <MaterialCommunityIcons name="plus-circle-outline" size={20} color={ICON_DISABLED} />
                  <Text style={styles.layerLabel}>Add Layer</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetHint}>Layer management roadmap — base layer active today.</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Text Input Modal */}
      <Modal
        visible={isTextModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleTextCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Text:</Text>
            <TextInput
              style={styles.textInput}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Type your text here..."
              autoFocus={true}
              multiline={false}
              returnKeyType="done"
              onSubmitEditing={handleTextSubmit}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={handleTextCancel}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSubmit} onPress={handleTextSubmit}>
                <Text style={styles.modalButtonTextSubmit}>Add Text</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111827',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  topToolbarScroll: {
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingRight: 12,
  },
  iconButton: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#1f2937',
  },
  iconButtonActive: {
    backgroundColor: '#1e3a8a',
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  iconCaption: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: ICON_COLOR,
  },
  canvasShell: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  canvasSurface: {
    width: '100%',
    height: '100%',
  },
  bottomStripContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  bottomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 24,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#1f2937',
  },
  quickButtonActive: {
    borderWidth: 1,
    borderColor: ICON_ACTIVE,
  },
  quickLabel: {
    color: ICON_COLOR,
    fontWeight: '600',
  },
  colorSwatchFill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f8fafc',
  },
  quickZoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: {
    color: '#f9fafb',
    fontWeight: '700',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sheetContent: {
    backgroundColor: '#1f2937',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#f9fafb',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thicknessOption: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  thicknessOptionActive: {
    borderWidth: 2,
    borderColor: '#f9fafb',
  },
  thicknessPreview: {
    width: 32,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
  },
  sheetLabel: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#f9fafb',
  },
  toolOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    minWidth: 80,
  },
  toolOptionActive: {
    backgroundColor: '#1e3a8a',
    borderWidth: 1,
    borderColor: ICON_ACTIVE,
  },
  toolLabelActive: {
    color: ICON_ACTIVE,
  },
  layerList: {
    gap: 10,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#111827',
  },
  layerRowActive: {
    borderWidth: 1,
    borderColor: ICON_ACTIVE,
  },
  layerRowDisabled: {
    opacity: 0.5,
  },
  layerLabel: {
    flex: 1,
    marginLeft: 12,
    color: '#f9fafb',
    fontWeight: '600',
  },
  sheetHint: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  modalButtonSubmit: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtonTextSubmit: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FullscreenCanvas;
