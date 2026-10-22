# Sphera Player

An XR 360/VR video player built on [three.js](https://threejs.org) — one
embeddable player for the formats real 360 cameras and platforms produce:
360 mono, 360 stereo (top-bottom / side-by-side), and VR180, on desktop,
mobile, and in a WebXR headset.

> Status: under active construction. This repository is being built as a
> series of small pull requests; see the roadmap below.

## Why

Most open-source web players stop at 360 mono, or are unmaintained. Sphera's
goal is format coverage behind one clean TypeScript API: a projection-strategy
core (each layout is a pluggable mesh/texture mapping), HLS adaptive
streaming, pointer/touch/gyro look controls, a DOM overlay UI for flat mode,
and an in-headset control panel for WebXR — with the failure modes (CORS,
texture size caps, autoplay policy) documented instead of discovered.

## Roadmap

1. Project scaffolding (Vite + TypeScript, CI check script)
2. Core types, typed event emitter, playback state machine
3. Source loader with HLS support and quality levels
4. Projection strategy interface + equirectangular 360
5. Pointer look controls (inertia, wheel/pinch FOV)
6. DOM overlay UI
7. `SpheraPlayer` facade
8. Stereo (TB/SBS) + VR180 projections, gyro control, WebXR session
9. In-VR control panel, hotspots, examples, full docs

## Development

```bash
npm install
bash scripts/ci-check.sh   # typecheck + unit tests + build
```

## License

MIT
