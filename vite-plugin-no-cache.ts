import type { Plugin } from 'vite'

/**
 * Vite plugin to disable caching in development
 * Sets no-cache headers on all responses
 */
export function noCache(): Plugin {
  return {
    name: 'no-cache',
    configureServer(server) {
      // Apply to all requests - but only set headers, don't block
      server.middlewares.use((_req, res, next) => {
        // Set aggressive no-cache headers for all responses
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        next()
      })
    },
  }
}

