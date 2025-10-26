# Complete Menu Rewrite Plan

## Current Issues
1. Menu not taking full vertical height
2. Text visibility issues in menu
3. Menu covering main content
4. Complex structure with PanGestureHandler conflicts
5. Z-index and positioning problems

## New Menu Architecture

### 1. Structure Simplification
```
ErrorBoundary
├── Main Content Container (always visible)
│   ├── Header
│   ├── Dashboard Content
│   └── Navigation
└── Overlay Menu System (conditional)
    ├── Menu Container (full screen)
    └── Backdrop (full screen)
```

### 2. Menu Container Design
- **Position**: `absolute` with `top-0 left-0`
- **Height**: Use `h-screen` or `min-h-screen` NativeWind classes
- **Width**: 60% of screen width
- **Z-index**: High enough to overlay everything
- **Background**: Solid color for visibility

### 3. Text Visibility Strategy
- Use explicit inline styles for ALL text elements
- Avoid NativeWind text classes that might not work
- Use high contrast colors (white text on dark background)
- Add text shadows if needed

### 4. Animation System
- Keep Reanimated for smooth animations
- Menu slides in from left edge
- Backdrop fades in/out
- Gesture handling for swipe to open/close

### 5. Implementation Steps

#### Step 1: Create New Menu Component
- Extract menu into separate component
- Clean structure with proper positioning
- Full height using NativeWind classes

#### Step 2: Fix Text Visibility
- Replace all NativeWind text classes with inline styles
- Ensure high contrast and visibility
- Test on different screen sizes

#### Step 3: Simplify Main Layout
- Remove complex nested structure
- Keep menu outside main content flow
- Ensure main content is always visible

#### Step 4: Animation Integration
- Connect Reanimated animations to new structure
- Test swipe gestures
- Ensure smooth open/close animations

#### Step 5: Testing
- Test menu visibility and text
- Test full height coverage
- Test animations and gestures
- Test on different devices

## Key Changes Needed

1. **Move menu outside PanGestureHandler**
2. **Use explicit height styling**
3. **Replace all text with inline styles**
4. **Simplify component structure**
5. **Ensure proper z-index hierarchy**

## Expected Result
- Menu takes full vertical screen height
- All text is clearly visible
- Menu overlays content properly
- Smooth animations preserved
- Main content always visible when menu closed
