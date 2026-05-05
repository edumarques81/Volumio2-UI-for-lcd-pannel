import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MetadataBlock from '../MetadataBlock.svelte';

describe('MetadataBlock', () => {
  it('shows title, artist, album when all three present', () => {
    const { getByText } = render(MetadataBlock, {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
    });
    expect(getByText('Blue in Green')).toBeTruthy();
    expect(getByText('Miles Davis')).toBeTruthy();
    expect(getByText('Kind of Blue')).toBeTruthy();
  });

  it('hides artist row entirely when artist is empty', () => {
    const { container, queryByText } = render(MetadataBlock, {
      title: 'Untitled', artist: '', album: 'Demo',
    });
    expect(queryByText('Untitled')).toBeTruthy();
    expect(container.querySelector('.artist-row')).toBeNull();
  });

  it('hides album row entirely when album is empty', () => {
    const { container } = render(MetadataBlock, {
      title: 'X', artist: 'Y', album: '',
    });
    expect(container.querySelector('.album-row')).toBeNull();
  });

  it('renders user icon for artist row', () => {
    const { container } = render(MetadataBlock, {
      title: 't', artist: 'a', album: 'b',
    });
    const artistRow = container.querySelector('.artist-row');
    expect(artistRow?.querySelector('svg')).toBeTruthy();
  });
});
