# Spectrum Capture Module for Stellar Backend

Self-contained Go package that captures audio from MPD's FIFO output, runs FFT,
and streams frequency bin data to the frontend via the existing Socket.IO connection.

## Prerequisites

### MPD FIFO Output

Add this to `/etc/mpd.conf` on the Pi (if not already present):

```
audio_output {
    type    "fifo"
    name    "Spectrum FIFO"
    path    "/tmp/mpd_spectrum.fifo"
    format  "44100:16:2"
    enabled "yes"
}
```

Then restart MPD: `sudo systemctl restart mpd`

The FIFO format is **44100 Hz, 16-bit signed little-endian, 2 channels (stereo)**.

## Integration

### 1. Copy the package

Copy `spectrum.go` into your backend source tree:

```
internal/infra/spectrum/spectrum.go
```

### 2. Wire into your Socket.IO server

In your main server setup (e.g., `cmd/stellar/main.go` or wherever you initialize Socket.IO):

```go
import "your-module/internal/infra/spectrum"

// After creating the Socket.IO server:
spectrumStreamer := spectrum.New(spectrum.Config{
    FIFOPath:   "/tmp/mpd_spectrum.fifo",
    SampleRate: 44100,
    FFTSize:    2048,
    NumBins:    64,
    FPS:        30,
})

// Start streaming — emits "pushSpectrum" to all connected clients
spectrumStreamer.Start(ctx, socketServer)

// Stop on shutdown:
defer spectrumStreamer.Stop()
```

### 3. Socket.IO Event

The module emits a `pushSpectrum` event at ~30fps with this payload:

```json
{
  "bins": [0.12, 0.45, 0.78, ...],  // Float64 array, 64 values, normalized 0.0-1.0
  "peak": 0.82,                       // Overall peak level
  "rms":  0.35                         // Overall RMS level
}
```

## How It Works

1. Opens the MPD FIFO (named pipe) for reading
2. Reads PCM frames (44100 Hz, 16-bit stereo)
3. Mixes stereo to mono
4. Applies a Hann window function
5. Runs real FFT (using `mjibson/go-dsp/fft`)
6. Bins the FFT magnitudes into 64 frequency bands (logarithmic scale)
7. Normalizes bins to 0.0-1.0 range
8. Emits the result via Socket.IO at ~30fps

## Dependencies

Add to your `go.mod`:

```
go get github.com/mjibson/go-dsp
```
