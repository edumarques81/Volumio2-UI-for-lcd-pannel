[![Build Status](https://app.travis-ci.com/volumio/Volumio2-UI.svg?branch=master)](https://travis-ci.org/volumio/Volumio2-UI)
[![Open Source Love](https://badges.frapsoft.com/os/v2/open-source.png?v=103)](https://github.com/ellerbrock/open-source-badges/)
[![Awesome](https://awesome.re/badge.svg)](https://github.com/thibmaek/awesome-raspberry-pi)

[![Volumio](https://volumio.org/wp-content/uploads/2016/02/Volumio_logo_HD2000.jpg)](https://volumio.org)


## Volumio Web Interface

This UI is meant to be used as a standalone Web User Interface communicating via Volumio2 Backend via Socket.io API, see [Volumio2 WebSocket API reference](https://github.com/volumio/Volumio2/wiki/WebSockets-API-Reference)

Currently the UI is served via Express Static Server, and resides at `/volumio/http/www` (Classic UI) and `/volumio/http/www3` (Contemporary UI)

## Projects in This Repository

This repository contains two projects:

| Project | Location | Tech Stack | Description |
|---------|----------|------------|-------------|
| **Legacy UI** | Root (`/`) | AngularJS 1.5, Gulp, SCSS | Original Volumio UI (Classic & Contemporary themes) |
| **POC** | `volumio-poc/` | Svelte 5, TypeScript, Vite | CarPlay-style LCD interface (1920x440) |

For detailed development instructions, architecture documentation, and Raspberry Pi deployment guides, see [CLAUDE.md](CLAUDE.md).

## Repo Information

This repo holds the source code of Volumio UI [Volumio2](https://github.com/volumio/Volumio2), which is compiled and hosted in Volumio system images.
Only the `dist/` and `dist3/` branches are needed by Volumio2, so there is a [dist branch](https://github.com/volumio/Volumio2-UI/tree/dist) which contains just that.


## Legacy UI (AngularJS)

### Set Up Development Environment

You must have Node.js, Npm and Bower installed. Node.js suggested version is 10.22.1 (lower versions and higher versions might fail). It's strongly suggested to use [NVM](https://github.com/nvm-sh/nvm) to set up the proper Node.js Environment.

Clone the Repo:

```shell
git clone https://github.com/volumio/Volumio2-UI.git
```

Then, install its dependencies:

```shell
cd Volumio2-UI
npm install bower -g
npm install
bower install
```

Now, you can develop on it, while retrieving data from Volumio2 backend (you must have a Volumio2 device on your network and know its IP address).
To tell the UI where to find Volumio 2 backend, create a file with the IP of Volumio2 in

```shell
/src/app/local-config.json
```

The file will look like

```json
{
  "localhost": "http://192.168.31.234"
}
```

Now, feel free to edit and see live changes on a local browser with dynamically generated UI. To do so:

```shell
gulp serve --theme="volumio"
```

Additional parameters can be env, for selecting the environment which can be production or development

```shell
gulp serve --theme="volumio" --env="production"
```

And debug, to show debug console logs on the browser

```shell
gulp serve --theme="volumio" --env="production" --debug
```

Once finished, to deploy on Volumio 2, first build it. If you want production optimization use --env="production"

```shell
npm run build:volumio      # Classic UI
npm run build:volumio3     # Contemporary UI
```

And deploy by copying the content of dist directory on Volumio2 device to:

```shell
/volumio/http/www
```


## POC (Svelte 5)

The POC is a modern Svelte 5 application designed for a CarPlay-style LCD interface (1920x440).

### Quick Start

```shell
cd volumio-poc
npm install
npm run dev                 # Dev server at localhost:5173
```

Configure the backend IP in `src/lib/config.ts` (`DEV_VOLUMIO_IP`).

### Commands

```shell
npm run dev                 # Development server
npm run build               # Production build
npm test                    # Unit tests (watch mode)
npm run test:run            # Unit tests (single run)
npm run test:e2e            # E2E tests (Playwright)
npx tsc --noEmit            # Type check
```

### Backend

The POC connects to the [Stellar backend](https://github.com/edumarques81/stellar-volumio-audioplayer-backend), a Go-based audio player backend with Socket.IO API and MPD integration. See [CLAUDE.md](CLAUDE.md) for deployment instructions.
