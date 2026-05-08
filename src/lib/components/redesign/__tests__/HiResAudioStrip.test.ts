import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import HiResAudioStrip from '../HiResAudioStrip.svelte';

describe('HiResAudioStrip', () => {
  // 1. 24-bit / 96 kHz FLAC → renders Hi-Res Audio cluster + spec text + codec.
  it('renders the Hi-Res Audio cluster for 24-bit / 96 kHz FLAC', () => {
    const { container, getByTestId } = render(HiResAudioStrip, {
      bitDepth: 24,
      sampleRate: 96000,
      codec: 'FLAC',
    });

    // Equalizer-bars glyph is present (gold inline SVG, three vertical bars).
    expect(getByTestId('hi-res-audio-strip')).toBeInTheDocument();
    expect(getByTestId('hi-res-equalizer-glyph')).toBeInTheDocument();

    // The "Hi-Res Audio" text label was deliberately removed to avoid
    // duplicating the HI-RES badge to its right; only the eq glyph signals
    // hi-res visually.
    expect(container.textContent).not.toContain('Hi-Res Audio');

    // Reused HiResBadge with HI-RES label and 96kHz rate.
    expect(getByTestId('hi-res-badge')).toBeInTheDocument();
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');

    // Spec text: bit + rate.
    expect(container.textContent).toContain('24-bit');
    expect(container.textContent).toContain('96 kHz');

    // Codec text.
    expect(container.textContent).toContain('FLAC');
  });

  // 2. 16-bit / 44.1 kHz FLAC (CD quality) → no Hi-Res cluster, just specs + codec.
  it('omits the Hi-Res Audio cluster for CD-quality 16-bit / 44.1 kHz FLAC', () => {
    const { container, queryByTestId } = render(HiResAudioStrip, {
      bitDepth: 16,
      sampleRate: 44100,
      codec: 'FLAC',
    });

    // Strip itself is rendered (we still have specs to show).
    expect(queryByTestId('hi-res-audio-strip')).toBeInTheDocument();

    // No equalizer glyph, no "Hi-Res Audio" label, no badge.
    expect(queryByTestId('hi-res-equalizer-glyph')).toBeNull();
    expect(queryByTestId('hi-res-badge')).toBeNull();
    expect(container.textContent).not.toContain('Hi-Res Audio');
    expect(container.textContent).not.toContain('HI-RES');

    // Specs and codec are present, in muted gray.
    expect(container.textContent).toContain('16-bit');
    expect(container.textContent).toContain('44.1 kHz');
    expect(container.textContent).toContain('FLAC');
  });

  // 3. MP3 (no bitDepth, sampleRate 44100) → no Hi-Res cluster; renders rate + MP3.
  it('renders rate + codec only for MP3 with no bit depth', () => {
    const { container, queryByTestId } = render(HiResAudioStrip, {
      bitDepth: null,
      sampleRate: 44100,
      codec: 'MP3',
    });

    // No Hi-Res cluster.
    expect(queryByTestId('hi-res-equalizer-glyph')).toBeNull();
    expect(queryByTestId('hi-res-badge')).toBeNull();
    expect(container.textContent).not.toContain('Hi-Res Audio');

    // No "-bit" since bitDepth is null.
    expect(container.textContent).not.toContain('-bit');

    // Rate + codec are present.
    expect(container.textContent).toContain('44.1 kHz');
    expect(container.textContent).toContain('MP3');
  });

  // 4. DSD64 → DSD badge variant with the existing helper.
  it('renders the DSD badge variant for codec="DSD"', () => {
    const { container, getByTestId } = render(HiResAudioStrip, {
      bitDepth: 1,
      sampleRate: 2822400, // DSD64 base rate
      codec: 'DSD',
    });

    // Hi-Res Audio cluster (with DSD-flavored badge) is rendered.
    expect(getByTestId('hi-res-audio-strip')).toBeInTheDocument();
    expect(getByTestId('hi-res-equalizer-glyph')).toBeInTheDocument();
    expect(getByTestId('hi-res-badge')).toBeInTheDocument();

    // DSD label on the badge, NOT HI-RES.
    expect(container.textContent).toContain('DSD64');
    // The "Hi-Res Audio" text label was removed across all variants; the
    // eq glyph alone is the verbal-free hi-res indicator.
    expect(container.textContent).not.toContain('Hi-Res Audio');

    // Codec text shown in the spec area.
    expect(container.textContent).toContain('DSD');
  });

  // 5. All-null props → component renders nothing visible (matches FormatStrip
  //    behaviour where the strip element is omitted when no values are present).
  it('renders nothing when bitDepth, sampleRate, and codec are all null', () => {
    const { container, queryByTestId } = render(HiResAudioStrip, {
      bitDepth: null,
      sampleRate: null,
      codec: null,
    });

    expect(queryByTestId('hi-res-audio-strip')).toBeNull();
    expect(queryByTestId('hi-res-equalizer-glyph')).toBeNull();
    expect(queryByTestId('hi-res-badge')).toBeNull();
    // Container contains no visible text content.
    expect(container.textContent?.trim()).toBe('');
  });
});
