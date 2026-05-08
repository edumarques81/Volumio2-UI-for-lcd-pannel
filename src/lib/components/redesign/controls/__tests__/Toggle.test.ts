import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Toggle from '../Toggle.svelte';

describe('Toggle', () => {
  // 1. Renders role=switch with aria-checked matching pressed prop
  it('renders role=switch with aria-checked=false when pressed=false', () => {
    render(Toggle, {
      props: { pressed: false, onchange: vi.fn(), ariaLabel: 'Enable mixer' },
    });
    const btn = screen.getByRole('switch');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('renders role=switch with aria-checked=true when pressed=true', () => {
    render(Toggle, {
      props: { pressed: true, onchange: vi.fn(), ariaLabel: 'Enable mixer' },
    });
    const btn = screen.getByRole('switch');
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  // 2. Renders supplied label text when present
  it('renders the label text when label prop is supplied', () => {
    render(Toggle, {
      props: { pressed: false, onchange: vi.fn(), ariaLabel: 'Enable mixer', label: 'Mixer enable' },
    });
    expect(screen.getByText('Mixer enable')).toBeTruthy();
  });

  // 3. Click toggles → fires onchange(!pressed) exactly once
  it('fires onchange(!pressed) exactly once on click when off', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer' } });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it('fires onchange(!pressed) exactly once on click when on', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: true, onchange, ariaLabel: 'Enable mixer' } });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith(false);
  });

  // 4. Space key on focused button fires onchange(!pressed)
  it('fires onchange(!pressed) on Space keypress', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer' } });
    const btn = screen.getByRole('switch');
    await fireEvent.keyDown(btn, { key: ' ' });
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith(true);
  });

  // 5. Enter key on focused button fires onchange(!pressed)
  it('fires onchange(!pressed) on Enter keypress', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer' } });
    const btn = screen.getByRole('switch');
    await fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith(true);
  });

  // 6. disabled=true blocks click and keypress (no onchange calls)
  it('does not call onchange on click when disabled', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer', disabled: true } });
    const btn = screen.getByRole('switch');
    await fireEvent.click(btn);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('does not call onchange on Space when disabled', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer', disabled: true } });
    const btn = screen.getByRole('switch');
    await fireEvent.keyDown(btn, { key: ' ' });
    expect(onchange).not.toHaveBeenCalled();
  });

  it('does not call onchange on Enter when disabled', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer', disabled: true } });
    const btn = screen.getByRole('switch');
    await fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onchange).not.toHaveBeenCalled();
  });

  // 7. loading=true blocks click and renders spinner glyph (.spinning class)
  it('does not call onchange on click when loading', async () => {
    const onchange = vi.fn();
    render(Toggle, { props: { pressed: false, onchange, ariaLabel: 'Enable mixer', loading: true } });
    const btn = screen.getByRole('switch');
    await fireEvent.click(btn);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('renders .spinning element when loading=true', () => {
    render(Toggle, {
      props: { pressed: false, onchange: vi.fn(), ariaLabel: 'Enable mixer', loading: true },
    });
    const btn = screen.getByRole('switch');
    const spinner = btn.querySelector('.spinning');
    expect(spinner).toBeTruthy();
  });

  // 8. aria-pressed and aria-checked both reflect pressed
  it('sets both aria-pressed and aria-checked to match pressed=false', () => {
    render(Toggle, { props: { pressed: false, onchange: vi.fn(), ariaLabel: 'Enable mixer' } });
    const btn = screen.getByRole('switch');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('sets both aria-pressed and aria-checked to match pressed=true', () => {
    render(Toggle, { props: { pressed: true, onchange: vi.fn(), ariaLabel: 'Enable mixer' } });
    const btn = screen.getByRole('switch');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  // 9. Supplied id is on the button element
  it('places the supplied id on the button element', () => {
    render(Toggle, {
      props: { pressed: false, onchange: vi.fn(), ariaLabel: 'Enable mixer', id: 'mixer-toggle' },
    });
    const btn = screen.getByRole('switch');
    expect(btn.id).toBe('mixer-toggle');
  });
});
