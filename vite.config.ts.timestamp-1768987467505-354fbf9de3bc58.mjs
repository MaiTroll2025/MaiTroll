// vite.config.ts
import { defineConfig } from "file:///E:/troll/Mai Troll-1/node_modules/vite/dist/node/index.js";
import react from "file:///E:/troll/Mai Troll-1/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///E:/troll/Mai Troll-1/node_modules/vite-tsconfig-paths/dist/index.js";
import { VitePWA } from "file:///E:/troll/Mai Troll-1/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import mkcert from "file:///E:/troll/Mai Troll-1/node_modules/vite-plugin-mkcert/dist/mkcert.mjs";
var __vite_injected_original_dirname = "E:\\troll\\Mai Troll-1";
var disableHmr = process.env.DISABLE_HMR === "1";
var vite_config_default = defineConfig({
  define: {
    global: "window"
  },
  plugins: [
    react(),
    tsconfigPaths(),
    mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      devOptions: {
        enabled: false
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
          { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
          { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
      },
      // Use injectManifest so we ship a local, audited service worker rather
      // than relying on CDN importScripts. The custom sw at `src/service-worker.ts`
      // implements push, offline fallback and safe navigation handling.
      injectRegister: "auto",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        maximumFileSizeToCacheInBytes: 1e7
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ],
  base: "/",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: disableHmr ? false : { overlay: false },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT || 3001}`,
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
            console.log(
              "Received Response from Target:",
              proxyRes.statusCode,
              req.url
            );
          });
        }
      }
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "zustand"],
          livekit: ["livekit-client", "@livekit/components-react"],
          supabase: ["@supabase/supabase-js"],
          ui: ["framer-motion", "lucide-react", "sonner"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFx0cm9sbFxcXFx0cm9sbGNpdHktMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcdHJvbGxcXFxcdHJvbGxjaXR5LTFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L3Ryb2xsL3Ryb2xsY2l0eS0xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJ1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgbWtjZXJ0IGZyb20gJ3ZpdGUtcGx1Z2luLW1rY2VydCdcclxuLy8gaW1wb3J0IHsgdHJhZUJhZGdlUGx1Z2luIH0gZnJvbSAndml0ZS1wbHVnaW4tdHJhZS1zb2xvLWJhZGdlJztcclxuXHJcbi8vIFx1RDgzRFx1REVBQiBSZW1vdmVkIGRvdGVudiBcdTIwMTQgbm90IG5lZWRlZCBvbiBWZXJjZWxcclxuXHJcbmNvbnN0IGRpc2FibGVIbXIgPSBwcm9jZXNzLmVudi5ESVNBQkxFX0hNUiA9PT0gJzEnXHJcblxyXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBkZWZpbmU6IHtcclxuICAgIGdsb2JhbDogJ3dpbmRvdycsXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgbWtjZXJ0KCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcclxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5pY29cIiwgXCJyb2JvdHMudHh0XCIsIFwiYXBwbGUtdG91Y2gtaWNvbi5wbmdcIl0sXHJcbiAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICBlbmFibGVkOiBmYWxzZVxyXG4gICAgICB9LFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6IFwiVHJvbGwgQ2l0eVwiLFxyXG4gICAgICAgIHNob3J0X25hbWU6IFwiVHJvbGxDaXR5XCIsXHJcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9tb2JpbGVcIixcclxuICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjMDUwMTBhXCIsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzZhMDBmZlwiLFxyXG4gICAgICAgIG9yaWVudGF0aW9uOiBcInBvcnRyYWl0XCIsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IFwiVGhlIHVsdGltYXRlIGxpdmUgc3RyZWFtaW5nICYgc29jaWFsIGNvaW4gZWNvbm9teSBwbGF0Zm9ybS5cIixcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBcInNyY1wiOiBcIi9pY29ucy9pY29uLTE5Mi5wbmdcIiwgXCJzaXplc1wiOiBcIjE5MngxOTJcIiwgXCJ0eXBlXCI6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgXCJzcmNcIjogXCIvaWNvbnMvaWNvbi01MTIucG5nXCIsIFwic2l6ZXNcIjogXCI1MTJ4NTEyXCIsIFwidHlwZVwiOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IFwic3JjXCI6IFwiL2ljb25zL2ljb24tNTEyLW1hc2thYmxlLnBuZ1wiLCBcInNpemVzXCI6IFwiNTEyeDUxMlwiLCBcInR5cGVcIjogXCJpbWFnZS9wbmdcIiwgXCJwdXJwb3NlXCI6IFwibWFza2FibGVcIiB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICAvLyBVc2UgaW5qZWN0TWFuaWZlc3Qgc28gd2Ugc2hpcCBhIGxvY2FsLCBhdWRpdGVkIHNlcnZpY2Ugd29ya2VyIHJhdGhlclxyXG4gICAgICAvLyB0aGFuIHJlbHlpbmcgb24gQ0ROIGltcG9ydFNjcmlwdHMuIFRoZSBjdXN0b20gc3cgYXQgYHNyYy9zZXJ2aWNlLXdvcmtlci50c2BcclxuICAgICAgLy8gaW1wbGVtZW50cyBwdXNoLCBvZmZsaW5lIGZhbGxiYWNrIGFuZCBzYWZlIG5hdmlnYXRpb24gaGFuZGxpbmcuXHJcbiAgICAgIGluamVjdFJlZ2lzdGVyOiAnYXV0bycsXHJcbiAgICAgIHN0cmF0ZWdpZXM6ICdpbmplY3RNYW5pZmVzdCcsXHJcbiAgICAgIHNyY0RpcjogJ3NyYycsXHJcbiAgICAgIGZpbGVuYW1lOiAnc2VydmljZS13b3JrZXIudHMnLFxyXG4gICAgICBpbmplY3RNYW5pZmVzdDoge1xyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Z30nXSxcclxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMTAwMDAwMDAsXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgICAgY2xpZW50c0NsYWltOiB0cnVlLFxyXG4gICAgICAgIHNraXBXYWl0aW5nOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICBiYXNlOiAnLycsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiB0cnVlLFxyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIHN0cmljdFBvcnQ6IGZhbHNlLFxyXG4gICAgaG1yOiBkaXNhYmxlSG1yID8gZmFsc2UgOiB7IG92ZXJsYXk6IGZhbHNlIH0sXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6IGBodHRwOi8vbG9jYWxob3N0OiR7cHJvY2Vzcy5lbnYuUE9SVCB8fCAzMDAxfWAsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCBfcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwcm94eSBlcnJvcicsIGVycilcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIHJlcSwgX3JlcykgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU2VuZGluZyBSZXF1ZXN0IHRvIFRhcmdldDonLCByZXEubWV0aG9kLCByZXEudXJsKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcycsIChwcm94eVJlcywgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxyXG4gICAgICAgICAgICAgICdSZWNlaXZlZCBSZXNwb25zZSBmcm9tIFRhcmdldDonLFxyXG4gICAgICAgICAgICAgIHByb3h5UmVzLnN0YXR1c0NvZGUsXHJcbiAgICAgICAgICAgICAgcmVxLnVybFxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICB2ZW5kb3I6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nLCAnenVzdGFuZCddLFxyXG4gICAgICAgICAgbGl2ZWtpdDogWydsaXZla2l0LWNsaWVudCcsICdAbGl2ZWtpdC9jb21wb25lbnRzLXJlYWN0J10sXHJcbiAgICAgICAgICBzdXBhYmFzZTogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcclxuICAgICAgICAgIHVpOiBbJ2ZyYW1lci1tb3Rpb24nLCAnbHVjaWRlLXJlYWN0JywgJ3Nvbm5lciddLFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1AsU0FBUyxvQkFBb0I7QUFDalIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sbUJBQW1CO0FBQzFCLFNBQVMsZUFBZTtBQUN4QixPQUFPLFVBQVU7QUFDakIsT0FBTyxZQUFZO0FBTG5CLElBQU0sbUNBQW1DO0FBVXpDLElBQU0sYUFBYSxRQUFRLElBQUksZ0JBQWdCO0FBRy9DLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFFBQVE7QUFBQSxJQUNOLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsSUFDZCxPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSxjQUFjLHNCQUFzQjtBQUFBLE1BQ25FLFlBQVk7QUFBQSxRQUNWLFNBQVM7QUFBQSxNQUNYO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUixNQUFNO0FB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
