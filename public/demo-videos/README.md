# Demo feed videos (mock mode)

`bbb.mp4` is a **1080×1344 (~4:5) H.264** demo (~5s, ~3MB) so feed cards look sharp on phone screens. Vite serves it at `/demo-videos/bbb.mp4`; React Native bundles `src/assets/demo-videos/bbb.mp4`.

Mock posts in `src/api/posts.ts` use it when `VITE_USE_LARAVEL_API=false`. Regenerate with `scripts/gen-hd-feed-demo.swift` + ffmpeg if needed.
