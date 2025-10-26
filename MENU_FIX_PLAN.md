# Swipe Menu Fix Plan

## Problem Analysis
The swipe menu is currently invisible because:
1. Menu is outside gesture handler but not properly positioned
2. Z-index conflicts with other components
3. Menu structure is broken - needs to be a proper overlay

## Solution Strategy

### 1. Menu Structure (Proper Overlay)
```
<ErrorBoundary>
  {/* Main App Content */}
  <PanGestureHandler>
    <View>
      {/* All app content */}
    </View>
  </PanGestureHandler>
  
  {/* Menu Overlay - Outside everything, highest z-index */}
  <Animated.View style={menuAnimatedStyle}>
    {/* Menu content */}
  </Animated.View>
  
  {/* Backdrop Overlay - When menu is open */}
  {isMenuOpen && (
    <Animated.View style={backdropAnimatedStyle}>
      {/* Backdrop */}
    </Animated.View>
  )}
</ErrorBoundary>
```

### 2. Z-Index Hierarchy
- Menu: `zIndex: 1000` (highest)
- Backdrop: `zIndex: 999` (second highest)
- Main content: `zIndex: 1` (lowest)

### 3. Menu Positioning
- `position: 'absolute'`
- `top: 0, left: 0`
- `height: '100%'`
- `width: '60%' of screen`
- `transform: [{ translateX: menuTranslateX }]`

### 4. Backdrop Positioning
- `position: 'absolute'`
- `top: 0, left: 0, right: 0, bottom: 0`
- `backgroundColor: 'rgba(0, 0, 0, 0.5)'`
- Only visible when `isMenuOpen` is true

### 5. Gesture Handling
- Keep gesture handler on main content
- Menu slides in from left (-60% width to 0)
- Backdrop fades in/out with menu

## Implementation Steps

1. **Move menu outside PanGestureHandler** ✅
2. **Fix menu positioning and z-index** 
3. **Fix backdrop conditional rendering**
4. **Test swipe functionality**
5. **Test menu button functionality**
6. **Test backdrop tap to close**

## Expected Result
- Menu slides in from left when swiping or tapping button
- Menu overlays ALL content (header, scrollview, everything)
- Backdrop appears behind menu
- Smooth animations with Reanimated
- NativeWind styling preserved
