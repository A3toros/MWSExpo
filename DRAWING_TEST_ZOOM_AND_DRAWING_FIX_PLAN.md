# Drawing Test Zoom and Drawing Fix Plan

## Current Issues Identified

### 1. Zoom Problems
- **Zoom requires very slow finger movement** - Pinch gesture sensitivity is too low
- **Zoom only works when moving fingers very slowly** - Gesture detection is too restrictive
- **Complex boundary calculations** - Over-engineered zoom logic causing performance issues
- **CRITICAL: Drawing lines when trying to zoom** - Gesture conflict between pinch and touch handlers

### 2. Drawing Problems
- **Pencil draws straight lines instead of smooth curves** - Path creation uses `lineTo()` instead of smooth curves
- **Drawing conflicts with zoom gestures** - Multiple gesture handlers interfering with each other

### 3. Scroll Issues
- **Cannot scroll when touching outside canvas** - Gesture handling blocks parent ScrollView
- **Canvas area blocks all touch events** - Need to allow scrolling in non-canvas areas

## CRITICAL: Gesture Conflict Analysis

### Root Cause of "Drawing When Trying to Zoom"
The current implementation has **two competing gesture systems**:

1. **`Gesture.Simultaneous(pinchGesture, twoFingerPan)`** (Line 223) - Handles zoom/pan
2. **`touchHandler`** (Line 225) - Handles drawing

**What happens when you pinch to zoom:**
1. You pinch with two fingers
2. The `pinchGesture` starts and tries to handle zoom
3. **BUT** the `touchHandler` also receives the same touch events
4. The `touchHandler` sees the first touch point and starts drawing a line
5. Both systems fight over the same touch events

**The Problem:**
- **Line 175**: `cancelsTouchesInView(false)` - Pinch gesture doesn't cancel touches
- **Line 223**: `Gesture.Simultaneous()` - Both gestures run simultaneously
- **Line 225**: `touchHandler` - Drawing handler processes the same touches

**Result:** When you try to zoom, you get drawing lines instead of zooming.

## Analysis from react-native-free-canvas

### Key Insights
1. **Simpler Zoom Logic**: Uses direct scale multiplication (`scale * scaleEndSharedVal.value`)
2. **Combined Gestures**: Single pan gesture handles both drawing and panning based on pointer count
3. **Better Transform Handling**: Uses `useAnimatedStyle` with transform array and proper transform origin
4. **Smooth Animations**: Uses `withTiming` for focal point animations

## Fix Plan

### Phase 1: Simplify Zoom Implementation

#### 1.1 Replace Complex Zoom Logic
**Current (Lines 151-168 in DrawingCanvas.tsx):**
```typescript
const updatePinch = (scale: number, focalX: number, focalY: number) => {
  if (!pinchStartRef.current) return;
  const base = pinchStartRef.current;
  const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base.zoom * scale));
  const targetScreenX = focalX;
  const targetScreenY = focalY;
  const newPanX = targetScreenX - base.focusX * nextZoom;
  const newPanY = targetScreenY - base.focusY * nextZoom;
  setZoom(nextZoom);
  // Complex boundary calculations...
};
```

**New (Based on free-canvas):**
```typescript
const updatePinch = (scale: number, focalX: number, focalY: number) => {
  'worklet';
  const resScale = scale * scaleEndSharedVal.value;
  if (resScale < MIN_ZOOM || resScale > MAX_ZOOM) {
    return;
  }
  scaleSharedVal.value = resScale;
  originSharedVal.value = withTiming([focalX, focalY], { duration: 200 });
};
```

#### 1.2 Use Shared Values for Zoom State
```typescript
const scaleSharedVal = useSharedValue(1);
const scaleEndSharedVal = useSharedValue(1);
const originSharedVal = useSharedValue([0, 0] as [number, number]);
```

#### 1.3 Apply Transform with useAnimatedStyle
```typescript
const scaledStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: translateSharedVal.value.x },
    { translateY: translateSharedVal.value.y },
    { scale: scaleSharedVal.value },
  ],
  transformOrigin: originSharedVal.value.concat([0]),
}));
```

### Phase 2: Fix Drawing with Smooth Curves

#### 2.1 Replace Straight Line Path Creation
**Current (Lines 398-407):**
```typescript
const pointsToPath = useCallback((points: any[]) => {
  const path = Skia.Path.Make();
  if (points.length > 0) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y); // Creates straight lines
    }
  }
  return path;
}, []);
```

**New (Smooth Curves):**
```typescript
const pointsToPath = useCallback((points: any[]) => {
  const path = Skia.Path.Make();
  if (points.length > 0) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      if (i === 1) {
        path.lineTo(points[i].x, points[i].y);
      } else {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        const cpy = (prev.y + curr.y) / 2;
        path.quadTo(prev.x, prev.y, cpx, cpy);
      }
    }
  }
  return path;
}, []);
```

#### 2.2 Improve Point Sampling
- Increase touch event frequency for smoother curves
- Add point filtering to reduce noise while maintaining smoothness

### Phase 3: Fix Gesture Conflicts (CRITICAL)

#### 3.1 Immediate Fix: Prevent Drawing During Multi-Touch
**Current Problem:** Touch handler processes multi-touch events and starts drawing

**Quick Fix:** Add pointer count check to touch handler:
```typescript
const touchHandler = useTouchHandler({
  onStart: ({ x, y, numberOfTouches }) => {
    // CRITICAL: Don't start drawing if this is a multi-touch gesture
    if (numberOfTouches > 1) {
      console.log('DrawingCanvas: Multi-touch detected, ignoring drawing');
      return; // Let pinch/pan gestures handle this
    }
    
    // Only process touches within canvas bounds
    if (!isTouchInCanvas(x, y)) {
      return; // Let parent ScrollView handle this touch
    }
    
    // Rest of drawing logic...
  },
  onActive: ({ x, y, numberOfTouches }) => {
    // CRITICAL: Don't draw if this is a multi-touch gesture
    if (numberOfTouches > 1) {
      return; // Let pinch/pan gestures handle this
    }
    
    // Rest of drawing logic...
  },
  onEnd: ({ numberOfTouches }) => {
    // CRITICAL: Don't finalize drawing if this was a multi-touch gesture
    if (numberOfTouches > 1) {
      return; // Let pinch/pan gestures handle this
    }
    
    // Rest of drawing logic...
  }
});
```

#### 3.2 Long-term Fix: Replace Multiple Gesture Handlers
**Current:** Separate pinch, pan, and touch handlers causing conflicts

**New:** Single pan gesture that handles all interactions:
```typescript
const panGesture = useMemo(() =>
  Gesture.Pan()
    .averageTouches(true)
    .onStart(e => {
      'worklet';
      if (e.numberOfPointers > 1) {
        // Handle zoom/pan
        return;
      }
      // Handle drawing
    })
    .onUpdate(e => {
      'worklet';
      if (e.numberOfPointers > 1 && zoomable) {
        // Handle zoom/pan
        context?.setTranslate(e.translationX, e.translationY);
        return;
      }
      // Handle drawing
    })
    .onFinalize(e => {
      'worklet';
      // Finalize based on gesture type
    }),
  [zoomable]
);
```

#### 3.3 Remove Gesture Conflicts
- Remove separate pinch gesture
- Remove `shouldCancelWhenOutside(true)` 
- Use `cancelsTouchesInView(false)` to allow parent scrolling

### Phase 4: Enable Parent ScrollView

#### 4.1 Fix Touch Event Propagation
**Current:** Canvas blocks all touch events

**New:** Allow touch events outside canvas to propagate to parent:
```typescript
const isTouchInCanvas = useCallback((x: number, y: number) => {
  'worklet';
  return x >= 0 && x <= width && y >= 0 && y <= height;
}, [width, height]);

// In gesture handlers:
if (!isTouchInCanvas(x, y)) {
  return; // Let parent ScrollView handle this touch
}
```

#### 4.2 Update ScrollView Configuration
```typescript
<ScrollView 
  className="flex-1"
  scrollEnabled={!isDrawing && !isGestureActive}
  onScrollBeginDrag={handleScrollBegin}
  onScrollEndDrag={handleScrollEnd}
  onMomentumScrollBegin={handleScrollBegin}
  onMomentumScrollEnd={handleScrollEnd}
>
```

### Phase 5: Maintain Current Features

#### 5.1 Keep Zoom Limits
- Maintain `MIN_ZOOM = 1` and `MAX_ZOOM = 5`
- Keep zoom range validation in new implementation

#### 5.2 Keep Pan Boundaries
- Maintain content boundary clamping
- Ensure content remains drawable when zoomed out

#### 5.3 Keep Tool Functionality
- Maintain all current tools (pencil, line, rectangle, circle, eraser, text, pan)
- Keep tool-specific behavior and styling

## Implementation Order

1. **Phase 3.1 (CRITICAL)**: Fix gesture conflicts - prevent drawing during multi-touch
2. **Phase 1**: Simplify zoom implementation with shared values
3. **Phase 2**: Fix drawing with smooth curves
4. **Phase 3.2**: Long-term gesture handling improvements
5. **Phase 4**: Enable parent ScrollView
6. **Phase 5**: Test and validate all features

**Note:** Phase 3.1 should be implemented FIRST as it fixes the critical "drawing when trying to zoom" issue.

## Expected Results

### Zoom Improvements
- ✅ Responsive zoom with normal finger movement speed
- ✅ Smooth zoom animations with proper focal point
- ✅ Maintained zoom limits (1x to 5x)
- ✅ Better performance with simpler math

### Drawing Improvements
- ✅ Smooth pencil curves instead of straight lines
- ✅ Better touch responsiveness
- ✅ No gesture conflicts between drawing and zooming

### Scroll Improvements
- ✅ Can scroll when touching outside canvas area
- ✅ Canvas only captures touches within its bounds
- ✅ Smooth interaction between canvas and ScrollView

## Files to Modify

1. **`MWSExpo/src/components/DrawingCanvas.tsx`**
   - Replace zoom logic with shared values approach
   - Fix path creation for smooth curves
   - Combine gesture handlers
   - Improve touch event handling

2. **`MWSExpo/app/tests/drawing/[testId]/index.tsx`**
   - Update ScrollView configuration if needed
   - Test scroll behavior with new canvas implementation

## Testing Checklist

### Critical Tests (Must Pass)
- [ ] **CRITICAL: Zoom works without drawing lines** - Pinch gesture doesn't trigger drawing
- [ ] **CRITICAL: Multi-touch gestures don't interfere with drawing** - Single touch still draws normally
- [ ] Zoom works with normal finger movement speed
- [ ] Zoom maintains proper limits (1x to 5x)

### Drawing Tests
- [ ] Pencil draws smooth curves, not straight lines
- [ ] All tools work correctly (line, rectangle, circle, eraser, text, pan)
- [ ] Single finger drawing works normally
- [ ] Tool switching works correctly

### Scroll and Interaction Tests
- [ ] Can scroll when touching outside canvas area
- [ ] Canvas only captures touches within its bounds
- [ ] No gesture conflicts between drawing and zooming
- [ ] Two-finger pan works correctly
- [ ] Two-finger zoom works correctly

### Performance Tests
- [ ] Performance is smooth and responsive
- [ ] No lag during zoom operations
- [ ] No lag during drawing operations
- [ ] All existing features are preserved
