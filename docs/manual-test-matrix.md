# Manual test matrix

Video playback cannot be meaningfully automated in a headless browser, so
this checklist is a first-class part of the project. Run it before releases.

## Desktop Chrome / Edge / Firefox

- [ ] `examples/basic.html`: video loads, drag look works with inertia,
      wheel zooms FOV within 35–100, seek bar and volume respond.
- [ ] A non-CORS video URL shows the red error banner with the CORS hint
      (not a silent black screen).
- [ ] `examples/hls-hotspots.html` with a real HLS stream: quality menu
      appears, Auto + level entries switch quality, `qualitychange` fires.

## Safari (macOS)

- [ ] HLS plays through the native pipeline (quality menu stays hidden —
      expected; Safari does not expose levels).
- [ ] Progressive MP4 plays; poster shows before the first frame.

## iOS Safari

- [ ] Tapping **Gyro** triggers the system permission prompt; granting it
      switches to gyro look, denying it keeps pointer look.
- [ ] Video plays inline (no forced fullscreen takeover).

## Android Chrome

- [ ] Gyro look works without a permission prompt.
- [ ] Fullscreen button enters/exits fullscreen and the view resizes cleanly.

## Quest Browser (WebXR)

- [ ] The **Enter VR** button appears in the top-right of the player.
- [ ] Stereo TB/SBS content: each eye sees only its half of the frame
      (verify by closing one eye — no doubled/ghosted image).
- [ ] VR180 content fills the front hemisphere, nothing behind the viewer.
- [ ] The in-VR panel is visible below eye level; controller trigger on
      Play/Pause and ±10s buttons works; progress advances per second.
- [ ] Hotspots can be selected with the controller ray.
- [ ] Exiting VR returns to the flat preview showing the left eye.

## Encode guidance

- 360 mono: equirectangular, max 3840 px wide for broad device support.
- 360 stereo TB: max 3840×3840. Mobile GPUs commonly cap video textures at
  4096 px — 8K 360 will fail or downscale on many phones.
- All sources must be served with `Access-Control-Allow-Origin` (CORS);
  WebGL cannot use cross-origin video textures without it.
