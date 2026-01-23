# Performance Overlay

**Created**: January 2026
**Framework**: Svelte 5 with TypeScript

---

## Overview

The Performance Overlay is a real-time FPS (frames per second) monitoring tool built specifically for the Stellar Volumio POC. It provides visual feedback about rendering performance directly on the UI, helping developers identify performance issues, jank (stuttering), and dropped frames during development and testing.

This is especially useful when testing on resource-constrained devices like the Raspberry Pi 5 with its 1920x440 LCD panel, where maintaining smooth 60fps animations is critical for a premium user experience.

---

## What It Measures

### 1. FPS (Frames Per Second)
- **Definition**: The number of frames rendered per second
- **Target**: 60 FPS (16.67ms per frame)
- **Calculation**: Uses a rolling window of the last 60 frame times for stable readings
- **Display**: Large number in the overlay, color-coded for quick assessment

### 2. Frame Time
- **Definition**: Average time in milliseconds to render each frame
- **Target**: ≤16.67ms for 60fps
- **Display**: Shown as "Frame: Xms"

### 3. Frame Time Variance
- **Definition**: Standard deviation of frame times
- **Meaning**: Lower variance = smoother animation, higher variance = inconsistent performance
- **Display**: Shown as "Var: Xms"

### 4. Jank Count
- **Definition**: Number of frames that exceeded acceptable thresholds
- **Thresholds**:
  - Any frame taking >50ms (Long Task threshold)
  - Any frame taking >2x the recent average frame time
- **Display**: Only shown when jank has occurred, displayed in yellow

### 5. Dropped Frames
- **Definition**: Estimated number of frames that should have rendered but didn't
- **Calculation**: When a frame takes longer than 1.5x the expected 16.67ms, calculate how many frames were "missed"
- **Display**: Only shown when drops have occurred, displayed in red

---

## Color Coding

The FPS value is color-coded for quick visual assessment:

| FPS Range | Color | Status |
|-----------|-------|--------|
| ≥55 FPS | Green (#4ade80) | Good performance |
| 30-54 FPS | Yellow (#fbbf24) | Moderate performance |
| <30 FPS | Red (#ef4444) | Poor performance |

---

## Visual Components

### Main Display
- Large FPS number with "FPS" label
- Frame time in milliseconds
- Variance indicator
- Conditional jank and dropped frame indicators

### Frame Time Graph (Optional)
- SVG-based real-time graph showing last 60 frame times
- Green dashed line at 16.67ms (60fps target)
- Yellow dashed line at 33.33ms (30fps threshold)
- Graph line colored based on current FPS

### Control Buttons
- **Reset**: Clears all counters and graph data
- **Close**: Stops monitoring and hides the overlay

---

## Usage

### Enabling the Performance Overlay

The overlay is controlled via the browser console. Access it from:
- **On the Raspberry Pi**: Connect to Chrome DevTools at `http://192.168.86.34:9222`
- **In development**: Open browser DevTools console (F12)

```javascript
// Start FPS monitoring (shows the overlay)
__performance.start()

// Stop monitoring (hides the overlay)
__performance.stop()

// Toggle on/off
__performance.toggle()

// Reset all counters (keeps monitoring active)
__performance.reset()
```

### Component Props

When using the component directly in Svelte:

```svelte
<PerformanceOverlay
  position="top-right"
  showGraph={true}
  graphWidth={120}
  graphHeight={40}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'top-right'` | Corner position of the overlay |
| `showGraph` | `boolean` | `true` | Whether to display the frame time graph |
| `graphWidth` | `number` | `120` | Width of the graph in pixels |
| `graphHeight` | `number` | `40` | Height of the graph in pixels |

---

## Technical Implementation

### Performance Store (`$lib/stores/performance.ts`)

The overlay is powered by a Svelte store that manages the measurement loop:

```typescript
// Exported stores
export const performanceMetrics = writable<PerformanceMetrics>({...});
export const fpsEnabled = writable<boolean>(false);

// Exported actions
export const performanceActions = {
  start(): void,   // Begin measuring
  stop(): void,    // Stop measuring
  toggle(): void,  // Toggle on/off
  reset(): void    // Reset counters
};

// Derived stores
export const currentFps = derived(performanceMetrics, ($m) => $m.fps);
export const isPerformanceGood = derived(performanceMetrics, ($m) => $m.fps >= 55 && !$m.isJanky);
```

### Measurement Technique

Uses `requestAnimationFrame` with `DOMHighResTimeStamp` for accurate timing:

1. **Request animation frame** at start of monitoring
2. **Calculate delta time** between current and last timestamp
3. **Store frame time** in a rolling window buffer (60 samples)
4. **Calculate metrics** from the buffer:
   - Average frame time → FPS
   - Standard deviation → Variance
   - Compare to thresholds → Jank detection
   - Time gaps → Dropped frame estimation
5. **Update store** with new metrics
6. **Request next frame**

### Configuration Constants

```typescript
const FPS_SAMPLE_WINDOW = 60;        // Rolling window size
const JANK_THRESHOLD_MULTIPLIER = 2; // Frame time > 2x average = jank
const BIG_JANK_THRESHOLD_MS = 50;    // > 50ms is always jank
const DROPPED_FRAME_THRESHOLD = 1.5; // > 1.5x expected = dropped
const EXPECTED_FRAME_TIME = 16.67;   // Target 60fps
```

---

## Testing

### Unit Tests

The performance store and overlay component have comprehensive test coverage:

- **Performance store tests** (`src/lib/stores/__tests__/performance.test.ts`): 35 tests
  - Initial state verification
  - Start/stop/toggle functionality
  - FPS calculation accuracy
  - Jank detection thresholds
  - Dropped frame counting
  - Variance calculation
  - Rolling window behavior
  - Edge cases (very high/low FPS)

- **PerformanceOverlay tests** (`src/lib/components/__tests__/PerformanceOverlay.test.ts`): 26 tests
  - Visibility toggle based on fpsEnabled
  - FPS value display and rounding
  - Frame time and variance display
  - Jank/dropped frame conditional rendering
  - Color coding based on FPS
  - Control button functionality
  - Position prop handling
  - Graph display toggle

### Running Tests

```bash
cd volumio-poc

# Run all tests
npm run test:run

# Run with watch mode
npm test

# Run with coverage
npm run test:coverage
```

---

## Raspberry Pi Integration

### Accessing on the Pi

When running on the Raspberry Pi kiosk, you can enable the overlay remotely:

```bash
# SSH into the Pi
sshpass -p 'volumio' ssh volumio@192.168.86.34

# Execute JavaScript via Chrome DevTools
curl -s 'http://localhost:9222/json' | grep webSocketDebuggerUrl
# Use the WebSocket URL with websocat to send commands

# Or access from browser
# Navigate to http://192.168.86.34:8080
# Open DevTools and run: __performance.start()
```

### Performance Benchmarking

Use the overlay to compare different configurations:

1. **Chrome vs Cage vs Cog**: Compare FPS across different browsers
2. **GPU acceleration flags**: Test with/without specific flags
3. **Animation types**: CSS transforms vs JavaScript animations
4. **Load conditions**: Performance under different queue sizes

---

## Interpreting Results

### Good Performance
- FPS consistently ≥55 (green)
- Frame time ≤18ms
- Variance <2ms
- No jank or dropped frames

### Moderate Performance
- FPS 30-54 (yellow)
- Frame time 18-33ms
- Some occasional jank
- Acceptable for most use cases

### Poor Performance
- FPS <30 (red)
- Frame time >33ms
- High jank count
- Many dropped frames
- Indicates need for optimization

### What to Look For

| Symptom | Possible Cause |
|---------|----------------|
| Low but stable FPS | CPU/GPU bottleneck |
| High variance | Inconsistent workload, garbage collection |
| Sudden jank spikes | Heavy computation, layout thrashing |
| Gradual FPS decline | Memory leak, thermal throttling |

---

## Related Documentation

- [FPS Testing Research](./fps-testing-research.md) - Background research on FPS measurement techniques
- [Kiosk Browser Research](./kiosk-browser-research.md) - Alternative browser options for Raspberry Pi
