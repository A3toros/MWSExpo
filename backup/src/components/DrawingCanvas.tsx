import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from "react";
import { View, StyleSheet, Dimensions, TextInput, Modal, TouchableOpacity, Text as RNText } from "react-native";
import { Canvas, Path, Skia, useTouchHandler, Line, Rect, Circle, Text as SkiaText, useFont } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get("window");

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  currentColor: string;
  currentThickness: number;
  currentTool: string;
  onDrawingChange: (lines: any[]) => void;
  isDrawing?: boolean;
  onDrawingStateChange?: (isDrawing: boolean) => void;
  initialPaths?: any[]; // Add prop to receive initial paths for reset
  // Expose control functions and states
  onControlRef?: (controls: {
    undo: () => void;
    redo: () => void;
    reset: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    canUndo: boolean;
    canRedo: boolean;
    zoomLevel: number;
  }) => void;
}

export default function DrawingCanvas({
  width = screenWidth - 32,
  height = 300,
  currentColor,
  currentThickness,
  currentTool,
  onDrawingChange,
  isDrawing: externalIsDrawing,
  onDrawingStateChange,
  initialPaths,
  onControlRef
}: DrawingCanvasProps) {
  const [paths, setPaths] = useState<any[]>(() => {
    console.log('🎨 DrawingCanvas initializing with paths:', initialPaths?.length || 0);
    console.log('🎨 DrawingCanvas initialPaths sample:', initialPaths?.[0]);
    return initialPaths || [];
  });

  // Update paths when initialPaths changes (for question navigation)
  useEffect(() => {
    console.log('🎨 DrawingCanvas: initialPaths changed, updating paths from', paths.length, 'to', initialPaths?.length || 0);
    console.log('🎨 DrawingCanvas: initialPaths sample after change:', initialPaths?.[0]);
    setPaths(initialPaths || []);
    setHistory([initialPaths || []]);
    setHistoryIndex(0);
  }, [initialPaths]);
  const [currentPoints, setCurrentPoints] = useState<any[]>([]);
  const [currentShape, setCurrentShape] = useState<any>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  
  // Use ref to avoid race conditions with currentPoints
  const currentPointsRef = useRef<any[]>([]);
  const currentShapeRef = useRef<any>(null);
  const toolAtStartRef = useRef<string>('pencil');
  const currentToolRef = useRef<string>(currentTool);
  useLayoutEffect(() => { currentToolRef.current = currentTool; }, [currentTool]);
  const drawingFlagRef = useRef<boolean>(false);
  const strokeThicknessRef = useRef<number>(currentThickness);
  const currentThicknessRef = useRef<number>(currentThickness);
  useLayoutEffect(() => { currentThicknessRef.current = currentThickness; }, [currentThickness]);
  const currentColorRef = useRef<string>(currentColor);
  useLayoutEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  const pendingTextBoxRef = useRef<any>(null);
  
  // Undo/Redo functionality
  const [history, setHistory] = useState<any[][]>([initialPaths || []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('🎨 DrawingCanvas MOUNTED with initialPaths:', initialPaths?.length || 0);
    return () => {
      console.log('🎨 DrawingCanvas UNMOUNTED');
    };
  }, []);

  // Debug: Log rendering info
  useEffect(() => {
    console.log('DrawingCanvas: Rendering paths count:', paths.length);
    console.log('DrawingCanvas: Rendering currentPoints length:', currentPoints.length);
  }, [paths.length, currentPoints.length]);
  
  // Zoom functionality (start at 100%)
  const MIN_ZOOM = 1;   // Fit-to-canvas
  const MAX_ZOOM = 5;   // 500%
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Load default font for text rendering
  const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 16);

  // Helpers to apply visual transform (zoom/pan)
  const transformPoint = useCallback((px: number, py: number) => ({
    x: px * zoom + panOffset.x,
    y: py * zoom + panOffset.y,
  }), [zoom, panOffset]);
  const transformThickness = useCallback((thickness: number) => thickness * zoom, [zoom]);

  // Pan handling refs
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartRef = useRef<{ zoom: number; panX: number; panY: number; focusX: number; focusY: number } | null>(null);
  const MOVE_THRESHOLD_PX = 8;
  const textCreateCandidateRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Map screen coords -> logical coords (inverse of transform)
  // Keep refs in sync to avoid stale values inside UI-thread touch handler
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  React.useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  const toLogical = useCallback((x: number, y: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    return { x: (x - p.x) / z, y: (y - p.y) / z };
  }, []);

  // Gestures: Pinch (2-finger zoom keeping focal stable) and Pan (2-finger translation)
  const startPinch = (focalX: number, focalY: number) => {
    const contentFocus = toLogical(focalX, focalY);
    pinchStartRef.current = { zoom, panX: panOffset.x, panY: panOffset.y, focusX: contentFocus.x, focusY: contentFocus.y };
    if (onDrawingStateChange) onDrawingStateChange(true);
  };
  const updatePinch = (scale: number, focalX: number, focalY: number) => {
    if (!pinchStartRef.current) return;
    const base = pinchStartRef.current;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base.zoom * scale));
    const targetScreenX = focalX;
    const targetScreenY = focalY;
    const newPanX = targetScreenX - base.focusX * nextZoom;
    const newPanY = targetScreenY - base.focusY * nextZoom;
    setZoom(nextZoom);
    // Clamp pan so content remains drawable across full viewport when zoomed out
    const contentW = (width || 0) * nextZoom;
    const contentH = (height || 0) * nextZoom;
    const minX = Math.min(0, (width || 0) - contentW);
    const minY = Math.min(0, (height || 0) - contentH);
    const clampedX = Math.max(minX, Math.min(0, newPanX));
    const clampedY = Math.max(minY, Math.min(0, newPanY));
    setPanOffset({ x: clampedX, y: clampedY });
  };
  const endPinch = () => {
    pinchStartRef.current = null;
    if (onDrawingStateChange) onDrawingStateChange(false);
  };
  const pinchGesture = Gesture.Pinch()
    .cancelsTouchesInView(false)
    .onBegin((e: any) => {
      runOnJS(startPinch)(e.focalX, e.focalY);
    })
    .onUpdate((e: any) => {
      runOnJS(updatePinch)(e.scale, e.focalX, e.focalY);
    })
    .onEnd(() => {
      runOnJS(endPinch)();
    });

  const startTwoFingerPan = () => {
    panOriginRef.current = { x: panOffset.x, y: panOffset.y };
    if (onDrawingStateChange) onDrawingStateChange(true);
  };
  const updateTwoFingerPan = (translationX: number, translationY: number) => {
    const nextX = panOriginRef.current.x + translationX;
    const nextY = panOriginRef.current.y + translationY;
    const contentW = (width || 0) * zoom;
    const contentH = (height || 0) * zoom;
    const minX = Math.min(0, (width || 0) - contentW);
    const minY = Math.min(0, (height || 0) - contentH);
    const clampedX = Math.max(minX, Math.min(0, nextX));
    const clampedY = Math.max(minY, Math.min(0, nextY));
    setPanOffset({ x: clampedX, y: clampedY });
  };
  const endTwoFingerPan = () => {
    if (onDrawingStateChange) onDrawingStateChange(false);
  };
  const twoFingerPan = Gesture.Pan()
    .minPointers(2)
    .cancelsTouchesInView(false)
    .onBegin(() => {
      runOnJS(startTwoFingerPan)();
    })
    .onUpdate((e: any) => {
      runOnJS(updateTwoFingerPan)(e.translationX, e.translationY);
    })
    .onEnd(() => {
      runOnJS(endTwoFingerPan)();
    });

  const gestures = Gesture.Simultaneous(pinchGesture, twoFingerPan);


  const touchHandler = useTouchHandler({
    onStart: ({ x, y }) => {
      console.log('DrawingCanvas: Touch start', { x, y, currentTool });
      // Use latest committed tool to avoid stale value at first tap after switching tools
      toolAtStartRef.current = currentToolRef.current;
      // Lock thickness for this gesture to keep preview and final consistent (use latest committed ref)
      strokeThicknessRef.current = currentThicknessRef.current;
      
      if (toolAtStartRef.current === 'pan') {
        panStartRef.current = { x, y };
        panOriginRef.current = { x: panOffset.x, y: panOffset.y };
        return;
      }
      
      const p = toLogical(x, y);
      // Handle pencil/eraser tools
      if (toolAtStartRef.current === 'pencil' || toolAtStartRef.current === 'eraser') {
        console.log('DrawingCanvas: Starting new pencil/eraser line, current paths count:', paths.length);
        const initialPoints = [{ x: p.x, y: p.y, color: currentColorRef.current || currentColor, thickness: strokeThicknessRef.current, tool: toolAtStartRef.current }];
        setCurrentPoints(initialPoints);
        currentPointsRef.current = initialPoints;
        console.log('DrawingCanvas: Set initial currentPoints with 1 point');
      }
      // Handle shape tools
      else if (['line', 'rectangle', 'circle'].includes(toolAtStartRef.current)) {
        const shape = {
          type: toolAtStartRef.current,
          startX: p.x,
          startY: p.y,
          endX: p.x,
          endY: p.y,
          color: currentColorRef.current || currentColor,
          thickness: strokeThicknessRef.current
        };
        setCurrentShape(shape);
        currentShapeRef.current = shape;
      }
      // Handle text tool: begin drawing a text box rectangle
      else if (toolAtStartRef.current === 'text') {
        const shape = {
          type: 'textBox',
          startX: p.x,
          startY: p.y,
          endX: p.x,
          endY: p.y,
          color: currentColorRef.current || currentColor,
          thickness: Math.max(1, currentThickness)
        };
        setCurrentShape(shape);
        currentShapeRef.current = shape;
      }
      
    },
    onActive: ({ x, y }) => {
      if (onDrawingStateChange && !drawingFlagRef.current) {
        drawingFlagRef.current = true;
        try { onDrawingStateChange(true); } catch {}
      }
      if (toolAtStartRef.current === 'pan') {
        if (panStartRef.current) {
          const dx = x - panStartRef.current.x;
          const dy = y - panStartRef.current.y;
          setPanOffset({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy });
        }
        return;
      }
      
      console.log('DrawingCanvas: Touch active', { x, y, currentTool });
      
      // Update text box rectangle while dragging
      if (toolAtStartRef.current === 'text' && currentShapeRef.current?.type === 'textBox') {
        const p = toLogical(x, y);
        const updated = { ...(currentShapeRef.current || {}), endX: p.x, endY: p.y };
        currentShapeRef.current = updated;
        setCurrentShape(updated);
        return;
      }

      const p = toLogical(x, y);
      // Handle pencil/eraser tools
      if (toolAtStartRef.current === 'pencil' || toolAtStartRef.current === 'eraser') {
        const newPoints = [...currentPointsRef.current, { x: p.x, y: p.y, color: currentColorRef.current || currentColor, thickness: strokeThicknessRef.current, tool: toolAtStartRef.current }];
        setCurrentPoints(newPoints);
        currentPointsRef.current = newPoints;
        console.log('DrawingCanvas: Updating currentPoints, length:', newPoints.length);
      }
      // Handle shape tools
      else if (['line', 'rectangle', 'circle'].includes(toolAtStartRef.current)) {
        const updated = {
          ...(currentShapeRef.current || currentShape),
          endX: p.x,
          endY: p.y,
        };
        currentShapeRef.current = updated;
        setCurrentShape(updated);
      }
    },
    onEnd: () => {
      console.log('DrawingCanvas: Touch end', { currentTool, currentPointsLength: currentPointsRef.current.length, hasCurrentShape: !!currentShape, pathsCount: paths.length });
      
      if (toolAtStartRef.current === 'pan') {
        panStartRef.current = null;
        if (onDrawingStateChange && drawingFlagRef.current) { drawingFlagRef.current = false; onDrawingStateChange(false); }
        return;
      }

      // Finalize text box: open input and save after submit
      if (toolAtStartRef.current === 'text') {
        if (currentShapeRef.current?.type === 'textBox') {
          pendingTextBoxRef.current = currentShapeRef.current;
          setCurrentShape(null);
          currentShapeRef.current = null;
          setTextInputValue('');
          setShowTextInput(true);
        }
        if (onDrawingStateChange && drawingFlagRef.current) { drawingFlagRef.current = false; onDrawingStateChange(false); }
        return;
      }

      // Handle pencil/eraser tools
      if ((toolAtStartRef.current === 'pencil' || toolAtStartRef.current === 'eraser') && currentPointsRef.current.length > 0) {
        console.log('DrawingCanvas: About to add pencil/eraser path, currentPoints length:', currentPointsRef.current.length);
        setPaths(prevPaths => {
          const newPaths = [...prevPaths, currentPointsRef.current];
          saveToHistory(newPaths);
          onDrawingChange(newPaths);
          console.log('DrawingCanvas: Added pencil/eraser path, total paths:', newPaths.length);
          return newPaths;
        });
        setCurrentPoints([]);
        currentPointsRef.current = [];
        console.log('DrawingCanvas: currentPoints cleared');
      } else {
        console.log('DrawingCanvas: Not adding path - currentTool:', currentTool, 'currentPoints.length:', currentPointsRef.current.length);
      }
      
      // Handle shape tools
      if (['line', 'rectangle', 'circle'].includes(toolAtStartRef.current) && currentShapeRef.current) {
        const shapeToAdd = currentShapeRef.current;
        setPaths(prevPaths => {
          const newPaths = [...prevPaths, shapeToAdd];
          saveToHistory(newPaths);
          onDrawingChange(newPaths);
          console.log('DrawingCanvas: Added shape, total paths:', newPaths.length);
          return newPaths;
        });
        setCurrentShape(null);
        currentShapeRef.current = null;
      }
      // Handle text tool (text is handled in onStart, not onEnd)
      else if (currentTool === 'text') {
        // Text tool doesn't need onEnd handling
      }
      
      if (onDrawingStateChange && drawingFlagRef.current) {
        drawingFlagRef.current = false;
        onDrawingStateChange(false);
      }
    },
  });

  const pointsToPath = useCallback((points: any[]) => {
    const path = Skia.Path.Make();
    if (points.length > 0) {
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
      }
    }
    return path;
  }, []);

  // Handle text input
  const handleTextSubmit = useCallback(() => {
    if (textInputValue.trim()) {
      // If we have a pending text box rectangle, save both rect and text linked to it
      if (pendingTextBoxRef.current) {
        const box = pendingTextBoxRef.current;
        const rectX = Math.min(box.startX, box.endX);
        const rectY = Math.min(box.startY, box.endY);
        const rectW = Math.abs(box.endX - box.startX);
        const rectH = Math.abs(box.endY - box.startY);

        const rectElement = {
          type: 'rectangle',
          startX: rectX,
          startY: rectY,
          endX: rectX + rectW,
          endY: rectY + rectH,
          color: box.color,
          thickness: box.thickness,
        };

        // Place text with margin inside rectangle
        const padding = Math.max(4, box.thickness * 2);
        const textElement = {
          type: 'text',
          x: rectX + padding,
          y: rectY + padding + (currentThickness * 4),
          text: textInputValue.trim(),
          color: currentColor,
          fontSize: currentThickness * 4,
        };

        setPaths(prevPaths => {
          const newPaths = [...prevPaths, rectElement, textElement];
          saveToHistory(newPaths);
          onDrawingChange(newPaths);
          console.log('DrawingCanvas: Added text box + text, total paths:', newPaths.length);
          return newPaths;
        });
        pendingTextBoxRef.current = null;
      } else {
        // Fallback: simple text at last textPosition
        const textElement = {
          type: 'text',
          x: textPosition.x,
          y: textPosition.y,
          text: textInputValue.trim(),
          color: currentColor,
          fontSize: currentThickness * 4,
        };
        setPaths(prevPaths => {
          const newPaths = [...prevPaths, textElement];
          saveToHistory(newPaths);
          onDrawingChange(newPaths);
          console.log('DrawingCanvas: Added text, total paths:', newPaths.length);
          return newPaths;
        });
      }
    }
    
    setShowTextInput(false);
    setTextInputValue('');
    
    if (onDrawingStateChange) {
      onDrawingStateChange(false);
    }
  }, [textInputValue, textPosition, currentColor, currentThickness, paths, onDrawingChange, onDrawingStateChange]);

  const handleTextCancel = useCallback(() => {
    setShowTextInput(false);
    setTextInputValue('');
    
    if (onDrawingStateChange) {
      onDrawingStateChange(false);
    }
  }, [onDrawingStateChange]);

  // Undo functionality
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPaths(history[newIndex]);
      onDrawingChange(history[newIndex]);
    }
  }, [historyIndex, history, onDrawingChange]);

  // Redo functionality
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPaths(history[newIndex]);
      onDrawingChange(history[newIndex]);
    }
  }, [historyIndex, history, onDrawingChange]);

  // Reset functionality
  const reset = useCallback(() => {
    setPaths([]);
    setCurrentPoints([]);
    setCurrentShape(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    onDrawingChange([]);
  }, [onDrawingChange]);

  // Zoom functionality
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1)); // Min zoom 0.1x
  }, []);

  // Save to history when paths change
  const saveToHistory = useCallback((newPaths: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPaths);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);


  // Expose control functions to parent
  React.useEffect(() => {
    if (onControlRef) {
      onControlRef({
        undo,
        redo,
        reset,
        zoomIn,
        zoomOut,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        zoomLevel: zoom
      });
    }
  }, [onControlRef, undo, redo, reset, zoomIn, zoomOut, historyIndex, history.length, zoom]);

  return (
    <View style={styles.container} collapsable={false}>
      <GestureDetector
        gesture={gestures}
      >
        <Canvas style={[styles.canvas, { width, height }]} onTouch={touchHandler}>
        {/* Completed paths and shapes */}
        {paths.map((item, i) => {
          // Handle pencil/eraser strokes (array of points)
          if (Array.isArray(item)) {
            const path = pointsToPath(item.map(pt => transformPoint(pt.x, pt.y)));
            const isEraserStroke = item[0]?.tool === 'eraser';
            return (
              <Path
                key={i}
                path={path}
                color={isEraserStroke ? '#fafafa' : (item[0]?.color || currentColor)}
                style="stroke"
                strokeWidth={isEraserStroke ? transformThickness((item[0]?.thickness || currentThickness) * 7) : transformThickness(item[0]?.thickness || currentThickness)}
                strokeCap="round"
                strokeJoin="round"
              />
            );
          }
          // Handle shapes (objects with type, startX, startY, endX, endY)
          else if (item.type === 'line') {
            const p1 = transformPoint(item.startX, item.startY);
            const p2 = transformPoint(item.endX, item.endY);
            return (
              <Line
                key={i}
                p1={p1}
                p2={p2}
                color={item.color || currentColorRef.current || currentColor}
                style="stroke"
                strokeWidth={transformThickness(item.thickness || currentThickness)}
              />
            );
          }
          else if (item.type === 'rectangle') {
            const p1 = transformPoint(item.startX, item.startY);
            const p2 = transformPoint(item.endX, item.endY);
            const rectWidth = Math.abs(p2.x - p1.x);
            const rectHeight = Math.abs(p2.y - p1.y);
            const rectX = Math.min(p1.x, p2.x);
            const rectY = Math.min(p1.y, p2.y);
            return (
              <Rect
                key={i}
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                color={item.color || currentColorRef.current || currentColor}
                style="stroke"
                strokeWidth={transformThickness(item.thickness || currentThickness)}
              />
            );
          }
          else if (item.type === 'circle') {
            const p1 = transformPoint(item.startX, item.startY);
            const p2 = transformPoint(item.endX, item.endY);
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const radius = Math.sqrt(
              Math.pow(p2.x - p1.x, 2) + 
              Math.pow(p2.y - p1.y, 2)
            ) / 2;
            return (
              <Circle
                key={i}
                cx={centerX}
                cy={centerY}
                r={radius}
                color={item.color || currentColorRef.current || currentColor}
                style="stroke"
                strokeWidth={transformThickness(item.thickness || currentThickness)}
              />
            );
          }
            else if (item.type === 'text' && font) {
            const tp = transformPoint(item.x, item.y);
            return (
              <SkiaText
                key={i}
                  x={tp.x}
                  y={tp.y}
                text={item.text}
                color={item.color}
                  font={font}
              />
            );
          }
          return null;
        })}
        
        {/* Current path being drawn; show eraser preview as canvas color */}
        {currentPoints.length > 0 && (() => {
          const previewThickness = toolAtStartRef.current === 'eraser'
            ? (strokeThicknessRef.current * 7)
            : strokeThicknessRef.current;
          const previewColor = toolAtStartRef.current === 'eraser'
            ? '#fafafa'
            : (currentPoints[0]?.color || currentColor);
          return (
            <Path
              path={pointsToPath(currentPoints.map(pt => transformPoint(pt.x, pt.y)))}
              color={previewColor}
              style="stroke"
              strokeWidth={transformThickness(previewThickness)}
              strokeCap="round"
              strokeJoin="round"
            />
          );
        })()}
        
        {/* Current shape being drawn */}
        {currentShape && (
          <>
            {currentShape.type === 'line' && (
              <Line
                p1={transformPoint(currentShape.startX, currentShape.startY)}
                p2={transformPoint(currentShape.endX, currentShape.endY)}
                color={currentShape.color}
                style="stroke"
                strokeWidth={transformThickness(currentShape.thickness)}
              />
            )}
            {currentShape.type === 'rectangle' && (
              <Rect
                x={Math.min(transformPoint(currentShape.startX, currentShape.startY).x, transformPoint(currentShape.endX, currentShape.endY).x)}
                y={Math.min(transformPoint(currentShape.startX, currentShape.startY).y, transformPoint(currentShape.endX, currentShape.endY).y)}
                width={Math.abs(transformPoint(currentShape.endX, currentShape.endY).x - transformPoint(currentShape.startX, currentShape.startY).x)}
                height={Math.abs(transformPoint(currentShape.endX, currentShape.endY).y - transformPoint(currentShape.startX, currentShape.startY).y)}
                color={currentShape.color}
                style="stroke"
                strokeWidth={transformThickness(currentShape.thickness)}
              />
            )}
            {currentShape.type === 'textBox' && (
              <Rect
                x={Math.min(transformPoint(currentShape.startX, currentShape.startY).x, transformPoint(currentShape.endX, currentShape.endY).x)}
                y={Math.min(transformPoint(currentShape.startX, currentShape.startY).y, transformPoint(currentShape.endX, currentShape.endY).y)}
                width={Math.abs(transformPoint(currentShape.endX, currentShape.endY).x - transformPoint(currentShape.startX, currentShape.startY).x)}
                height={Math.abs(transformPoint(currentShape.endX, currentShape.endY).y - transformPoint(currentShape.startX, currentShape.startY).y)}
                color={currentShape.color}
                style="stroke"
                strokeWidth={transformThickness(currentShape.thickness)}
              />
            )}
            {currentShape.type === 'circle' && (
              <Circle
                cx={(transformPoint(currentShape.startX, currentShape.startY).x + transformPoint(currentShape.endX, currentShape.endY).x) / 2}
                cy={(transformPoint(currentShape.startX, currentShape.startY).y + transformPoint(currentShape.endX, currentShape.endY).y) / 2}
                r={Math.sqrt(
                  Math.pow(transformPoint(currentShape.endX, currentShape.endY).x - transformPoint(currentShape.startX, currentShape.startY).x, 2) + 
                  Math.pow(transformPoint(currentShape.endX, currentShape.endY).y - transformPoint(currentShape.startX, currentShape.startY).y, 2)
                ) / 2}
                color={currentShape.color}
                style="stroke"
                strokeWidth={transformThickness(currentShape.thickness)}
              />
            )}
          </>
        )}
        </Canvas>
      </GestureDetector>
      
      {/* Text Input Modal */}
      <Modal
        visible={showTextInput}
        transparent={true}
        animationType="fade"
        onRequestClose={handleTextCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.textInputContainer}>
            <RNText style={styles.textInputLabel}>Enter Text:</RNText>
            <TextInput
              style={styles.textInput}
              value={textInputValue}
              onChangeText={setTextInputValue}
              placeholder="Type your text here..."
              autoFocus={true}
              multiline={false}
              returnKeyType="done"
              onSubmitEditing={handleTextSubmit}
            />
            <View style={styles.textInputButtons}>
              <TouchableOpacity
                style={[styles.textButton, styles.cancelButton]}
                onPress={handleTextCancel}
              >
                <RNText style={styles.cancelButtonText}>Cancel</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.textButton, styles.submitButton]}
                onPress={handleTextSubmit}
              >
                <RNText style={styles.submitButtonText}>Add Text</RNText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderColor: "#ddd",
    borderWidth: 1,
  },
  canvas: {
    backgroundColor: "#fafafa",
  },
  // Text input modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  textInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  textInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  textButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});