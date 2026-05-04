<script lang="ts">
  /**
   * FullscreenPlayer — Immersive now-playing view with visualizations.
   * Triggered by the spectrum button on NowPlayingPanel.
   * Shows: album art (left) + track info (center) + animated viz (right).
   * Tap anywhere to dismiss back to Gallery.
   */
  import { onMount, onDestroy } from 'svelte';
  import { vizMode, vizStyle, defaultVizMode, type FullscreenVizMode } from '$lib/stores/viz';
  import { currentTrack, isPlaying, seek, duration, trackQuality, formatSampleRate } from '$lib/stores/player';
  import { spectrumData, SPECTRUM_NUM_BINS } from '$lib/stores/spectrum';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animId: number;
  let startTime = 0;
  let fps = 0;
  let frameCount = 0;
  let lastFpsTime = 0;

  // Viz modes
  const MODES = ['bars', 'vu-digital', 'vu-analog', 'waveform'] as const;
  type VizMode = typeof MODES[number];
  let currentVizMode: VizMode = $defaultVizMode as VizMode;
  let modeLabelVisible = false;
  let modeLabelTimeout: ReturnType<typeof setTimeout>;

  const MODE_LABELS: Record<VizMode, string> = {
    'bars': 'FREQUENCY BARS',
    'vu-digital': 'DIGITAL VU METER',
    'vu-analog': 'ANALOG VU METER',
    'waveform': 'WAVEFORM'
  };

  function showModeLabel() {
    modeLabelVisible = true;
    clearTimeout(modeLabelTimeout);
    modeLabelTimeout = setTimeout(() => { modeLabelVisible = false; }, 2000);
  }

  function cycleMode(e: MouseEvent) {
    e.stopPropagation();
    const idx = MODES.indexOf(currentVizMode);
    currentVizMode = MODES[(idx + 1) % MODES.length];
    showModeLabel();
  }

  function dismiss() {
    vizMode.set(false);
  }

  // ─── Audio Data from Spectrum Store ───
  const NUM_BARS = 48;
  const barData = new Float32Array(NUM_BARS);
  const barTargets = new Float32Array(NUM_BARS);
  const barVelocities = new Float32Array(NUM_BARS);
  const WAVE_POINTS = 200;
  const waveData = new Float32Array(WAVE_POINTS);

  // Subscribe to spectrum store and resample into barTargets/waveData
  let currentSpectrum = new Float32Array(SPECTRUM_NUM_BINS);
  const unsubSpectrum = spectrumData.subscribe((data) => {
    currentSpectrum = data;
  });

  function updateFromSpectrum() {
    // Resample SPECTRUM_NUM_BINS → NUM_BARS for bar targets
    const ratio = SPECTRUM_NUM_BINS / NUM_BARS;
    for (let i = 0; i < NUM_BARS; i++) {
      const srcStart = Math.floor(i * ratio);
      const srcEnd = Math.min(Math.floor((i + 1) * ratio), SPECTRUM_NUM_BINS);
      let sum = 0;
      for (let j = srcStart; j < srcEnd; j++) sum += currentSpectrum[j];
      barTargets[i] = sum / Math.max(1, srcEnd - srcStart);
    }

    // Generate waveform from spectrum data (inverse-ish: sum of sinusoids weighted by bins)
    for (let i = 0; i < WAVE_POINTS; i++) {
      const t = i / WAVE_POINTS;
      let val = 0;
      // Use first 32 bins as harmonic amplitudes
      const harmonics = Math.min(32, SPECTRUM_NUM_BINS);
      for (let h = 0; h < harmonics; h++) {
        val += currentSpectrum[h] * Math.sin(t * Math.PI * 2 * (h + 1) * 0.5);
      }
      waveData[i] = val / harmonics * 2;
    }
  }

  function smoothBars() {
    for (let i = 0; i < NUM_BARS; i++) {
      const diff = barTargets[i] - barData[i];
      barVelocities[i] += diff * 0.25;
      barVelocities[i] *= 0.72;
      barData[i] += barVelocities[i];
      barData[i] = Math.max(0.01, Math.min(1, barData[i]));
    }
  }

  // ─── Draw: Frequency Bars ───
  function drawBars(time: number) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const gap = 3, margin = 20;
    const drawW = W - margin * 2;
    const totalGap = gap * (NUM_BARS - 1);
    const barW = (drawW - totalGap) / NUM_BARS;
    const maxH = H - 60;

    const bgGlow = ctx.createRadialGradient(W/2, H, 0, W/2, H, W * 0.7);
    bgGlow.addColorStop(0, 'rgba(120, 30, 80, 0.08)');
    bgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < NUM_BARS; i++) {
      const val = barData[i];
      const x = margin + i * (barW + gap);
      const h = val * maxH;
      ctx.save();
      ctx.shadowColor = `rgba(255, 80, 180, ${val * 0.4})`;
      ctx.shadowBlur = 8 + val * 14;
      const g = ctx.createLinearGradient(x, H - 20, x, H - 20 - h);
      g.addColorStop(0, 'rgba(90, 20, 80, 0.9)');
      g.addColorStop(0.3, 'rgba(160, 40, 100, 0.9)');
      g.addColorStop(0.6, 'rgba(255, 100, 170, 0.85)');
      g.addColorStop(1, `rgba(255, 177, 200, ${0.7 + val * 0.3})`);
      ctx.fillStyle = g;
      const r = Math.min(barW / 2, 2);
      ctx.beginPath();
      ctx.roundRect(x, H - 20 - h, barW, h, [r, r, 0, 0]);
      ctx.fill();
      ctx.restore();
      if (val > 0.1) {
        ctx.fillStyle = `rgba(255, 220, 240, ${val * 0.8})`;
        ctx.fillRect(x, H - 20 - h, barW, 2);
      }
    }
  }

  // ─── Draw: Digital VU Meter ───
  const vuPeakL = { value: 0, decay: 0 };
  const vuPeakR = { value: 0, decay: 0 };

  function drawVU(_time: number) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    let levelL = 0, levelR = 0;
    for (let i = 0; i < NUM_BARS; i++) {
      if (i % 2 === 0) levelL += barData[i]; else levelR += barData[i];
    }
    levelL = Math.min(1, (levelL / (NUM_BARS / 2)) * 2.2);
    levelR = Math.min(1, (levelR / (NUM_BARS / 2)) * 2.2);

    if (levelL > vuPeakL.value) { vuPeakL.value = levelL; vuPeakL.decay = 0; }
    else { vuPeakL.decay += 0.02; vuPeakL.value = Math.max(levelL, vuPeakL.value - vuPeakL.decay * 0.03); }
    if (levelR > vuPeakR.value) { vuPeakR.value = levelR; vuPeakR.decay = 0; }
    else { vuPeakR.decay += 0.02; vuPeakR.value = Math.max(levelR, vuPeakR.value - vuPeakR.decay * 0.03); }

    const numSegments = 32, meterWidth = 180, segH = 10, segGap = 2;
    const meterH = numSegments * (segH + segGap);
    const startY = (H - meterH) / 2;
    const leftX = (W / 2) - meterWidth - 30;
    const rightX = (W / 2) + 30;

    ctx.font = '600 16px "Plus Jakarta Sans"';
    ctx.fillStyle = 'rgba(255, 177, 200, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('L', leftX + meterWidth / 2, startY - 12);
    ctx.fillText('R', rightX + meterWidth / 2, startY - 12);

    function drawMeter(x: number, level: number, peak: { value: number }) {
      for (let i = 0; i < numSegments; i++) {
        const segNorm = (i + 1) / numSegments;
        const y = startY + meterH - (i + 1) * (segH + segGap);
        const isLit = segNorm <= level;
        const isPeak = Math.abs(segNorm - peak.value) < 1 / numSegments;
        if (isLit || isPeak) {
          let color: string;
          if (segNorm > 0.9) color = 'rgba(255, 60, 60, 0.95)';
          else if (segNorm > 0.7) color = 'rgba(255, 180, 60, 0.9)';
          else color = `rgba(255, 177, 200, ${0.5 + segNorm * 0.5})`;
          ctx.fillStyle = color;
          if (isLit) { ctx.shadowColor = color; ctx.shadowBlur = 4 + segNorm * 6; }
          ctx.fillRect(x, y, meterWidth, segH);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = 'rgba(81, 67, 71, 0.3)';
          ctx.fillRect(x, y, meterWidth, segH);
        }
      }
    }
    drawMeter(leftX, levelL, vuPeakL);
    drawMeter(rightX, levelR, vuPeakR);

    ctx.font = '500 13px "Roboto Mono"';
    ctx.fillStyle = 'rgba(255, 177, 200, 0.7)';
    ctx.textAlign = 'center';
    const dbL = levelL > 0.001 ? (20 * Math.log10(levelL)).toFixed(1) : '-∞';
    const dbR = levelR > 0.001 ? (20 * Math.log10(levelR)).toFixed(1) : '-∞';
    ctx.fillText(`${dbL} dB`, leftX + meterWidth / 2, startY + meterH + 24);
    ctx.fillText(`${dbR} dB`, rightX + meterWidth / 2, startY + meterH + 24);
  }

  // ─── Draw: Analog VU Meter ───
  const needleL = { angle: 0, velocity: 0 };
  const needleR = { angle: 0, velocity: 0 };

  function drawAnalogVU(_time: number) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Calculate L/R levels
    let levelL = 0, levelR = 0;
    for (let i = 0; i < NUM_BARS; i++) {
      if (i % 2 === 0) levelL += barData[i]; else levelR += barData[i];
    }
    levelL = Math.min(1, (levelL / (NUM_BARS / 2)) * 2.2);
    levelR = Math.min(1, (levelR / (NUM_BARS / 2)) * 2.2);

    const meterW = 200;
    const meterH = 200;
    const spacing = 40;
    const totalW = meterW * 2 + spacing;
    const startX = (W - totalW) / 2;
    const startY = (H - meterH) / 2 - 10;

    function drawMeter(cx: number, cy: number, radius: number, level: number, needle: { angle: number; velocity: number }, label: string) {
      // Needle physics: target angle from -45° to +45° mapped to level
      const minAngle = -Math.PI * 0.3;  // -54°
      const maxAngle = Math.PI * 0.3;   // +54°
      const targetAngle = minAngle + level * (maxAngle - minAngle);

      // Spring-damper physics for realistic needle movement
      const springK = 12;
      const damping = 0.65;
      const dt = 1 / 60;
      const force = (targetAngle - needle.angle) * springK;
      needle.velocity += force * dt;
      needle.velocity *= (1 - damping * dt * 4);
      needle.angle += needle.velocity * dt;

      // Meter background (dark arc)
      ctx.save();
      ctx.translate(cx, cy + radius * 0.4);

      // Outer rim glow
      ctx.beginPath();
      ctx.arc(0, 0, radius + 4, Math.PI + 0.3, -0.3, false);
      ctx.strokeStyle = 'rgba(255, 177, 200, 0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scale arc background
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI + 0.3, -0.3, false);
      ctx.strokeStyle = 'rgba(81, 67, 71, 0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Scale markings
      const numTicks = 21;
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const tickAngle = (Math.PI + 0.3) + t * (Math.PI - 0.6);
        const isMain = i % 5 === 0;
        const innerR = radius - (isMain ? 20 : 12);
        const outerR = radius - 4;

        ctx.beginPath();
        ctx.moveTo(Math.cos(tickAngle) * innerR, Math.sin(tickAngle) * innerR);
        ctx.lineTo(Math.cos(tickAngle) * outerR, Math.sin(tickAngle) * outerR);
        ctx.strokeStyle = i > numTicks * 0.8
          ? 'rgba(255, 80, 80, 0.7)'
          : 'rgba(255, 177, 200, 0.4)';
        ctx.lineWidth = isMain ? 2 : 1;
        ctx.stroke();

        // dB labels on main ticks
        if (isMain) {
          const db = Math.round(-20 + (t * 23));
          const labelR = innerR - 12;
          ctx.font = '500 10px "Roboto Mono"';
          ctx.fillStyle = 'rgba(255, 177, 200, 0.5)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${db}`, Math.cos(tickAngle) * labelR, Math.sin(tickAngle) * labelR);
        }
      }

      // Colored arc for level (green zone → yellow → red)
      const levelEndAngle = (Math.PI + 0.3) + (level * (Math.PI - 0.6));
      if (level > 0.01) {
        ctx.beginPath();
        ctx.arc(0, 0, radius - 2, Math.PI + 0.3, levelEndAngle, false);
        const arcGrad = ctx.createLinearGradient(-radius, 0, radius, 0);
        arcGrad.addColorStop(0, 'rgba(255, 177, 200, 0.6)');
        arcGrad.addColorStop(0.7, 'rgba(255, 177, 200, 0.8)');
        arcGrad.addColorStop(1, 'rgba(255, 80, 80, 0.9)');
        ctx.strokeStyle = arcGrad;
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Needle
      const needleAngle = Math.PI + 0.3 + ((needle.angle - minAngle) / (maxAngle - minAngle)) * (Math.PI - 0.6);
      const needleLen = radius - 8;

      // Needle shadow
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(needleAngle) * needleLen, Math.sin(needleAngle) * needleLen);
      ctx.strokeStyle = 'rgba(255, 177, 200, 0.15)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Needle body
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(needleAngle) * needleLen, Math.sin(needleAngle) * needleLen);
      const needleColor = level > 0.85 ? 'rgba(255, 100, 100, 0.95)' : 'rgba(255, 220, 240, 0.9)';
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Needle glow at tip
      ctx.beginPath();
      ctx.arc(
        Math.cos(needleAngle) * needleLen,
        Math.sin(needleAngle) * needleLen,
        3, 0, Math.PI * 2
      );
      ctx.fillStyle = needleColor;
      ctx.shadowColor = needleColor;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pivot point
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 177, 200, 0.5)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 220, 240, 0.8)';
      ctx.fill();

      ctx.restore();

      // Channel label
      ctx.font = '600 16px "Plus Jakarta Sans"';
      ctx.fillStyle = 'rgba(255, 177, 200, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + radius * 0.4 + radius + 24);

      // dB readout
      const db = level > 0.001 ? (20 * Math.log10(level)).toFixed(1) : '-∞';
      ctx.font = '500 13px "Roboto Mono"';
      ctx.fillStyle = 'rgba(255, 177, 200, 0.7)';
      ctx.fillText(`${db} dB`, cx, cy + radius * 0.4 + radius + 44);
    }

    const r = meterW / 2 - 10;
    drawMeter(startX + meterW / 2, startY + meterH / 2, r, levelL, needleL, 'L');
    drawMeter(startX + meterW + spacing + meterW / 2, startY + meterH / 2, r, levelR, needleR, 'R');

    // "VU" text centered
    ctx.font = '300 24px "Plus Jakarta Sans"';
    ctx.fillStyle = 'rgba(255, 177, 200, 0.15)';
    ctx.textAlign = 'center';
    ctx.fillText('VU', W / 2, startY + meterH / 2 - 20);
  }

  // ─── Draw: Waveform ───
  function drawWaveform(_time: number) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const margin = 30, drawW = W - margin * 2, centerY = H / 2, amplitude = H * 0.35;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 177, 200, 0.4)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(255, 177, 200, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < WAVE_POINTS; i++) {
      const x = margin + (i / WAVE_POINTS) * drawW;
      const y = centerY + waveData[i] * amplitude;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(81, 67, 71, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(margin, centerY);
    ctx.lineTo(W - margin, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ─── Animation Loop ───
  function animate(now: number) {
    if (!canvas || !ctx) return;
    const time = (now - startTime) / 1000;
    frameCount++;
    if (now - lastFpsTime > 1000) { fps = frameCount; frameCount = 0; lastFpsTime = now; }

    updateFromSpectrum();
    smoothBars();

    switch (currentVizMode) {
      case 'bars': drawBars(time); break;
      case 'vu-digital': drawVU(time); break;
      case 'vu-analog': drawAnalogVU(time); break;
      case 'waveform': drawWaveform(time); break;
    }

    ctx.font = '400 11px "Roboto Mono"';
    ctx.fillStyle = 'rgba(158, 140, 145, 0.4)';
    ctx.textAlign = 'left';
    ctx.fillText(`${fps} fps`, 8, 16);

    animId = requestAnimationFrame(animate);
  }

  // Format time helper
  function fmt(sec: number): string {
    if (!sec || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Quality label
  $: qualityLabel = (() => {
    const q = $trackQuality;
    if (!q || (!q.sampleRate && !q.bitDepth)) return '';
    const parts: string[] = [];
    if (q.trackType) parts.push(q.trackType.toUpperCase());
    if (q.sampleRate) parts.push(formatSampleRate(q.sampleRate));
    if (q.bitDepth) parts.push(`${q.bitDepth}bit`);
    return parts.join(' · ');
  })();

  $: progressPct = $duration > 0 ? ($seek / $duration) * 100 : 0;

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d')!;
      startTime = performance.now();
      animId = requestAnimationFrame(animate);
      showModeLabel();
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(animId);
    clearTimeout(modeLabelTimeout);
    unsubSpectrum();
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="fs-player" on:click={dismiss} role="button" tabindex="0">
  <!-- Album Art -->
  <div class="fs-art">
    {#if $currentTrack?.albumart}
      <img src={$currentTrack.albumart} alt="" class="fs-art-img" />
    {/if}
    <div class="fs-art-fallback"></div>
    <div class="fs-art-edge"></div>
  </div>

  <!-- Track Info -->
  <div class="fs-info">
    <div class="fs-title">{$currentTrack?.title || 'No Track'}</div>
    <div class="fs-artist">{$currentTrack?.artist || ''}</div>
    <div class="fs-album">{$currentTrack?.album || ''}</div>
    {#if qualityLabel}
      <div class="fs-quality">{qualityLabel}</div>
    {/if}
    <div class="fs-progress">
      <span class="fs-time">{fmt($seek)}</span>
      <div class="fs-bar">
        <div class="fs-bar-fill" style="width: {progressPct}%"></div>
      </div>
      <span class="fs-time end">{fmt($duration)}</span>
    </div>
  </div>

  <!-- Visualization -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="fs-viz" on:click={cycleMode} role="button" tabindex="0">
    <canvas bind:this={canvas} width="500" height="440"></canvas>
    <div class="fs-mode-label" class:visible={modeLabelVisible}>
      {MODE_LABELS[currentVizMode]}
    </div>
  </div>
</div>

<style>
  .fs-player {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    background: var(--md-background, #1A1114);
    cursor: pointer;
  }

  /* ─── Album Art ─── */
  .fs-art {
    width: 440px;
    height: 440px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .fs-art-img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .fs-art-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #0a0a2e 0%, #1a0533 30%, #2d1b69 50%, #0a0a2e 70%, #000 100%);
  }
  .fs-art-edge {
    position: absolute;
    top: 0; right: 0;
    width: 80px;
    height: 100%;
    background: linear-gradient(to right, transparent, var(--md-background, #1A1114));
    z-index: 2;
  }

  /* ─── Track Info ─── */
  .fs-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 40px 48px;
    min-width: 0;
    z-index: 2;
  }
  .fs-title {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.15;
    margin-bottom: 8px;
  }
  .fs-artist {
    font-size: 28px;
    font-weight: 400;
    color: var(--md-on-surface-variant, #D5BFC4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .fs-album {
    font-size: 20px;
    color: var(--md-outline, #9E8C91);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 24px;
  }
  .fs-quality {
    display: inline-flex;
    align-self: flex-start;
    padding: 6px 16px;
    border-radius: 9999px;
    background: rgba(123, 41, 73, 0.3);
    border: 1px solid rgba(255, 177, 200, 0.2);
    font-family: 'Roboto Mono', monospace;
    font-size: 14px;
    font-weight: 500;
    color: var(--md-primary, #FFB1C8);
    letter-spacing: 0.5px;
    margin-bottom: 28px;
  }

  /* ─── Progress ─── */
  .fs-progress {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .fs-time {
    font-family: 'Roboto Mono', monospace;
    font-size: 16px;
    color: var(--md-outline, #9E8C91);
    min-width: 50px;
  }
  .fs-time.end { text-align: right; }
  .fs-bar {
    flex: 1;
    height: 6px;
    background: var(--md-outline-variant, #514347);
    border-radius: 3px;
    overflow: hidden;
  }
  .fs-bar-fill {
    height: 100%;
    background: var(--md-primary, #FFB1C8);
    border-radius: 3px;
    transition: width 0.3s linear;
  }

  /* ─── Visualization ─── */
  .fs-viz {
    width: 500px;
    height: 440px;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
  }
  .fs-viz canvas {
    width: 500px;
    height: 440px;
  }
  .fs-mode-label {
    position: absolute;
    bottom: 16px;
    right: 20px;
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: var(--md-outline, #9E8C91);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0;
    transition: opacity 0.5s;
  }
  .fs-mode-label.visible { opacity: 1; }
</style>
