/**
 * galleryNav — Maps navigation.currentView → UtilityPanel tab/overlay states.
 *
 * In the Living Gallery layout, most views collapse into UtilityPanel tabs:
 *   - 'home', 'browse', 'allAlbums', 'nasAlbums', 'artists', 'radio',
 *     'playlists', 'favorites', 'localMusic' → Library tab
 *   - 'queue' → Queue tab
 *   - 'settings' → Settings tab
 *   - 'player' → no tab change (gallery IS the player)
 *   - 'albumDetail' → Library tab with album overlay
 *   - 'artistAlbums' → Library tab with artist overlay
 *   - 'audirvana' → Library tab (handled by source filter)
 */
import type { ViewType } from '$lib/stores/navigation';

export type GalleryTab = 'library' | 'queue' | 'settings';

export interface GalleryNavState {
	tab: GalleryTab;
	/** If non-null, the view implies an overlay is active */
	overlay: 'album' | 'artist' | null;
}

const VIEW_TO_TAB: Record<ViewType, GalleryNavState> = {
	home:         { tab: 'library',  overlay: null },
	player:       { tab: 'library',  overlay: null },  // gallery IS the player; keep current tab
	browse:       { tab: 'library',  overlay: null },
	queue:        { tab: 'queue',    overlay: null },
	settings:     { tab: 'settings', overlay: null },
	localMusic:   { tab: 'library',  overlay: null },
	audirvana:    { tab: 'library',  overlay: null },
	allAlbums:    { tab: 'library',  overlay: null },
	nasAlbums:    { tab: 'library',  overlay: null },
	artists:      { tab: 'library',  overlay: null },
	artistAlbums: { tab: 'library',  overlay: 'artist' },
	albumDetail:  { tab: 'library',  overlay: 'album' },
	radio:        { tab: 'library',  overlay: null },
	playlists:    { tab: 'library',  overlay: null },
	favorites:    { tab: 'library',  overlay: null },
};

/**
 * Translate a navigation ViewType into the gallery panel state.
 * Returns which UtilityPanel tab should be active and whether an overlay is expected.
 */
export function viewToGalleryState(view: ViewType): GalleryNavState {
	return VIEW_TO_TAB[view] ?? { tab: 'library', overlay: null };
}
