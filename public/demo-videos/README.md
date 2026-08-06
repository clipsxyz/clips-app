# Demo feed videos (mock mode)

`bbb.mp4` (Big Buck Bunny sample) is served by Vite at `/demo-videos/bbb.mp4` so phones on your LAN load video from the **same origin** as the dev server (no CDN / CORS issues).

On React Native the same file is bundled from `src/assets/demo-videos/bbb.mp4`.

Mock posts in `src/api/posts.ts` point here when `VITE_USE_LARAVEL_API=false`.
