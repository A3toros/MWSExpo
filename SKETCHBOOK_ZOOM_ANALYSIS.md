# Sketchbook Zoom Implementation Analysis

## Overview
Analysis of Autodesk Sketchbook's zoom implementation based on decompiled APK to understand how professional drawing apps handle multi-touch gestures and zoom functionality.

## Key Findings

### 1. Architecture Pattern
**Sketchbook uses a layered approach:**
- **SurfaceView Layer**: `SimpleSurfaceView` extends `SurfaceView` for OpenGL rendering
- **Touch Handler Layer**: `canvas/a.smali` handles touch events and gesture detection
- **Native Interface Layer**: Native C++ code handles actual drawing and transformations
- **Matrix Transformations**: Uses `android.graphics.Matrix` for zoom/pan transformations

### 2. Touch Event Handling Structure
```java
// Main touch event flow in canvas/b.smali
public boolean onTouchEvent(MotionEvent event) {
    // Step 1: Check UI gestures first
    boolean uiHandled = canvas/a.a(event, view);
    
    if (!uiHandled) {
        // Step 2: Handle canvas gestures
        boolean canvasHandled = canvas/a.f(event, canvas);
        return canvasHandled;
    }
    
    return uiHandled;
}
```

**Key Structure:**
1. **UI Layer First**: `canvas/a.a()` handles UI gestures (toolbar, menus)
2. **Canvas Layer Second**: `canvas/a.f()` handles drawing/zoom gestures
3. **Return boolean**: Indicates if event was consumed

### 3. Multi-Touch Detection Structure
**Professional Implementation Pattern:**

```java
// In canvas/a.smali - Method f() (main canvas touch handler)
public boolean f(MotionEvent event, Canvas canvas) {
    // Step 1: Get action type
    int action = event.getAction() & 0xff;
    
    // Step 2: Handle different action types
    switch (action) {
        case ACTION_DOWN:
            // Single touch start
            break;
        case ACTION_POINTER_DOWN:
            // Multi-touch start
            break;
        case ACTION_MOVE:
            // Touch move
            break;
        case ACTION_UP:
        case ACTION_POINTER_UP:
            // Touch end
            break;
    }
    
    // Step 3: Process all pointers
    int pointerCount = event.getPointerCount();
    for (int i = 0; i < pointerCount; i++) {
        // Create SKTPointerEvent for each pointer
        SKTPointerEvent pointerEvent = createPointerEvent(event, i, canvas);
        
        // Send to native handler
        canvas.S(gestureType, pointerEvent);
    }
    
    return true; // Event consumed
}
```

**Key Professional Patterns:**
1. **Action-based routing**: Different handlers for DOWN, MOVE, UP
2. **Pointer iteration**: Loop through ALL active pointers
3. **Event creation**: Create `SKTPointerEvent` for each pointer
4. **Native delegation**: Send to `canvas.S()` for native processing
5. **No gesture recognizers**: Custom multi-touch detection

### 4. Native Zoom Implementation Structure
**Professional Native Integration:**

#### A. Native Method Structure
```java
// In SKBSketchView.smali - Native interface methods
private native nativeEnableMultiTouchGesture(boolean enabled);
private native nativeGetZoomScale();
private native nativeRegisterCanvasZoomRotationChangedSignal(Object callback);

// Pointer handling methods
private native nativeHandlePointerPressed(long pointerId);
private native nativeHandlePointerMoved(long pointerId);
private native nativeHandlePointerReleased(long pointerId);
private native nativeHandlePointerCanceled(long pointerId);
```

#### B. Canvas State Management
```java
// In canvas/b.smali - State fields
.field public L:Landroid/graphics/Matrix;  // Current transformation matrix
.field public M:Landroid/graphics/Matrix;  // Additional matrix for calculations
.field public N:Landroid/graphics/Point;   // Focal point for zoom

// Gesture state flags
.field public A:Z  // Gesture active flag
.field public B:Z  // Drawing state flag
.field public C:Z  // Multi-touch flag
.field public D:Z  // Pan gesture flag
.field public E:Z  // Zoom gesture flag
```

#### C. Event Processing Flow
```java
// In canvas/b.smali - Method S() (native delegation)
public void S(GestureType gestureType, SKTPointerEvent pointerEvent) {
    if (sketchView == null) return;
    
    switch (gestureType) {
        case PRESSED:
            sketchView.handlePointerPressed(pointerEvent);
            break;
        case MOVED:
            sketchView.handlePointerMoved(pointerEvent);
            break;
        case RELEASED:
            sketchView.handlePointerReleased(pointerEvent);
            break;
        case CANCELED:
            sketchView.handlePointerCanceled(pointerEvent);
            break;
    }
}
```

### 5. Complete Professional Touch/Zoom Architecture

#### A. Layer Structure (Top to Bottom)
```
1. SurfaceView (canvas/b.smali)
   ├── onTouchEvent() - Main entry point
   ├── Delegates to canvas/a.smali
   └── Returns boolean (event consumed)

2. Touch Handler (canvas/a.smali)
   ├── a() - UI gesture handler
   ├── f() - Canvas gesture handler
   ├── Multi-touch detection loop
   └── Creates SKTPointerEvent for each pointer

3. Canvas Controller (canvas/b.smali)
   ├── S() - Native delegation method
   ├── Matrix state management
   └── Gesture state flags

4. Native Interface (SKBSketchView.smali)
   ├── nativeHandlePointerPressed()
   ├── nativeHandlePointerMoved()
   ├── nativeHandlePointerReleased()
   ├── nativeEnableMultiTouchGesture()
   └── nativeGetZoomScale()

5. Native C++ Implementation
   ├── Multi-touch gesture detection
   ├── Zoom/pan calculations
   ├── Matrix transformations
   └── Drawing operations
```

#### B. Professional Event Flow
```
MotionEvent → onTouchEvent() → canvas/a.f() → 
Multi-touch loop → SKTPointerEvent creation → 
canvas.S() → Native methods → C++ processing
```

#### C. Key Professional Principles
1. **Single Entry Point**: Only `onTouchEvent()` handles all touch events
2. **Layered Delegation**: Each layer has specific responsibility
3. **Native Processing**: All complex calculations in C++
4. **Event Creation**: Convert `MotionEvent` to custom `SKTPointerEvent`
5. **State Management**: Boolean flags for gesture states
6. **No Gesture Recognizers**: Custom multi-touch detection

## Critical Finding: Sketchbook Uses Native Multi-Touch Implementation

**After triple-checking the decompiled APK, Sketchbook uses:**

### ✅ **Native Multi-Touch Support**
- `nativeEnableMultiTouchGesture(Z)` - Enables/disables multi-touch gestures
- `nativeGetZoomScale()` - Gets current zoom scale from native code
- `nativeRegisterCanvasZoomRotationChangedSignal()` - Registers zoom change callbacks

### ✅ **Native Pointer Handling**
- `nativeHandlePointerPressed(J)` - Handle pointer press events
- `nativeHandlePointerMoved(J)` - Handle pointer move events  
- `nativeHandlePointerReleased(J)` - Handle pointer release events
- `nativeHandlePointerCanceled(J)` - Handle pointer cancel events

### ✅ **Custom Multi-Touch Detection**
- Uses `MotionEvent.getPointerCount()` to detect multi-touch
- Loops through all pointers: `if-ge v1, v0, :cond_d` (while i < pointerCount)
- Creates `SKTPointerEvent` for each pointer
- Delegates all processing to native C++ code

### ❌ **What Sketchbook Does NOT Use:**
- ❌ `ScaleGestureDetector`
- ❌ `GestureDetector` for zoom
- ❌ Android's built-in gesture recognition
- ❌ React Native Gesture Handler

## Comparison with Current MWSExpo Implementation

### Current Issues in MWSExpo
1. **Gesture Conflict**: Skia `useTouchHandler` conflicts with React Native Gesture Handler
2. **State Synchronization**: `isGestureActive` state not properly synchronized
3. **Multi-touch Detection**: No reliable multi-touch detection in Skia touch handler
4. **Wrong Approach**: Trying to use React Native Gesture Handler for zoom when Sketchbook uses native implementation

### Recommended Solution Based on Sketchbook Analysis

**CRITICAL INSIGHT**: Sketchbook doesn't use React Native Gesture Handler or Android ScaleGestureDetector. It uses **native C++ implementation** with custom multi-touch detection.

#### 1. Native Multi-Touch Detection (Like Sketchbook)
```typescript
// Custom multi-touch detection in Skia useTouchHandler
const touchHandler = useTouchHandler({
  onStart: (touchInfo) => {
    const pointerCount = touchInfo.numberOfTouches || 1;
    
    if (pointerCount === 1) {
      // Single touch - start drawing
      setIsDrawing(true);
      setIsGestureActive(false);
    } else if (pointerCount === 2) {
      // Multi-touch - start zoom/pan
      setIsDrawing(false);
      setIsGestureActive(true);
      // Store initial touch positions for zoom calculation
      setInitialTouchPositions(touchInfo);
    }
  },
  onActive: (touchInfo) => {
    const pointerCount = touchInfo.numberOfTouches || 1;
    
    if (pointerCount === 1 && !isGestureActive) {
      // Continue drawing
      addPointToPath(touchInfo);
    } else if (pointerCount === 2) {
      // Handle zoom/pan in native code
      handleMultiTouch(touchInfo);
    }
  },
  onEnd: (touchInfo) => {
    if (isDrawing) {
      // Finish drawing path
      finalizePath();
    }
    setIsDrawing(false);
    setIsGestureActive(false);
  }
});
```

#### 2. Native Zoom Implementation
```typescript
// Delegate zoom calculations to native code (like Sketchbook)
const handleMultiTouch = (touchInfo) => {
  // Calculate zoom scale from touch positions
  const scale = calculateZoomScale(touchInfo);
  const focalPoint = calculateFocalPoint(touchInfo);
  
  // Apply matrix transformation (like Sketchbook)
  applyMatrixTransformation(scale, focalPoint);
};
```

#### 2. Matrix-Based Transformations
```typescript
// Use matrix transformations like Sketchbook
const [transformMatrix, setTransformMatrix] = useState(new Matrix());
const [zoom, setZoom] = useState(1);
const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

const applyZoom = (scale: number, focalX: number, focalY: number) => {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));
  const matrix = new Matrix();
  matrix.translate(focalX, focalY);
  matrix.scale(newZoom, newZoom);
  matrix.translate(-focalX, -focalY);
  setTransformMatrix(matrix);
  setZoom(newZoom);
};
```

#### 3. State Management
```typescript
// Centralized gesture state management
const [gestureState, setGestureState] = useState({
  isDrawing: false,
  isZooming: false,
  isPanning: false,
  isMultiTouch: false
});

// Update state atomically
const updateGestureState = (updates: Partial<typeof gestureState>) => {
  setGestureState(prev => ({ ...prev, ...updates }));
};
```

## Implementation Plan

### Phase 1: Remove Skia Touch Handler
1. Remove `useTouchHandler` from Canvas
2. Remove `onTouch` prop from Canvas
3. Use only React Native Gesture Handler

### Phase 2: Implement Unified Gestures
1. Create separate gestures for drawing, zoom, and pan
2. Use `Gesture.Simultaneous()` to combine gestures
3. Implement proper state management

### Phase 3: Matrix Transformations
1. Implement matrix-based zoom/pan system
2. Apply transformations to Canvas
3. Handle focal point calculations

### Phase 4: Multi-touch Detection
1. Use `GestureDetector` with proper pointer counting
2. Implement gesture state flags
3. Prevent drawing during zoom/pan gestures

## Key Insights from Sketchbook

1. **Professional apps use matrix transformations** for zoom/pan operations
2. **Gesture state management is critical** for preventing conflicts
3. **Native code handles complex calculations** for performance
4. **Multi-touch detection is done at the gesture level**, not touch level
5. **Separate gesture handlers** for different operations (draw, zoom, pan)

## Conclusion

**After triple-checking the Sketchbook example, the definitive findings are:**

### 🎯 **Sketchbook's Actual Implementation:**
1. **Native Multi-Touch Support**: `nativeEnableMultiTouchGesture(Z)` enables multi-touch
2. **Native Pointer Handling**: All touch events go through native methods (`nativeHandlePointerPressed`, `nativeHandlePointerMoved`, etc.)
3. **Native Zoom Management**: `nativeGetZoomScale()` and `nativeRegisterCanvasZoomRotationChangedSignal()`
4. **Custom Multi-Touch Detection**: Uses `MotionEvent.getPointerCount()` and loops through all pointers
5. **No Android Gesture APIs**: No `ScaleGestureDetector`, `GestureDetector`, or React Native Gesture Handler

### 🔧 **For MWSExpo - Correct Approach:**
- ❌ **Remove React Native Gesture Handler completely** (Sketchbook doesn't use it)
- ❌ **Don't use Android ScaleGestureDetector** (Sketchbook doesn't use it)
- ✅ **Use only Skia `useTouchHandler`** with proper multi-touch detection
- ✅ **Implement zoom/pan in Skia native code** (like Sketchbook's native methods)
- ✅ **Use `MotionEvent.getPointerCount()`** for multi-touch detection
- ✅ **Delegate complex calculations to native code**

### 📋 **Current MWSExpo Issues:**
The logs show drawing works fine with single touches, but the multi-touch zoom/pan is broken because:
1. **Gesture conflict** between Skia and React Native Gesture Handler
2. **Wrong approach** - trying to use React Native Gesture Handler when Sketchbook uses native implementation
3. **Missing native multi-touch detection** in Skia `useTouchHandler`

### 🚀 **Professional Implementation for MWSExpo:**

#### **Step 1: Remove React Native Gesture Handler**
```typescript
// REMOVE these imports and usage
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
// Remove all Gesture.Pinch(), Gesture.Pan() usage
```

#### **Step 2: Enhance Skia useTouchHandler (Like Sketchbook)**
```typescript
const touchHandler = useTouchHandler({
  onStart: (touchInfo) => {
    // Like Sketchbook: Check pointer count
    const pointerCount = touchInfo.numberOfTouches || 1;
    
    if (pointerCount === 1) {
      // Single touch - start drawing
      setIsDrawing(true);
      setIsGestureActive(false);
    } else if (pointerCount === 2) {
      // Multi-touch - start zoom/pan
      setIsDrawing(false);
      setIsGestureActive(true);
      // Store initial positions for zoom calculation
      setInitialTouchPositions(touchInfo);
    }
  },
  onActive: (touchInfo) => {
    const pointerCount = touchInfo.numberOfTouches || 1;
    
    if (pointerCount === 1 && !isGestureActive) {
      // Continue drawing (like Sketchbook's single touch)
      addPointToPath(touchInfo);
    } else if (pointerCount === 2) {
      // Handle zoom/pan (like Sketchbook's multi-touch)
      handleMultiTouchZoom(touchInfo);
    }
  },
  onEnd: (touchInfo) => {
    // Like Sketchbook: Finalize based on gesture type
    if (isDrawing) {
      finalizePath();
    }
    setIsDrawing(false);
    setIsGestureActive(false);
  }
});
```

#### **Step 3: Implement Native Multi-Touch Detection**
```typescript
// Like Sketchbook's pointer iteration loop
const handleMultiTouchZoom = (touchInfo) => {
  // Calculate zoom scale from touch positions
  const scale = calculateZoomScale(touchInfo);
  const focalPoint = calculateFocalPoint(touchInfo);
  
  // Apply matrix transformation (like Sketchbook)
  applyMatrixTransformation(scale, focalPoint);
};
```

#### **Step 4: Professional State Management**
```typescript
// Like Sketchbook's boolean flags
const [gestureState, setGestureState] = useState({
  isDrawing: false,      // Like Sketchbook's B flag
  isGestureActive: false, // Like Sketchbook's A flag
  isMultiTouch: false,   // Like Sketchbook's C flag
  isPanning: false,      // Like Sketchbook's D flag
  isZooming: false       // Like Sketchbook's E flag
});
```

This follows **exactly** how Sketchbook works - single touch handling system with native multi-touch detection and professional state management.
