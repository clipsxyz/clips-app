# Demo feed videos (mock mode)

`flower.mp4` is served by Vite at `/demo-videos/flower.mp4` so phones on your LAN load video from the **same origin** as the dev server (no Google CDN / CORS issues).

Mock posts in `src/api/posts.ts` point here when `VITE_USE_LARAVEL_API=false`.
