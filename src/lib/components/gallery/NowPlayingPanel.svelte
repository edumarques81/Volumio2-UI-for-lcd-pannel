<script lang="ts">
	/**
	 * NowPlayingPanel — Center zone with track info + controls.
	 *
	 * Matches Study 2 mockup exactly:
	 * - Track title: 32px, weight 800, letter-spacing -0.5px (22px in viz mode)
	 * - Artist: 16px, on-surface-variant (13px viz)
	 * - Album: 13px, outline colour (11px viz)
	 * - Format badges: Roboto Mono 10px, pill shape
	 * - Transport: prev/play/next + shuffle/repeat/volume
	 * - Seek bar within panel (not the global one)
	 *
	 * All values from mockup CSS.  SVG placeholders for icons (no emoji).
	 */
	import {
		currentTrack, isPlaying, shuffle, repeat, volume, mute,
		seek, duration, progress, formatTime, formatSampleRate,
		playerActions, playerState
	} from '$lib/stores/player';
	import { vizMode } from '$lib/stores/viz';
	import { classifySource } from '$lib/utils/sourceClassifier';
	import {
		IconPlay, IconPause, IconNext, IconPrevious,
		IconShuffle, IconRepeat, IconRepeatOne,
		IconVolumeHigh, IconVolumeMute, IconAudirvana,
		IconAddToQueue, IconFavorite, IconFavoriteFilled,
		IconSpectrum
	} from '$lib/components/icons';
	import { activeEngine } from '$lib/stores/audioEngine';
	import { toggleVizMode } from '$lib/stores/viz';
	import { favoritesActions } from '$lib/stores/favorites';
	import { socketService } from '$lib/services/socket';

	let isFavorited = false;

	function toggleFavorite() {
		const track = $currentTrack;
		if (!track?.uri) return;
		favoritesActions.addToFavorites(track.service || 'mpd', track.uri, track.title);
		isFavorited = !isFavorited;
	}

	function addCurrentToQueue() {
		const track = $currentTrack;
		if (!track?.uri) return;
		socketService.emit('addToQueue', {
			service: track.service || 'mpd',
			uri: track.uri,
			title: track.title,
			artist: track.artist,
			album: track.album
		});
	}

	$: isViz = $vizMode;
	$: isAudirvana = $activeEngine === 'audirvana';
	$: playing = $isPlaying;
	$: trackType = $playerState?.trackType?.toUpperCase() || '';
	$: sampleRate = formatSampleRate($playerState?.samplerate || '');
	$: bitDepth = $playerState?.bitdepth ? `${$playerState.bitdepth}` : '';
	$: sourceLabel = classifySource($playerState?.uri || '');

	// Repeat cycle: off → all → one → off
	function cycleRepeat() {
		const current = $repeat;
		if (current === 'off') playerActions.setRepeat('all');
		else if (current === 'all') playerActions.setRepeat('one');
		else playerActions.setRepeat('off');
	}

	// Seek bar interaction
	let seekTrackEl: HTMLDivElement;
	let seekDragging = false;

	function handleSeekDown(e: MouseEvent | TouchEvent) {
		seekDragging = true;
		seekTo(e);
	}

	function handleSeekMove(e: MouseEvent | TouchEvent) {
		if (seekDragging) seekTo(e);
	}

	function handleSeekUp() {
		seekDragging = false;
	}

	function seekTo(e: MouseEvent | TouchEvent) {
		if (!seekTrackEl) return;
		const rect = seekTrackEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		playerActions.seekTo(Math.round(pct * $duration));
	}

	// Volume interaction
	let volTrackEl: HTMLDivElement;
	let volDragging = false;

	function handleVolDown(e: MouseEvent | TouchEvent) {
		volDragging = true;
		setVol(e);
	}

	function handleVolMove(e: MouseEvent | TouchEvent) {
		if (volDragging) setVol(e);
	}

	function handleVolUp() {
		volDragging = false;
	}

	function setVol(e: MouseEvent | TouchEvent) {
		if (!volTrackEl) return;
		const rect = volTrackEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		playerActions.setVolume(Math.round(pct * 100));
	}
</script>

<svelte:window
	on:mousemove={(e) => { handleSeekMove(e); handleVolMove(e); }}
	on:mouseup={() => { handleSeekUp(); handleVolUp(); }}
	on:touchmove={(e) => { handleSeekMove(e); handleVolMove(e); }}
	on:touchend={() => { handleSeekUp(); handleVolUp(); }}
/>

<div class="center-panel" class:viz={isViz}>
	<!-- Track info -->
	<div class="track-title">{$currentTrack.title}</div>
	<div class="track-artist">{$currentTrack.artist}</div>
	{#if $currentTrack.album}
		<div class="track-album">{$currentTrack.album}</div>
	{/if}

	<!-- Format badges -->
	{#if trackType || sampleRate || bitDepth || sourceLabel || isAudirvana}
		<div class="format-badges">
			{#if isAudirvana}<span class="badge audirvana"><IconAudirvana size={10} /> Audirvana</span>{/if}
			{#if trackType}<span class="badge">{trackType}</span>{/if}
			{#if sampleRate}<span class="badge">{sampleRate}</span>{/if}
			{#if bitDepth}<span class="badge">{bitDepth}</span>{/if}
			{#if sourceLabel}<span class="badge src">{sourceLabel}</span>{/if}
		</div>
	{/if}

	<!-- Transport controls -->
	{#if isAudirvana}
		<div class="audirvana-control-hint">Control via Audirvana app</div>
	{/if}
	<div class="transport" class:disabled={isAudirvana}>
		<button class="t-btn sm" on:click={playerActions.prev} title="Previous" aria-label="Previous track" type="button" disabled={isAudirvana}>
			<IconPrevious size={28} />
		</button>
		<button
			class="t-btn play"
			on:click={() => playing ? playerActions.pause() : playerActions.play()}
			title={playing ? 'Pause' : 'Play'}
			aria-label={playing ? 'Pause' : 'Play'}
			type="button"
			disabled={isAudirvana}
		>
			{#if playing}
				<IconPause size={28} />
			{:else}
				<IconPlay size={28} />
			{/if}
		</button>
		<button class="t-btn sm" on:click={playerActions.next} title="Next" aria-label="Next track" type="button" disabled={isAudirvana}>
			<IconNext size={28} />
		</button>
	</div>

	<!-- Shuffle / Repeat / Volume row -->
	<div class="controls-row">
		<button
			class="t-btn sm"
			class:active={$shuffle}
			on:click={playerActions.toggleShuffle}
			title="Shuffle"
			aria-label={$shuffle ? 'Shuffle on' : 'Shuffle off'}
			type="button"
		>
			<IconShuffle size={24} />
		</button>
		<button
			class="t-btn sm"
			class:active={$repeat !== 'off'}
			on:click={cycleRepeat}
			title="Repeat {$repeat}"
			aria-label={$repeat === 'off' ? 'Repeat off' : $repeat === 'all' ? 'Repeat all' : 'Repeat one'}
			type="button"
		>
			{#if $repeat === 'one'}
				<IconRepeatOne size={24} />
			{:else}
				<IconRepeat size={24} />
			{/if}
		</button>

		<button
			class="t-btn sm"
			class:active={isFavorited}
			on:click={toggleFavorite}
			title="Add to favorites"
			aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
			type="button"
		>
			{#if isFavorited}
				<IconFavoriteFilled size={24} />
			{:else}
				<IconFavorite size={24} />
			{/if}
		</button>
		<button
			class="t-btn sm"
			on:click={addCurrentToQueue}
			title="Add to queue"
			aria-label="Add to queue"
			type="button"
		>
			<IconAddToQueue size={24} />
		</button>
		<button
			class="t-btn sm"
			class:active={isViz}
			on:click={toggleVizMode}
			title={isViz ? 'Exit spectrum' : 'Spectrum view'}
			aria-label={isViz ? 'Exit spectrum view' : 'Show spectrum view'}
			type="button"
		>
			<IconSpectrum size={24} />
		</button>

		<div class="vol-wrap">
			<button
				class="vol-icon"
				on:click={playerActions.toggleMute}
				title={$mute ? 'Unmute' : 'Mute'}
				aria-label={$mute ? 'Unmute' : 'Mute'}
				type="button"
			>
				{#if $mute || $volume === 0}
					<IconVolumeMute size={16} />
				{:else}
					<IconVolumeHigh size={16} />
				{/if}
			</button>
			<div
				class="vol-track"
				bind:this={volTrackEl}
				on:mousedown={handleVolDown}
				on:touchstart|preventDefault={handleVolDown}
				role="slider"
				aria-label="Volume"
				aria-valuenow={$volume}
				aria-valuemin={0}
				aria-valuemax={100}
				tabindex="0"
				id="gallery-volume-slider"
			>
				<div class="vol-fill" style="width: {$volume}%">
					<span class="vol-dot"></span>
				</div>
			</div>
		</div>
	</div>

	<!-- Seek bar (within center panel) -->
	<div class="center-seek">
		<span class="seek-time">{formatTime($seek)}</span>
		<div
			class="seek-track"
			bind:this={seekTrackEl}
			on:mousedown={handleSeekDown}
			on:touchstart|preventDefault={handleSeekDown}
			role="slider"
			aria-label="Seek position"
			aria-valuenow={$seek}
			aria-valuemin={0}
			aria-valuemax={$duration}
			tabindex="0"
			id="gallery-seek-slider"
		>
			<div class="seek-fill" style="width: {$progress}%">
				<span class="seek-dot"></span>
			</div>
		</div>
		<span class="seek-time">{formatTime($duration)}</span>
	</div>
</div>

<style>
	/* ── Center Panel ── */
	.center-panel {
		flex: 0 0 35%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0 8px;
		min-width: 0;
		transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.center-panel.viz {
		background: rgba(16, 10, 14, 0.75);
		backdrop-filter: blur(24px) saturate(1.3);
		-webkit-backdrop-filter: blur(24px) saturate(1.3);
		border: 1px solid rgba(81, 67, 71, 0.7);
		border-radius: 16px;
		padding: 14px 20px;
	}

	/* ── Track info ── */
	.track-title {
		font-size: 32px;
		font-weight: 800;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.5px;
		color: var(--md-on-surface, #F0DEE2);
		transition: font-size 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.viz .track-title {
		font-size: 22px;
	}

	.track-artist {
		font-size: 16px;
		color: var(--md-on-surface-variant, #D5BFC4);
		margin-top: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.viz .track-artist {
		font-size: 13px;
	}

	.track-album {
		font-size: 13px;
		color: var(--md-outline, #9E8C91);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.viz .track-album {
		font-size: 11px;
	}

	/* ── Format badges ── */
	.format-badges {
		display: flex;
		gap: 5px;
		margin-top: 12px;
		flex-wrap: wrap;
	}

	.badge {
		padding: 3px 10px;
		border-radius: 9999px;
		font-family: 'Roboto Mono', monospace;
		font-size: 10px;
		font-weight: 500;
		background: var(--md-primary-container, #7B2949);
		color: var(--md-on-primary-container, #FFD9E3);
		white-space: nowrap;
	}

	.badge.src {
		background: var(--md-surface-container-high, #312228);
		color: var(--md-on-surface-variant, #D5BFC4);
	}

	.badge.audirvana {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: rgba(107, 78, 160, 0.35);
		color: var(--md-tertiary, #C9B3E8);
	}

	/* ── Audirvana control hint ── */
	.audirvana-control-hint {
		font-size: 11px;
		color: var(--md-outline, #9E8C91);
		font-style: italic;
		margin-top: 12px;
		margin-bottom: -4px;
	}

	/* ── Transport ── */
	.transport {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 16px;
	}

	.viz .transport {
		margin-top: 10px;
	}

	.transport.disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.t-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--md-on-surface, #F0DEE2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 200ms ease-out;
		padding: 0;
	}

	.t-btn:hover {
		background: var(--md-surface-container-high, #312228);
	}

	.t-btn:active {
		transform: scale(0.92);
	}

	.t-btn.play {
		width: 72px;
		height: 72px;
		background: var(--md-primary, #FFB1C8);
		color: var(--md-on-primary, #5D1133);
		box-shadow: 0 4px 20px rgba(255, 177, 200, 0.2);
	}

	.t-btn.play:hover {
		background: var(--md-on-primary-container, #FFD9E3);
		color: var(--md-primary, #FFB1C8);
	}

	.viz .t-btn {
		width: 44px;
		height: 44px;
	}

	.viz .t-btn.play {
		width: 52px;
		height: 52px;
	}

	.t-btn.sm {
		width: 56px;
		height: 56px;
		color: var(--md-outline, #9E8C91);
	}

	.t-btn.sm:hover {
		color: var(--md-on-surface, #F0DEE2);
	}

	.viz .t-btn.sm {
		width: 44px;
		height: 44px;
	}

	.t-btn.active {
		color: var(--md-primary, #FFB1C8);
		filter: drop-shadow(0 0 6px rgba(255, 177, 200, 0.4));
		background: rgba(123, 41, 73, 0.25);
	}

	/* ── Shuffle / Repeat / Volume row ── */
	.controls-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.viz .controls-row {
		margin-top: 6px;
	}

	.vol-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}

	.vol-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		background: none;
		color: var(--md-outline, #9E8C91);
		cursor: pointer;
		padding: 0;
		transition: color 200ms ease-out;
	}

	.vol-icon:hover {
		color: var(--md-on-surface, #F0DEE2);
	}

	.vol-track {
		width: 100px;
		height: 4px;
		background: var(--md-outline-variant, #514347);
		border-radius: 2px;
		cursor: pointer;
		position: relative;
	}

	.vol-fill {
		height: 100%;
		background: var(--md-secondary, #E3BDC6);
		border-radius: 2px;
		transition: width 0.1s;
		position: relative;
	}

	.vol-dot {
		position: absolute;
		right: -5px;
		top: 50%;
		transform: translateY(-50%);
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--md-secondary, #E3BDC6);
		opacity: 0;
		transition: opacity 0.15s;
		pointer-events: none;
	}

	.vol-track:hover .vol-dot {
		opacity: 1;
	}

	/* ── Seek bar (within center panel) ── */
	.center-seek {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.viz .center-seek {
		margin-top: 8px;
	}

	.seek-time {
		font-family: 'Roboto Mono', monospace;
		font-size: 11px;
		color: var(--md-outline, #9E8C91);
		min-width: 32px;
	}

	.seek-track {
		flex: 1;
		height: 12px;
		background: var(--md-outline-variant, #514347);
		border-radius: 6px;
		cursor: pointer;
		position: relative;
		transition: height 0.15s;
	}

	.seek-track:hover {
		height: 14px;
	}

	.seek-fill {
		height: 100%;
		background: var(--md-primary, #FFB1C8);
		border-radius: 6px;
		transition: width 0.1s;
		position: relative;
	}

	.seek-dot {
		position: absolute;
		right: -10px;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--md-primary, #FFB1C8);
		box-shadow: 0 0 8px rgba(255, 177, 200, 0.5);
		opacity: 1;
		transition: transform 0.15s;
		pointer-events: none;
	}

	.seek-track:hover .seek-dot {
		transform: translateY(-50%) scale(1.2);
	}
</style>
