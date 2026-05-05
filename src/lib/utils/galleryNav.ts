/**
 * galleryNav — Maps navigation.currentView → UtilityPanel tab/overlay states.
 *
 * In the Living Gallery layout (Plan 2+), views collapse into UtilityPanel tabs:
 *   - 'player'  → no tab change (gallery IS the player)
 *   - 'library' → Library tab
 *   - 'queue'   → Queue tab
 */
import type { ViewType } from '$lib/stores/navigation';

export type GalleryTab = 'library' | 'queue' | 'settings';

export interface GalleryNavState {
	tab: GalleryTab;
	/** If non-null, the view implies an overlay is active */
	overlay: 'album' | 'artist' | null;
}

const VIEW_TO_TAB: Record<ViewType, GalleryNavState> = {
	player:  { tab: 'library',  overlay: null },  // gallery IS the player; keep current tab
	library: { tab: 'library',  overlay: null },
	queue:   { tab: 'queue',    overlay: null },
};

/**
 * Translate a navigation ViewType into the gallery panel state.
 * Returns which UtilityPanel tab should be active and whether an overlay is expected.
 */
export function viewToGalleryState(view: ViewType): GalleryNavState {
	return VIEW_TO_TAB[view] ?? { tab: 'library', overlay: null };
}
