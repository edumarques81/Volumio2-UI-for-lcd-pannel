/**
 * Playlist item - a track within a playlist
 */
export interface PlaylistItem {
  service: string;
  type: string;
  title: string;
  artist?: string;
  album?: string;
  uri: string;
  albumart?: string;
  icon?: string;
  duration?: number;
  tracknumber?: number;
}

/**
 * Playlist metadata
 */
export interface Playlist {
  name: string;
}

/**
 * Response from listPlaylist - array of playlist names
 */
export type PlaylistListResponse = string[];

/**
 * Request to add item to playlist
 */
export interface AddToPlaylistRequest {
  name: string;
  service: string;
  uri: string;
  title?: string;
}

/**
 * Request to remove item from playlist
 */
export interface RemoveFromPlaylistRequest {
  name: string;
  uri?: string;
  service?: string;
}

/**
 * Request to create a playlist
 */
export interface CreatePlaylistRequest {
  name: string;
}

/**
 * Request to delete a playlist
 */
export interface DeletePlaylistRequest {
  name: string;
}

/**
 * Request to play a playlist
 */
export interface PlayPlaylistRequest {
  name: string;
}
