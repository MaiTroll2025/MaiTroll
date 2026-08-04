import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// HTTPS is typically REQUIRED for WebRTC (camera/microphone access)
// Browsers block getUserMedia() on HTTP except localhost.
// Set VITE_FORCE_HTTPS=1 to enable HTTPS for mobile testing.

const disableHmr = process.env.DISABLE_HMR === '1'

// Read version.json
let appVersion = '1.0.0';
let buildTime = Date.now();
try {
  const versionPath = path.resolve(__dirname, 'public/version.json');
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    appVersion = versionData.version || '1.0.0';
    buildTime = versionData.buildTime || Date.now();
  }
} catch (error) {
  console.warn('Could not read version.json in vite.config.ts', error);
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname)
  const env = loadEnv(mode, root, 'VITE_')
  console.log('Vite env load:', {
    root,
    envFileExists: fs.existsSync(path.resolve(root, '.env')),
    SUPABASE_URL: !!env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!env.VITE_SUPABASE_ANON_KEY,
  })

  return {
    root,
    envDir: root,
    define: {
      global: 'window',
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TIME__: JSON.stringify(buildTime),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      // NOTE: VITE_SUPABASE_SERVICE_ROLE_KEY is intentionally NOT exposed to the client.
      // It should only be used in server-side code and edge functions.
    },
    plugins: [
      react(),
      tsconfigPaths(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
        devOptions: {
          enabled: process.env.VITE_PWA_DEV === '1'
        },
        manifest: {
          name: "Mai Troll",
          short_name: "Mai Troll",
          start_url: "/mobile",
          scope: "/",
          display: "standalone",
          background_color: "#05010a",
          theme_color: "#6a00ff",
          orientation: "portrait",
          description: "The ultimate live streaming & social coin economy platform.",
          icons: [
            { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
            { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
            { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
            { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
            { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
            { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/icons/icon-256.png", "sizes": "256x256", "type": "image/png" },
            { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
            { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
          ]
        },
        injectRegister: 'auto',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'service-worker.ts',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          globIgnores: ['index.html'],
          maximumFileSizeToCacheInBytes: 10000000,
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
        },
      }),
    ],
    base: '/',
    server: {
      host: true,
      https: process.env.VITE_FORCE_HTTPS === '1',
      port: 5178,
      strictPort: false,
      hmr: disableHmr ? false : { overlay: false },
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to Target:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from Target:', proxyRes.statusCode, req.url)
            })
          },
        },
        '/streams': {
          target: 'https://cdn.maiMai Troll.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              if (req.url && req.url.includes('.m3u8') && proxyRes.headers['content-type']?.includes('text/html')) {
                proxyRes.destroy()
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('Not Found (Blocked HTML response for m3u8)')
              }
            })
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: { safari10: true },
        format: { comments: false },
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('zustand')) {
                return 'vendor-react'
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase'
              }
              if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('sonner') || id.includes('recharts') || id.includes('react-swipeable')) {
                return 'vendor-ui'
              }
              if (id.includes('@babylonjs') || id.includes('three') || id.includes('@react-three') || id.includes('gsap')) {
                return 'vendor-3d'
              }
              if (id.includes('hls.js') || id.includes('livekit') || id.includes('socket.io')) {
                return 'vendor-media'
              }
              if (id.includes('@stripe') || id.includes('@paypal') || id.includes('stripe')) {
                return 'vendor-payment'
              }
            }
            if (id.includes('src/pages/admin') || id.includes('src\\pages\\admin')) {
              return 'admin-core'
            }
            if (id.includes('src/components/broadcast') || id.includes('src\\components\\broadcast')) {
              return 'broadcast-components'
            }
          },
        },
      },
      chunkSizeWarningLimit: 1500,
      reportCompressedSize: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      exclude: ['livekit-client'],
    },
  }
})