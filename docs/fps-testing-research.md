# FPS Testing and Performance Monitoring

**Research Date**: January 2026
**Target Framework**: Svelte 5 with TypeScript
**Target Hardware**: Raspberry Pi 5 with 1920x440 LCD display

---

## Overview

This document covers best practices for implementing FPS (frames per second) testing and performance monitoring in web applications, specifically tailored for the Stellar Volumio POC.

---

## Browser-based FPS Measurement Techniques

### requestAnimationFrame Timing

The foundation of FPS measurement uses `requestAnimationFrame` (rAF) with `performance.now()`:

```typescript
let lastTimestamp = 0;
let frameCount = 0;
let fps = 0;

function measureFrame(timestamp: DOMHighResTimeStamp) {
  const deltaTime = timestamp - lastTimestamp;

  if (deltaTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTimestamp = timestamp;
  }

  frameCount++;
  requestAnimationFrame(measureFrame);
}

requestAnimationFrame(measureFrame);
```

### Rolling Window Approach (Recommended)

For stable readings, use a rolling window instead of single-frame calculations:

```typescript
const FPS_SAMPLE_WINDOW = 60;
let frameTimes: number[] = [];

function measureFrame(timestamp: DOMHighResTimeStamp) {
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  frameTimes.push(deltaTime);
  if (frameTimes.length > FPS_SAMPLE_WINDOW) {
    frameTimes.shift();
  }

  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const fps = 1000 / avgFrameTime;

  requestAnimationFrame(measureFrame);
}
```

### Long Animation Frames API (LoAF)

Modern Chrome supports the Long Animation Frames API for detailed timing:

```typescript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      console.log('Long animation frame:', entry.duration, 'ms');
    }
  }
});

observer.observe({ type: 'long-animation-frame', buffered: true });
```

---

## Jank Detection

### What is Jank?

Jank occurs when frames take longer than expected, causing visible stuttering:
- **Target**: 16.67ms per frame (60 FPS)
- **Jank threshold**: Frame time > 2x average
- **Big Jank**: Frame time > 50ms (Long Task threshold)

### Detection Algorithm

```typescript
const JANK_THRESHOLD_MULTIPLIER = 2;
const BIG_JANK_THRESHOLD_MS = 50;

function detectJank(currentDeltaTime: number, recentTimes: number[]): boolean {
  // Always jank if over Long Task threshold
  if (currentDeltaTime > BIG_JANK_THRESHOLD_MS) {
    return true;
  }

  // Check against recent average
  if (recentTimes.length >= 3) {
    const recentAverage = recentTimes.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (currentDeltaTime > recentAverage * JANK_THRESHOLD_MULTIPLIER) {
      return true;
    }
  }

  return false;
}
```

---

## Existing Libraries

### stats.js

The most popular FPS monitor, created by mrdoob (Three.js creator):

```bash
npm install stats.js
```

```typescript
import Stats from 'stats.js';

const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  // ... render code ...
  stats.end();
  requestAnimationFrame(animate);
}
```

### Svelte-Specific Options

1. **@sveu/browser FPS utility**: Reactive FPS tracking
2. **Svelte Tweakpane UI FpsGraph**: Visual FPS graph component
3. **Svelcro**: Component performance tracker

---

## Hardware Monitoring for Raspberry Pi

### Temperature Monitoring

```bash
# CPU/GPU temperature
vcgencmd measure_temp

# From system file (divide by 1000 for Celsius)
cat /sys/class/thermal/thermal_zone0/temp

# Continuous monitoring
watch -n 2 vcgencmd measure_temp

# Check throttling status (0x0 = no throttling)
vcgencmd get_throttled
```

### Throttling Flags

| Bit | Hex | Meaning |
|-----|-----|---------|
| 0 | 0x1 | Under-voltage detected |
| 1 | 0x2 | Arm frequency capped |
| 2 | 0x4 | Currently throttled |
| 3 | 0x8 | Soft temperature limit active |
| 16 | 0x10000 | Under-voltage has occurred |
| 17 | 0x20000 | Arm frequency capping has occurred |
| 18 | 0x40000 | Throttling has occurred |
| 19 | 0x80000 | Soft temperature limit has occurred |

### Memory Monitoring

```bash
# Memory usage
free -h

# Detailed memory info
cat /proc/meminfo
```

---

## Performance Testing Tools

### Browser-based Tests

| Tool | URL | Purpose |
|------|-----|---------|
| TestUFO | https://testufo.com/ | FPS and refresh rate testing |
| VSyncTester | https://www.vsynctester.com/ | VSYNC detection |
| Screen Tearing Test | https://ap0t.com/device-tools/screen-tearing-test | Tearing detection |
| GSAP Speed Test | https://gsap.com/js/speed.html | Animation library comparison |

### Chromium GPU Verification

Navigate to `chrome://gpu` to verify:
- Graphics Feature Status shows "Hardware accelerated"
- GL_RENDERER shows V3D (not llvmpipe)

---

## Animation Performance Best Practices

### Use GPU-Accelerated Properties

```css
/* Good - GPU accelerated */
.animated {
  transform: translateX(100px);
  opacity: 0.5;
}

/* Avoid - triggers layout */
.animated {
  left: 100px;
  width: 200px;
}
```

### will-change Hint

```css
.will-animate {
  will-change: transform, opacity;
}
```

### Compositor-Only Animations

Only `transform` and `opacity` can be animated on the compositor thread without triggering main thread work.

---

## Implementation Plan for Stellar POC

### Components to Create

1. **PerformanceStore** (`src/lib/stores/performance.ts`)
   - FPS measurement with rolling window
   - Jank detection
   - Dropped frame counting

2. **PerformanceOverlay** (`src/lib/components/PerformanceOverlay.svelte`)
   - Visual FPS display
   - Frame time graph
   - Jank indicators

3. **AnimationBenchmark** (`src/lib/components/AnimationBenchmark.svelte`)
   - CSS animation test
   - JavaScript animation test
   - Canvas animation test
   - Results comparison

4. **HardwareMonitor** (Backend support required)
   - CPU temperature
   - Throttling status
   - Memory usage

---

## References

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)
- [Chrome: Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames)
- [web.dev: Animation Smoothness](https://web.dev/smoothness)
- [stats.js GitHub](https://github.com/mrdoob/stats.js)
- [Raspberry Pi Temperature Monitoring](https://www.cyberciti.biz/faq/linux-find-out-raspberry-pi-gpu-and-arm-cpu-temperature-command/)
