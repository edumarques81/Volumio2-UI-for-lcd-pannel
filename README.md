# Stellar Volumio

A modern Svelte 5 web application for controlling Volumio-compatible audio players. Features a CarPlay-style interface optimized for LCD displays (1920x440).

## Features

- Touch-optimized interface for LCD panels
- Music library browsing with album artwork
- Queue management with drag-and-drop reordering
- Playlist management
- Multiple source support (NAS, USB, Local, Streaming)
- WebSocket-based real-time updates

## Tech Stack

- **Frontend**: Svelte 5, TypeScript, Vite 7
- **Testing**: Vitest, Playwright
- **Communication**: Socket.IO 4.x
- **Backend**: [Stellar Backend](https://github.com/edumarques81/stellar-volumio-audioplayer-backend) (Go, Socket.IO, MPD)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (localhost:5173)
npm run dev
```

Configure the backend IP in `src/lib/config.ts` (`DEV_VOLUMIO_IP`).

## Commands

```bash
npm run dev                 # Development server
npm run build               # Production build
npm test                    # Unit tests (watch mode)
npm run test:run            # Unit tests (single run)
npm run test:e2e            # E2E tests (Playwright)
npx tsc --noEmit            # Type check
npm run deploy              # Deploy to Pi
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Comprehensive development guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Detailed development setup
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Backend architecture

## Backend

Stellar Volumio connects to the [Stellar backend](https://github.com/edumarques81/stellar-volumio-audioplayer-backend), a Go-based audio player backend with Socket.IO API and MPD integration. See [CLAUDE.md](CLAUDE.md) for deployment instructions.

## License

ISC
