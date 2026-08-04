# Backend URL Configuration - Dev & Production

## Status ✅

Environment variables have been configured for both development and production:

### Development (.env & .env.local)
```
VITE_BACKEND_URL=http://localhost:3001
```

### Production (.env.production)
```
VITE_BACKEND_URL=https://maiMai Troll.com
```

---

## How It Works

### Frontend (React/Vite)
The frontend automatically uses the correct backend URL based on the environment:

```javascript
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const response = await fetch(`${backendUrl}/api/broadcasts/start-streaming`, {
  method: 'POST',
  // ...
});
```

**Files updated:**
- `src/pages/broadcast/SetupPage.tsx` - Calls backend after stream creation
- `src/pages/broadcast/BroadcastPage.tsx` - Calls backend to stop stream

### Backend (Node.js/Express)
The backend is configured on port 3001 with CORS enabled:

```javascript
const PORT = process.env.PORT || 3001;
app.use(cors()); // Allows requests from any origin
```

**CORS is already enabled**, so both `localhost:3001` and `https://maiMai Troll.com` will work.

---

## Running the Application

### Development Mode

**Terminal 1: Start Backend**
```bash
cd Mai Troll-main
npm run dev
# ✅ Backend listening on port 3001
# ✅ Frontend configured to use http://localhost:3001
```

**Terminal 2: Frontend already served by Vite**
- Frontend: `http://localhost:5173` (or your configured port)
- Backend: `http://localhost:3001`
- Environment: `.env` and `.env.local` will be used

### Production Mode

When deployed to `https://maiMai Troll.com`:
- Frontend will automatically use `.env.production`
- All backend calls will go to `https://maiMai Troll.com/api/broadcasts/*`
- No manual URL changes needed

---

## Troubleshooting

### Issue: "Failed to load resource: net::ERR_CONNECTION_REFUSED"

**Check:**
1. Backend is running: `npm run dev` in terminal
2. Backend is listening on port 3001 (check console output)
3. Firewall allows localhost:3001 connections

**Fix:**
```bash
# Kill any process on port 3001 (if stuck)
# Windows PowerShell:
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force

# macOS/Linux:
lsof -ti:3001 | xargs kill -9

# Then restart:
npm run dev
```

### Issue: "Backend URL not found"

**Verify environment files exist:**
```bash
# Development
ls .env
ls .env.local
grep VITE_BACKEND_URL .env

# Production
ls .env.production
grep VITE_BACKEND_URL .env.production
```

### Issue: CORS errors in production

**Not applicable** - CORS is already enabled globally on the backend with `app.use(cors())`.

---

## Deployment Checklist

### Before Going to Production

- [ ] `.env.production` file exists
- [ ] `VITE_BACKEND_URL=https://maiMai Troll.com` is set
- [ ] Backend is deployed and running
- [ ] Backend is accessible from frontend at https://maiMai Troll.com/api/broadcasts/
- [ ] SSL certificate is valid (HTTPS required for WebRTC)
- [ ] CORS headers are returned by backend

### Verifying Production Deployment

```bash
# Test if backend is reachable
curl https://maiMai Troll.com/api/broadcasts/status

# Test CORS headers
curl -i https://maiMai Troll.com/api/broadcasts/status

# Should include:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

---

## Files Modified

1. `.env` - Added `VITE_BACKEND_URL=http://localhost:3001`
2. `.env.local` - Added `VITE_BACKEND_URL=http://localhost:3001`
3. `.env.production` - Created with `VITE_BACKEND_URL=https://maiMai Troll.com`

---

## Summary

✅ **Development**: Frontend → localhost:3001  
✅ **Production**: Frontend → maiMai Troll.com  
✅ **CORS**: Enabled globally on backend  
✅ **No manual URL changes needed** between environments  

The build process will automatically select the correct `.env` file based on the NODE_ENV when building.

---

**Mux Integration will now work because:**
1. Frontend can reach backend on correct URL
2. Backend initializes Mux streams
3. Database gets populated with mux_stream_id, mux_stream_key, etc.
4. Playback ID is returned to frontend for video display
