# Sphera Player

An XR 360/VR video player built on [three.js](https://threejs.org) — one
embeddable player for the formats real 360 cameras and platforms produce:
360 mono, 360 stereo (top-bottom / side-by-side), and VR180, on desktop,
mobile, and in a WebXR headset.

## Features

- **Format coverage** — equirectangular 360 mono, 360 stereo TB and SBS,
  and VR180, switchable at runtime behind one API. Stereo in WebXR uses the
  per-eye layer convention (left eye layer 1, right eye layer 2); the flat
  preview automatically shows the left eye.
- **Adaptive streaming** — HLS via hls.js with a quality menu and automatic
  level switching; native HLS on Safari.
- **Look controls** — pointer drag with inertia, wheel/pinch FOV zoom, and
  device-orientation (gyro) look with the iOS permission flow handled.
- **Two UIs, one behavior contract** — an accessible DOM overlay for flat
  mode, and a canvas-texture control panel inside the headset (controller
  ray interaction), driven by the same player state.
- **Hotspots** — yaw/pitch-anchored points of interest, selectable by tap
  in flat mode and by controller ray in VR.
- **Documented failure modes** — CORS problems, unsupported sources and
  autoplay blocks surface as structured errors (with the fix in the
  message), never as a silent black screen.

## Install

```bash
npm install sphera-player three hls.js
```

(three and hls.js are runtime dependencies loaded by the player.)

## Usage

```ts
import { SpheraPlayer } from 'sphera-player';

const player = new SpheraPlayer('#app', {
  src: 'https://cdn.example.com/tour-360.mp4',
  projection: 'equirect360', // 'equirect360-tb' | 'equirect360-sbs' | 'vr180'
  hotspots: [{ id: 'dock', yaw: 35, pitch: -5, label: 'Harbor' }],
});

player.on('ready', () => player.play());
player.on('hotspotactivate', ({ id }) => console.log('hotspot:', id));
player.on('error', (err) => console.error(err.code, err.message));

// Later, e.g. when embedding in an SPA that unmounts the view:
player.dispose();
```

### Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `src` | string | — | Video URL: progressive file or `.m3u8` HLS playlist. |
| `sourceType` | `'auto' \| 'file' \| 'hls'` | `'auto'` | Auto sniffs the extension (query strings OK). |
| `projection` | ProjectionType | `'equirect360'` | Initial layout; change later with `setProjection()`. |
| `autoplay` | `boolean \| 'muted'` | `false` | `'muted'` is the mode browsers allow without a gesture. |
| `muted`, `volume`, `loop`, `poster` | — | — | Passed to the media element. |
| `fov` | number | `75` | Initial field of view, clamped to 35–100. |
| `gyro` | boolean | `false` | Start with device-orientation look where available. |
| `hotspots` | HotspotDef[] | `[]` | `{ id, yaw, pitch, label?, data? }`, angles in degrees. |
| `crossorigin` | string | `'anonymous'` | Required for WebGL textures from cross-origin media. |

### Methods

`play()`, `pause()`, `togglePlay()`, `seek(seconds)`, `setVolume(0..1)`,
`setMuted(bool)`, `setProjection(type)`, `setGyroEnabled(bool)` (async —
resolves false when unavailable or permission denied), `getState()`,
`getQualityLevels()`, `addHotspot(def)`, `removeHotspot(id)`,
`clearHotspots()`, `getVideoElement()`, `dispose()`.

### Events

`ready`, `play`, `pause`, `ended`, `seek`, `timeupdate`, `statechange`,
`qualitychange`, `projectionchange`, `hotspotactivate`, `xrstart`, `xrend`,
`error` (payload: `{ code, message, fatal, cause? }`).

## CORS — read this before filing a bug

The video file and HLS segments must be served with
`Access-Control-Allow-Origin` headers. Without them the browser refuses to
let WebGL read the frames, and playback fails with `SOURCE_LOAD_FAILED`
(the player prints this hint in its error banner). There is no way around
this from the player side.

## Examples

After `npm install && npm run build`, serve the repo root with any static
server and open:

- `examples/basic.html` — mono 360, drag look
- `examples/stereo-vr180.html` — TB / SBS / VR180 switching
- `examples/hls-hotspots.html` — HLS stream with hotspots and quality menu

Each example accepts `?src=YOUR_URL` (and stereo-vr180 also
`?projection=`) in the query string to play your own footage.

## Development

```bash
npm install
bash scripts/ci-check.sh   # typecheck + unit tests + production build
npm test                   # unit tests only (state machine, source
                           # detection, look math, stereo UVs, hotspots)
```

See `docs/manual-test-matrix.md` for the browser/device verification
checklist that complements the unit tests.

## Roadmap

Built: scaffolding, core state/events, HLS source loader, projection
strategies (360 mono/stereo, VR180), pointer + gyro controls, DOM UI,
player facade, WebXR sessions with per-eye stereo, in-VR panel, hotspots,
examples and docs.

Future: fisheye projection shader (dual-fisheye cameras), subtitles rendered
into the VR panel, ambisonics spatial audio hook, React wrapper package.

## License

MIT
