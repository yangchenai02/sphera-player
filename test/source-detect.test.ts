import { describe, expect, it } from 'vitest';
import { detectSourceKind, mapMediaError } from '../src/source';

describe('detectSourceKind', () => {
  it('detects plain HLS playlists', () => {
    expect(detectSourceKind('https://cdn.example.com/master.m3u8')).toBe('hls');
  });

  it('detects HLS behind signed URLs with query strings', () => {
    expect(detectSourceKind('https://cdn.example.com/master.m3u8?token=abc&x=1')).toBe('hls');
    expect(detectSourceKind('https://cdn.example.com/master.M3U8#frag')).toBe('hls');
  });

  it('treats progressive files as file sources', () => {
    expect(detectSourceKind('https://cdn.example.com/tour-360.mp4')).toBe('file');
    expect(detectSourceKind('https://cdn.example.com/tour.webm?dl=1')).toBe('file');
  });

  it('does not mistake a query parameter for an extension', () => {
    expect(detectSourceKind('https://cdn.example.com/play?file=clip.m3u8')).toBe('file');
  });

  it('honors explicit overrides', () => {
    expect(detectSourceKind('https://cdn.example.com/stream', 'hls')).toBe('hls');
    expect(detectSourceKind('https://cdn.example.com/master.m3u8', 'file')).toBe('file');
  });
});

describe('mapMediaError', () => {
  // HTMLMediaElement error codes: 1 aborted, 2 network, 3 decode, 4 src-not-supported.
  const fake = (code: number) => ({ code }) as MediaError;

  it('maps network failures to the CORS-hinting load error', () => {
    const err = mapMediaError(fake(2));
    expect(err.code).toBe('SOURCE_LOAD_FAILED');
    expect(err.message).toContain('CORS');
    expect(err.fatal).toBe(true);
  });

  it('maps unsupported sources distinctly', () => {
    expect(mapMediaError(fake(4)).code).toBe('SOURCE_NOT_SUPPORTED');
  });

  it('treats aborts as non-fatal', () => {
    expect(mapMediaError(fake(1)).fatal).toBe(false);
  });

  it('falls back for null or unknown codes', () => {
    expect(mapMediaError(null).code).toBe('MEDIA_ERROR');
    expect(mapMediaError(fake(99)).code).toBe('MEDIA_ERROR');
  });
});
