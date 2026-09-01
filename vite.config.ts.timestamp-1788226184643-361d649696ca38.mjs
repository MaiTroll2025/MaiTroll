// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/kainm/TC%20ONLY/TrollCity/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/kainm/TC%20ONLY/TrollCity/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///C:/Users/kainm/TC%20ONLY/TrollCity/node_modules/vite-tsconfig-paths/dist/index.js";
import { VitePWA } from "file:///C:/Users/kainm/TC%20ONLY/TrollCity/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import fs from "fs";
var __vite_injected_original_dirname = "C:\\Users\\kainm\\TC ONLY\\TrollCity";
var disableHmr = process.env.DISABLE_HMR === "1";
var appVersion = "1.0.0";
var buildTime = Date.now();
try {
  const versionPath = path.resolve(__vite_injected_original_dirname, "public/version.json");
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
    appVersion = versionData.version || "1.0.0";
    buildTime = versionData.buildTime || Date.now();
  }
} catch (error) {
  console.warn("Could not read version.json in vite.config.ts", error);
}
var vite_config_default = defineConfig(({ mode }) => {
  const root = path.resolve(__vite_injected_original_dirname);
  const env = loadEnv(mode, root, "VITE_");
  console.log("Vite env load:", {
    root,
    envFileExists: fs.existsSync(path.resolve(root, ".env")),
    SUPABASE_URL: !!env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!env.VITE_SUPABASE_ANON_KEY
  });
  const isElectronBuild = process.env.ELECTRON_BUILD === "1";
  return {
    root,
    envDir: root,
    base: isElectronBuild ? "./" : "/",
    define: {
      global: "window",
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TIME__: JSON.stringify(buildTime),
      __APP_BUILD_ID__: JSON.stringify(buildTime),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_EDGE_FUNCTIONS_URL": JSON.stringify(env.VITE_EDGE_FUNCTIONS_URL)
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
          enabled: process.env.VITE_PWA_DEV === "1"
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
        injectRegister: false,
        strategies: "injectManifest",
        srcDir: "src",
        filename: "service-worker.ts",
        injectManifest: {
          globPatterns: [
            "index.html",
            "assets/*.css",
            "assets/*.{js,mjs}"
          ],
          globIgnores: [
            "**/*.chunk.js",
            "**/*.chunk.mjs",
            "**/*-??-??-??.js",
            "**/*-??-??-??.mjs"
          ],
          maximumFileSizeToCacheInBytes: 5e6
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/gejtbllazzighxwxudyu\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24
                  // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:js|css|mjs)$/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-chunks",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                  // 30 days
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                  // 30 days
                }
              }
            },
            {
              urlPattern: /^https:\/\/cdn\.maitroll\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "stream-assets",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 2
                  // 2 hours
                }
              }
            }
          ]
        }
      })
    ],
    base: "/",
    server: {
      host: true,
      https: process.env.VITE_FORCE_HTTPS === "1",
      port: 5178,
      strictPort: false,
      hmr: disableHmr ? false : { overlay: false },
      proxy: {
        "/api": {
          target: "http://localhost:3002",
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("proxy error", err);
            });
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              console.log("Sending Request to Target:", req.method, req.url);
            });
            proxy.on("proxyRes", (proxyRes, req, _res) => {
              console.log("Received Response from Target:", proxyRes.statusCode, req.url);
            });
          }
        },
        "/streams": {
          target: "https://cdn.maitroll.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path2) => path2,
          configure: (proxy, _options) => {
            proxy.on("proxyRes", (proxyRes, req, res) => {
              if (req.url && req.url.includes(".m3u8") && proxyRes.headers["content-type"]?.includes("text/html")) {
                proxyRes.destroy();
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found (Blocked HTML response for m3u8)");
              }
            });
          }
        }
      }
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ["console.log", "console.info", "console.debug"]
        },
        mangle: { safari10: true },
        format: { comments: false }
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom") || id.includes("zustand")) {
                return "vendor-react";
              }
              if (id.includes("@supabase")) {
                return "vendor-supabase";
              }
              if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("sonner") || id.includes("recharts") || id.includes("react-swipeable")) {
                return "vendor-ui";
              }
              if (id.includes("@babylonjs") || id.includes("three") || id.includes("@react-three") || id.includes("gsap")) {
                return "vendor-3d";
              }
              if (id.includes("hls.js") || id.includes("livekit") || id.includes("socket.io")) {
                return "vendor-media";
              }
              if (id.includes("@stripe") || id.includes("@paypal") || id.includes("stripe")) {
                return "vendor-payment";
              }
              if (id.includes("cannon-es") || id.includes("@react-three/rapier")) {
                return "vendor-3d-physics";
              }
              if (id.includes("@react-three/fiber") || id.includes("@react-three/drei") || id.includes("@rive-app/react-canvas")) {
                return "vendor-3d-renderer";
              }
              if (id.includes("@mediapipe") || id.includes("face-api.js")) {
                return "vendor-face-api";
              }
              if (id.includes("@remotion")) {
                return "vendor-remotion";
              }
              if (id.includes("@tsparticles")) {
                return "vendor-particles";
              }
              if (id.includes("agora-rtc-sdk-ng") || id.includes("agora-token")) {
                return "vendor-agora";
              }
              if (id.includes("@ffmpeg")) {
                return "vendor-ffmpeg";
              }
            }
            if (id.includes("src/pages/admin") || id.includes("src\\pages\\admin")) {
              return "admin-core";
            }
            if (id.includes("src/components/broadcast") || id.includes("src\\components\\broadcast")) {
              return "broadcast-components";
            }
            if (id.includes("src/pages/auction") || id.includes("src\\pages\\auction")) {
              return "auction-pages";
            }
            if (id.includes("src/pages/gaming") || id.includes("src\\pages\\gaming")) {
              return "gaming-pages";
            }
            if (id.includes("src/pages/tcnn") || id.includes("src\\pages\\tcnn")) {
              return "tcnn-pages";
            }
            if (id.includes("src/pages/family") || id.includes("src\\pages\\family") || id.includes("src/pages/TrollFamily") || id.includes("src\\pages\\TrollFamily")) {
              return "family-pages";
            }
            if (id.includes("src/pages/MapPage") || id.includes("src\\pages\\MapPage") || id.includes("src/pages/CourtRoom") || id.includes("src\\pages\\CourtRoom")) {
              return "map-court-pages";
            }
          }
        }
      },
      chunkSizeWarningLimit: 800,
      reportCompressedSize: true
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "src")
      }
    },
    optimizeDeps: {
      exclude: ["livekit-client"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxrYWlubVxcXFxUQyBPTkxZXFxcXFRyb2xsQ2l0eVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxca2Fpbm1cXFxcVEMgT05MWVxcXFxUcm9sbENpdHlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2thaW5tL1RDJTIwT05MWS9Ucm9sbENpdHkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSAndml0ZS10c2NvbmZpZy1wYXRocydcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuXG4vLyBIVFRQUyBpcyB0eXBpY2FsbHkgUkVRVUlSRUQgZm9yIFdlYlJUQyAoY2FtZXJhL21pY3JvcGhvbmUgYWNjZXNzKVxuLy8gQnJvd3NlcnMgYmxvY2sgZ2V0VXNlck1lZGlhKCkgb24gSFRUUCBleGNlcHQgbG9jYWxob3N0LlxuLy8gU2V0IFZJVEVfRk9SQ0VfSFRUUFM9MSB0byBlbmFibGUgSFRUUFMgZm9yIG1vYmlsZSB0ZXN0aW5nLlxuXG5jb25zdCBkaXNhYmxlSG1yID0gcHJvY2Vzcy5lbnYuRElTQUJMRV9ITVIgPT09ICcxJ1xuXG4vLyBSZWFkIHZlcnNpb24uanNvblxubGV0IGFwcFZlcnNpb24gPSAnMS4wLjAnO1xubGV0IGJ1aWxkVGltZSA9IERhdGUubm93KCk7XG50cnkge1xuICBjb25zdCB2ZXJzaW9uUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMvdmVyc2lvbi5qc29uJyk7XG4gIGlmIChmcy5leGlzdHNTeW5jKHZlcnNpb25QYXRoKSkge1xuICAgIGNvbnN0IHZlcnNpb25EYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmModmVyc2lvblBhdGgsICd1dGYtOCcpKTtcbiAgICBhcHBWZXJzaW9uID0gdmVyc2lvbkRhdGEudmVyc2lvbiB8fCAnMS4wLjAnO1xuICAgIGJ1aWxkVGltZSA9IHZlcnNpb25EYXRhLmJ1aWxkVGltZSB8fCBEYXRlLm5vdygpO1xuICB9XG59IGNhdGNoIChlcnJvcikge1xuICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCByZWFkIHZlcnNpb24uanNvbiBpbiB2aXRlLmNvbmZpZy50cycsIGVycm9yKTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lKVxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHJvb3QsICdWSVRFXycpXG4gIGNvbnNvbGUubG9nKCdWaXRlIGVudiBsb2FkOicsIHtcbiAgICByb290LFxuICAgIGVudkZpbGVFeGlzdHM6IGZzLmV4aXN0c1N5bmMocGF0aC5yZXNvbHZlKHJvb3QsICcuZW52JykpLFxuICAgIFNVUEFCQVNFX1VSTDogISFlbnYuVklURV9TVVBBQkFTRV9VUkwsXG4gICAgU1VQQUJBU0VfQU5PTl9LRVk6ICEhZW52LlZJVEVfU1VQQUJBU0VfQU5PTl9LRVksXG4gIH0pXG5cbiAgY29uc3QgaXNFbGVjdHJvbkJ1aWxkID0gcHJvY2Vzcy5lbnYuRUxFQ1RST05fQlVJTEQgPT09ICcxJ1xuXG4gIHJldHVybiB7XG4gICAgcm9vdCxcbiAgICBlbnZEaXI6IHJvb3QsXG4gICAgYmFzZTogaXNFbGVjdHJvbkJ1aWxkID8gJy4vJyA6ICcvJyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIGdsb2JhbDogJ3dpbmRvdycsXG4gICAgICBfX0FQUF9WRVJTSU9OX186IEpTT04uc3RyaW5naWZ5KGFwcFZlcnNpb24pLFxuICAgICAgX19CVUlMRF9USU1FX186IEpTT04uc3RyaW5naWZ5KGJ1aWxkVGltZSksXG4gICAgICBfX0FQUF9CVUlMRF9JRF9fOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWUpLFxuICAgICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX1NVUEFCQVNFX1VSTCc6IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX1NVUEFCQVNFX1VSTCksXG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfU1VQQUJBU0VfQU5PTl9LRVknOiBKU09OLnN0cmluZ2lmeShlbnYuVklURV9TVVBBQkFTRV9BTk9OX0tFWSksXG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfRURHRV9GVU5DVElPTlNfVVJMJzogSlNPTi5zdHJpbmdpZnkoZW52LlZJVEVfRURHRV9GVU5DVElPTlNfVVJMKSxcbiAgICAgIC8vIE5PVEU6IFZJVEVfU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWSBpcyBpbnRlbnRpb25hbGx5IE5PVCBleHBvc2VkIHRvIHRoZSBjbGllbnQuXG4gICAgICAvLyBJdCBzaG91bGQgb25seSBiZSB1c2VkIGluIHNlcnZlci1zaWRlIGNvZGUgYW5kIGVkZ2UgZnVuY3Rpb25zLlxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoKSxcbiAgICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICAgIFZpdGVQV0Eoe1xuICAgICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgICBpbmNsdWRlQXNzZXRzOiBbXCJmYXZpY29uLmljb1wiLCBcInJvYm90cy50eHRcIiwgXCJhcHBsZS10b3VjaC1pY29uLnBuZ1wiXSxcbiAgICAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICAgIGVuYWJsZWQ6IHByb2Nlc3MuZW52LlZJVEVfUFdBX0RFViA9PT0gJzEnXG4gICAgICAgIH0sXG4gICAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgICAgbmFtZTogXCJNYWkgVHJvbGxcIixcbiAgICAgICAgICBzaG9ydF9uYW1lOiBcIk1haSBUcm9sbFwiLFxuICAgICAgICAgIHN0YXJ0X3VybDogXCIvbW9iaWxlXCIsXG4gICAgICAgICAgc2NvcGU6IFwiL1wiLFxuICAgICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxuICAgICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzA1MDEwYVwiLFxuICAgICAgICAgIHRoZW1lX2NvbG9yOiBcIiM2YTAwZmZcIixcbiAgICAgICAgICBvcmllbnRhdGlvbjogXCJwb3J0cmFpdFwiLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSB1bHRpbWF0ZSBsaXZlIHN0cmVhbWluZyAmIHNvY2lhbCBjb2luIGVjb25vbXkgcGxhdGZvcm0uXCIsXG4gICAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi03Mi5wbmdcIiwgXCJzaXplc1wiOiBcIjcyeDcyXCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXG4gICAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tOTYucG5nXCIsIFwic2l6ZXNcIjogXCI5Nng5NlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxuICAgICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTEyOC5wbmdcIiwgXCJzaXplc1wiOiBcIjEyOHgxMjhcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIgfSxcbiAgICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi0xNDQucG5nXCIsIFwic2l6ZXNcIjogXCIxNDR4MTQ0XCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXG4gICAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tMTUyLnBuZ1wiLCBcInNpemVzXCI6IFwiMTUyeDE1MlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxuICAgICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTE5Mi5wbmdcIiwgXCJzaXplc1wiOiBcIjE5MngxOTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIgfSxcbiAgICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi0yNTYucG5nXCIsIFwic2l6ZXNcIjogXCIyNTZ4MjU2XCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXG4gICAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tNTEyLnBuZ1wiLCBcInNpemVzXCI6IFwiNTEyeDUxMlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiB9LFxuICAgICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgXCJzaXplc1wiOiBcIjUxMng1MTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIsIFwicHVycG9zZVwiOiBcImFueSBtYXNrYWJsZVwiIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIGluamVjdFJlZ2lzdGVyOiBmYWxzZSxcbiAgICAgICAgc3RyYXRlZ2llczogJ2luamVjdE1hbmlmZXN0JyxcbiAgICAgICAgc3JjRGlyOiAnc3JjJyxcbiAgICAgICAgZmlsZW5hbWU6ICdzZXJ2aWNlLXdvcmtlci50cycsXG4gICAgICAgIGluamVjdE1hbmlmZXN0OiB7XG4gICAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXG4gICAgICAgICAgICAnaW5kZXguaHRtbCcsXG4gICAgICAgICAgICAnYXNzZXRzLyouY3NzJyxcbiAgICAgICAgICAgICdhc3NldHMvKi57anMsbWpzfSdcbiAgICAgICAgICBdLFxuICAgICAgICAgIGdsb2JJZ25vcmVzOiBbXG4gICAgICAgICAgICAnKiovKi5jaHVuay5qcycsXG4gICAgICAgICAgICAnKiovKi5jaHVuay5tanMnLFxuICAgICAgICAgICAgJyoqLyotPz8tPz8tPz8uanMnLFxuICAgICAgICAgICAgJyoqLyotPz8tPz8tPz8ubWpzJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDUwMDAwMDAsXG4gICAgICAgIH0sXG4gICAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXG4gICAgICAgICAgY2xpZW50c0NsYWltOiB0cnVlLFxuICAgICAgICAgIHNraXBXYWl0aW5nOiB0cnVlLFxuICAgICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZ2VqdGJsbGF6emlnaHh3eHVkeXVcXC5zdXBhYmFzZVxcLmNvXFwvLiovaSxcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1jYWNoZScsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAsXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgLy8gMjQgaG91cnNcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4oPzpqc3xjc3N8bWpzKSQvaSxcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ1N0YWxlV2hpbGVSZXZhbGlkYXRlJyxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N0YXRpYy1jaHVua3MnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwMCxcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwIC8vIDMwIGRheXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4oPzpwbmd8anBnfGpwZWd8c3ZnfGdpZnx3ZWJwfGljbykkL2ksXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2ltYWdlcycsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogNjAsXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCAvLyAzMCBkYXlzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2NkblxcLm1haXRyb2xsXFwuY29tXFwvLiovaSxcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnc3RyZWFtLWFzc2V0cycsXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMjAsXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMiAvLyAyIGhvdXJzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgXSxcbiAgICBiYXNlOiAnLycsXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgaHR0cHM6IHByb2Nlc3MuZW52LlZJVEVfRk9SQ0VfSFRUUFMgPT09ICcxJyxcbiAgICAgIHBvcnQ6IDUxNzgsXG4gICAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICAgIGhtcjogZGlzYWJsZUhtciA/IGZhbHNlIDogeyBvdmVybGF5OiBmYWxzZSB9LFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJy9hcGknOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAyJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIFJlcXVlc3QgdG8gVGFyZ2V0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1JlY2VpdmVkIFJlc3BvbnNlIGZyb20gVGFyZ2V0OicsIHByb3h5UmVzLnN0YXR1c0NvZGUsIHJlcS51cmwpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgICcvc3RyZWFtcyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL2Nkbi5tYWl0cm9sbC5jb20nLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICBzZWN1cmU6IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXG4gICAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XG4gICAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChyZXEudXJsICYmIHJlcS51cmwuaW5jbHVkZXMoJy5tM3U4JykgJiYgcHJveHlSZXMuaGVhZGVyc1snY29udGVudC10eXBlJ10/LmluY2x1ZGVzKCd0ZXh0L2h0bWwnKSkge1xuICAgICAgICAgICAgICAgIHByb3h5UmVzLmRlc3Ryb3koKVxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbicgfSlcbiAgICAgICAgICAgICAgICByZXMuZW5kKCdOb3QgRm91bmQgKEJsb2NrZWQgSFRNTCByZXNwb25zZSBmb3IgbTN1OCknKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxuICAgICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcbiAgICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgICBtaW5pZnk6ICd0ZXJzZXInLFxuICAgICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgICBjb21wcmVzczoge1xuICAgICAgICAgIGRyb3BfY29uc29sZTogdHJ1ZSxcbiAgICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxuICAgICAgICAgIHB1cmVfZnVuY3M6IFsnY29uc29sZS5sb2cnLCAnY29uc29sZS5pbmZvJywgJ2NvbnNvbGUuZGVidWcnXSxcbiAgICAgICAgfSxcbiAgICAgICAgbWFuZ2xlOiB7IHNhZmFyaTEwOiB0cnVlIH0sXG4gICAgICAgIGZvcm1hdDogeyBjb21tZW50czogZmFsc2UgfSxcbiAgICAgIH0sXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LXJvdXRlci1kb20nKSB8fCBpZC5pbmNsdWRlcygnenVzdGFuZCcpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcmVhY3QnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAc3VwYWJhc2UnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXN1cGFiYXNlJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZnJhbWVyLW1vdGlvbicpIHx8IGlkLmluY2x1ZGVzKCdsdWNpZGUtcmVhY3QnKSB8fCBpZC5pbmNsdWRlcygnY2xzeCcpIHx8IGlkLmluY2x1ZGVzKCd0YWlsd2luZC1tZXJnZScpIHx8IGlkLmluY2x1ZGVzKCdzb25uZXInKSB8fCBpZC5pbmNsdWRlcygncmVjaGFydHMnKSB8fCBpZC5pbmNsdWRlcygncmVhY3Qtc3dpcGVhYmxlJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci11aSdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BiYWJ5bG9uanMnKSB8fCBpZC5pbmNsdWRlcygndGhyZWUnKSB8fCBpZC5pbmNsdWRlcygnQHJlYWN0LXRocmVlJykgfHwgaWQuaW5jbHVkZXMoJ2dzYXAnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLTNkJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnaGxzLmpzJykgfHwgaWQuaW5jbHVkZXMoJ2xpdmVraXQnKSB8fCBpZC5pbmNsdWRlcygnc29ja2V0LmlvJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1tZWRpYSdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdHJpcGUnKSB8fCBpZC5pbmNsdWRlcygnQHBheXBhbCcpIHx8IGlkLmluY2x1ZGVzKCdzdHJpcGUnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXBheW1lbnQnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdjYW5ub24tZXMnKSB8fCBpZC5pbmNsdWRlcygnQHJlYWN0LXRocmVlL3JhcGllcicpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItM2QtcGh5c2ljcydcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0ByZWFjdC10aHJlZS9maWJlcicpIHx8IGlkLmluY2x1ZGVzKCdAcmVhY3QtdGhyZWUvZHJlaScpIHx8IGlkLmluY2x1ZGVzKCdAcml2ZS1hcHAvcmVhY3QtY2FudmFzJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci0zZC1yZW5kZXJlcidcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BtZWRpYXBpcGUnKSB8fCBpZC5pbmNsdWRlcygnZmFjZS1hcGkuanMnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWZhY2UtYXBpJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnQHJlbW90aW9uJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1yZW1vdGlvbidcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0B0c3BhcnRpY2xlcycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcGFydGljbGVzJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnYWdvcmEtcnRjLXNkay1uZycpIHx8IGlkLmluY2x1ZGVzKCdhZ29yYS10b2tlbicpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItYWdvcmEnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAZmZtcGVnJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1mZm1wZWcnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnc3JjL3BhZ2VzL2FkbWluJykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxwYWdlc1xcXFxhZG1pbicpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnYWRtaW4tY29yZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnc3JjL2NvbXBvbmVudHMvYnJvYWRjYXN0JykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxjb21wb25lbnRzXFxcXGJyb2FkY2FzdCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnYnJvYWRjYXN0LWNvbXBvbmVudHMnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9hdWN0aW9uJykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxwYWdlc1xcXFxhdWN0aW9uJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdhdWN0aW9uLXBhZ2VzJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdzcmMvcGFnZXMvZ2FtaW5nJykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxwYWdlc1xcXFxnYW1pbmcnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ2dhbWluZy1wYWdlcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnc3JjL3BhZ2VzL3Rjbm4nKSB8fCBpZC5pbmNsdWRlcygnc3JjXFxcXHBhZ2VzXFxcXHRjbm4nKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3Rjbm4tcGFnZXMnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9mYW1pbHknKSB8fCBpZC5pbmNsdWRlcygnc3JjXFxcXHBhZ2VzXFxcXGZhbWlseScpIHx8IGlkLmluY2x1ZGVzKCdzcmMvcGFnZXMvVHJvbGxGYW1pbHknKSB8fCBpZC5pbmNsdWRlcygnc3JjXFxcXHBhZ2VzXFxcXFRyb2xsRmFtaWx5JykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdmYW1pbHktcGFnZXMnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9NYXBQYWdlJykgfHwgaWQuaW5jbHVkZXMoJ3NyY1xcXFxwYWdlc1xcXFxNYXBQYWdlJykgfHwgaWQuaW5jbHVkZXMoJ3NyYy9wYWdlcy9Db3VydFJvb20nKSB8fCBpZC5pbmNsdWRlcygnc3JjXFxcXHBhZ2VzXFxcXENvdXJ0Um9vbScpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnbWFwLWNvdXJ0LXBhZ2VzJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA4MDAsXG4gICAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogdHJ1ZSxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYycpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgZXhjbHVkZTogWydsaXZla2l0LWNsaWVudCddLFxuICAgIH0sXG4gIH1cbn0pIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4UixTQUFTLGNBQWMsZUFBZTtBQUNwVSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFMZixJQUFNLG1DQUFtQztBQVd6QyxJQUFNLGFBQWEsUUFBUSxJQUFJLGdCQUFnQjtBQUcvQyxJQUFJLGFBQWE7QUFDakIsSUFBSSxZQUFZLEtBQUssSUFBSTtBQUN6QixJQUFJO0FBQ0YsUUFBTSxjQUFjLEtBQUssUUFBUSxrQ0FBVyxxQkFBcUI7QUFDakUsTUFBSSxHQUFHLFdBQVcsV0FBVyxHQUFHO0FBQzlCLFVBQU0sY0FBYyxLQUFLLE1BQU0sR0FBRyxhQUFhLGFBQWEsT0FBTyxDQUFDO0FBQ3BFLGlCQUFhLFlBQVksV0FBVztBQUNwQyxnQkFBWSxZQUFZLGFBQWEsS0FBSyxJQUFJO0FBQUEsRUFDaEQ7QUFDRixTQUFTLE9BQU87QUFDZCxVQUFRLEtBQUssaURBQWlELEtBQUs7QUFDckU7QUFHQSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE9BQU8sS0FBSyxRQUFRLGdDQUFTO0FBQ25DLFFBQU0sTUFBTSxRQUFRLE1BQU0sTUFBTSxPQUFPO0FBQ3ZDLFVBQVEsSUFBSSxrQkFBa0I7QUFBQSxJQUM1QjtBQUFBLElBQ0EsZUFBZSxHQUFHLFdBQVcsS0FBSyxRQUFRLE1BQU0sTUFBTSxD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YSxHQUFHO0FBQzNELHVCQUFPO0FBQUEsY0FDVDtBQUNBLGtCQUFJLEdBQUcsU0FBUyxXQUFXLEdBQUc7QUFDNUIsdUJBQU87QUFBQSxjQUNUO0FBQ0Esa0JBQUksR0FBRyxTQUFTLGNBQWMsR0FBRztBQUMvQix1QkFBTztBQUFBLGNBQ1Q7QUFDQSxrQkFBSSxHQUFHLFNBQVMsa0JBQWtCLEtBQUssR0FBRyxTQUFTLGFBQWEsR0FBRztBQUNqRSx1QkFBTztBQUFBLGNBQ1Q7QUFDQSxrQkFBSSxHQUFHLFNBQVMsU0FBUyxHQUFHO0FBQzFCLHVCQUFPO0FBQUEsY0FDVDtBQUFBLFlBQ0Y7QUFDQSxnQkFBSSxHQUFHLFNBQVMsaUJBQWlCLEtBQUssR0FBRyxTQUFTLG1CQUFtQixHQUFHO0FBQ3RFLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUywwQkFBMEIsS0FBSyxHQUFHLFNBQVMsNEJBQTRCLEdBQUc7QUFDeEYscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLG1CQUFtQixLQUFLLEdBQUcsU0FBUyxxQkFBcUIsR0FBRztBQUMxRSxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsa0JBQWtCLEtBQUssR0FBRyxTQUFTLG9CQUFvQixHQUFHO0FBQ3hFLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxnQkFBZ0IsS0FBSyxHQUFHLFNBQVMsa0JBQWtCLEdBQUc7QUFDcEUscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLGtCQUFrQixLQUFLLEdBQUcsU0FBUyxvQkFBb0IsS0FBSyxHQUFHLFNBQVMsdUJBQXVCLEtBQUssR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQzFKLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxHQUFHLFNBQVMscUJBQXFCLEtBQUssR0FBRyxTQUFTLHFCQUFxQixLQUFLLEdBQUcsU0FBUyx1QkFBdUIsR0FBRztBQUN4SixxQkFBTztBQUFBLFlBQ1Q7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHVCQUF1QjtBQUFBLE1BQ3ZCLHNCQUFzQjtBQUFBLElBQ3hCO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDcEM7QUFBQSxJQUNGO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWixTQUFTLENBQUMsZ0JBQWdCO0FBQUEsSUFDNUI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsicGF0aCJdCn0K
