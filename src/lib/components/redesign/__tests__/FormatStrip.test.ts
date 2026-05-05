import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FormatStrip from '../FormatStrip.svelte';

describe('FormatStrip', () => {
  it('shows HI-RES badge for 24-bit / 96 kHz', () => {
    const { container } = render(FormatStrip, { bitDepth: 24, sampleRate: 96000, codec: 'FLAC' });
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');
    expect(container.textContent).toContain('24-bit');
    expect(container.textContent).toContain('FLAC');
  });

  it('shows DSD badge when codec is DSD', () => {
    const { container } = render(FormatStrip, { bitDepth: 1, sampleRate: 2822400, codec: 'DSD' });
    expect(container.textContent).toContain('DSD');
    expect(container.textContent).not.toContain('HI-RES');
  });

  it('shows MQA badge when codec is MQA', () => {
    const { container } = render(FormatStrip, { bitDepth: 24, sampleRate: 96000, codec: 'MQA' });
    expect(container.textContent).toContain('MQA');
  });

  it('hides badge for 16/44.1 (lossless but not hi-res)', () => {
    const { container } = render(FormatStrip, { bitDepth: 16, sampleRate: 44100, codec: 'FLAC' });
    expect(container.textContent).not.toContain('HI-RES');
    expect(container.textContent).toContain('16-bit');
    expect(container.textContent).toContain('44.1kHz');
  });

  it('hides strip entirely when all three values null', () => {
    const { container } = render(FormatStrip, { bitDepth: null, sampleRate: null, codec: null });
    const strip = container.querySelector('.format-strip');
    expect(strip).toBeNull();
  });

  it('shows what is known when partial info present', () => {
    const { container } = render(FormatStrip, { bitDepth: null, sampleRate: 48000, codec: 'AAC' });
    expect(container.textContent).not.toContain('-bit');
    expect(container.textContent).toContain('48kHz');
    expect(container.textContent).toContain('AAC');
  });
});
