export interface PlayerState {
  status: 'play' | 'pause' | 'stop';
  position: number;
  title: string;
  artist: string;
  album: string;
  albumart: string;
  uri: string;
  trackType: string;
  seek: number;
  duration: number;
  samplerate?: string;
  bitdepth?: string;
  bitrate?: string;
  random: boolean;
  repeat: boolean;
  repeatSingle: boolean;
  volume: number;
  mute: boolean;
  stream?: string;
  updatedb?: boolean;
  volatile?: boolean;
}

export interface QueueItem {
  uri: string;
  service: string;
  name: string;
  artist: string;
  album: string;
  type: string;
  duration: number;
  albumart: string;
  samplerate?: string;
  bitdepth?: string;
  bitrate?: string;
  trackType?: string;
}

export interface BrowseItem {
  service: string;
  type: 'folder' | 'song' | 'playlist' | 'webradio';
  title: string;
  artist?: string;
  album?: string;
  albumart?: string;
  uri: string;
  icon?: string;
}

// Re-export playlist types
export * from './playlist';
