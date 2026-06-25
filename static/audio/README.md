# Trip Reel music tracks

Drop license-cleared, loopable audio here matching the ids in
`src/lib/stores/tripReelStore.ts` → `TRIP_MUSIC`:

- `wander.mp3`  (120 BPM)
- `voyage.mp3`  (100 BPM)
- `sunrise.mp3` (90 BPM)

VERIFY LICENSING before shipping any track.

These are NOT wired into the exported video yet: Foundation v1
(`attachAudioTrack` in `src/lib/reels/beat.ts`) is a no-op pass-through and
`recordReel` records video-only. The music picker currently (a) drives the
beat grid / arrival quantization timing and (b) is saved into the share-link so
it round-trips. Audio merge lands when the Foundation `recordReel` exposes an
audio option (see beat.ts jsdoc for the AudioContext → createMediaStreamDestination merge).
