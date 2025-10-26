// SkiaDrawingToKonvaJSON.ts
import { SkPath } from "@shopify/react-native-skia";

export interface DrawingShape {
  points?: number[]; // [x1, y1, x2, y2, ...] for pencil/eraser
  color: string;
  width: number;
  tool: string;
  type?: string; // For shapes: 'line', 'rectangle', 'circle', 'text'
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  path?: any; // Skia Path object
  // Text element properties
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  textBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize: number;
    color: string;
  };
}

export function skiaToKonvaJSON(shapes: DrawingShape[], canvasWidth: number = 400, canvasHeight: number = 400) {
  return {
    className: "Stage",
    attrs: { width: canvasWidth, height: canvasHeight },
    children: [
      {
        className: "Layer",
        children: shapes.map(shape => {
          if (shape.tool === 'text' && shape.textBox) {
            // Text box rectangle
            return {
              className: "Rect",
              attrs: {
                x: shape.textBox.x,
                y: shape.textBox.y,
                width: shape.textBox.width,
                height: shape.textBox.height,
                stroke: shape.color,
                strokeWidth: shape.width,
                fill: "transparent"
              }
            };
          } else if (shape.type === 'text') {
            // Text content
            return {
              className: "Text",
              attrs: {
                x: shape.x,
                y: shape.y,
                text: shape.text,
                fontSize: shape.fontSize || 16,
                fill: shape.color,
                fontFamily: "Arial"
              }
            };
          } else if (shape.type === 'line') {
            // Line shape
            return {
              className: "Line",
              attrs: {
                points: [shape.startX!, shape.startY!, shape.endX!, shape.endY!],
                stroke: shape.color,
                strokeWidth: shape.width,
                lineCap: "round"
              }
            };
          } else if (shape.type === 'rectangle') {
            // Rectangle shape
            const width = Math.abs(shape.endX! - shape.startX!);
            const height = Math.abs(shape.endY! - shape.startY!);
            const x = Math.min(shape.startX!, shape.endX!);
            const y = Math.min(shape.startY!, shape.endY!);
            return {
              className: "Rect",
              attrs: {
                x: x,
                y: y,
                width: width,
                height: height,
                stroke: shape.color,
                strokeWidth: shape.width,
                fill: "transparent"
              }
            };
          } else if (shape.type === 'circle') {
            // Circle shape
            const centerX = (shape.startX! + shape.endX!) / 2;
            const centerY = (shape.startY! + shape.endY!) / 2;
            const radius = Math.sqrt(
              Math.pow(shape.endX! - shape.startX!, 2) + Math.pow(shape.endY! - shape.startY!, 2)
            ) / 2;
            return {
              className: "Circle",
              attrs: {
                x: centerX,
                y: centerY,
                radius: radius,
                stroke: shape.color,
                strokeWidth: shape.width,
                fill: "transparent"
              }
            };
          } else if (shape.path) {
            // Pencil/Eraser strokes from Skia Path
            const isEraserStroke = shape.tool === 'eraser';
            // Convert Skia path to points array for Konva
            const points: number[] = [];
            // Note: This is a simplified conversion - in practice you'd need to extract points from the Skia path
            return {
              className: "Line",
              attrs: {
                points: shape.points || [],
                stroke: isEraserStroke ? "black" : shape.color,
                strokeWidth: isEraserStroke ? shape.width * 7 : shape.width,
                tension: 0.5,
                lineCap: "round",
                lineJoin: "round",
                globalCompositeOperation: isEraserStroke ? "destination-out" : "source-over"
              }
            };
          } else {
            // Fallback for other tools
            return {
              className: "Line",
              attrs: {
                points: shape.points || [],
                stroke: shape.color,
                strokeWidth: shape.width,
                tension: 0.5,
                lineCap: "round",
                lineJoin: "round"
              }
            };
          }
        })
      }
    ]
  };
}

// Convert Android drawing data to web app format
export function convertAndroidDrawingToWebFormat(androidPaths: any[]): DrawingShape[] {
  return androidPaths.map(pathData => {
    if (pathData.type === 'text') {
      // Text element
      return {
        points: [],
        color: pathData.color,
        width: pathData.thickness,
        tool: 'text',
        type: 'text',
        x: pathData.x,
        y: pathData.y,
        text: pathData.text,
        fontSize: pathData.fontSize
      };
    } else if (pathData.tool === 'text' && pathData.textBox) {
      // Text box rectangle
      return {
        points: [],
        color: pathData.color,
        width: pathData.thickness,
        tool: 'text',
        textBox: pathData.textBox
      };
    } else if (pathData.shape) {
      return {
        points: [],
        color: pathData.color,
        width: pathData.thickness,
        tool: pathData.tool,
        type: pathData.shape.type,
        startX: pathData.shape.startX,
        startY: pathData.shape.startY,
        endX: pathData.shape.endX,
        endY: pathData.shape.endY
      };
    } else if (pathData.path) {
      // For Skia Path objects, we need to extract points
      // This is a simplified approach - in practice you'd need to traverse the path
      return {
        points: [], // Would need to extract from Skia path
        color: pathData.color,
        width: pathData.thickness,
        tool: pathData.tool,
        path: pathData.path
      };
    }
    return {
      points: [],
      color: pathData.color,
      width: pathData.thickness,
      tool: pathData.tool
    };
  });
}
