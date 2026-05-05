import { writable } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export interface BioState {
  summary: string;
  sourceUrl: string;
  kind: string;
}

export const currentAlbumBio = writable<BioState>({ summary: '', sourceUrl: '', kind: '' });
export const bioLoading = writable<boolean>(false);

let pendingArtist = '';
let pendingAlbum = '';
let unsubPush: (() => void) | null = null;

export const bioActions = {
  requestBio(artist: string, album: string) {
    if (!artist || !album) return;
    pendingArtist = artist;
    pendingAlbum = album;
    bioLoading.set(true);
    socketService.emit('library:bio:get', { artist, album });
  },
  refreshBio(artist: string, album: string) {
    if (!artist || !album) return;
    pendingArtist = artist;
    pendingAlbum = album;
    bioLoading.set(true);
    socketService.emit('library:bio:rebuild', { artist, album });
  },
};

export function initBiosStore(): void {
  // Always (re)register: if a previous handler exists, drop it first so
  // tests and HMR can rewire cleanly.
  if (unsubPush) {
    unsubPush();
    unsubPush = null;
  }
  unsubPush = socketService.on('pushLibraryBio', (payload: any) => {
    if (!payload) return;
    if (payload.artist !== pendingArtist || payload.album !== pendingAlbum) return;
    currentAlbumBio.set({
      summary: payload.summary || '',
      sourceUrl: payload.source_url || '',
      kind: payload.kind || '',
    });
    bioLoading.set(false);
  });
}

export function cleanupBiosStore(): void {
  if (unsubPush) {
    unsubPush();
    unsubPush = null;
  }
}
