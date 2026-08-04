# Mai Troll Load Testing

This directory contains load testing scripts to ensure Mai Troll can handle 1000+ concurrent users safely.

## Overview

Two load testing approaches are provided:

1. **Full Browser Test** (`load-test-1000-users.mjs`) - Uses Playwright to simulate real browsers
2. **Simple HTTP Test** (`load-test-1000-simple.mjs`) - Uses Node.js HTTP requests for basic connectivity testing

## Prerequisites

### For Full Browser Test
```bash
npm install playwright
npx playwright install chromium
```

### For Simple HTTP Test
No additional dependencies required (uses Node.js built-ins)

## Running the Tests

### 1. Start the Development Server

First, ensure your dev server is running:

```bash
npm run dev
```

Wait for the server to start on `http://localhost:5173`

### 2. Run Load Tests

#### Simple HTTP Test (Recommended for quick checks)
```bash
npm run load:test-1000-simple
```

This will:
- Test 1000 concurrent HTTP requests across different pages
- Measure response times and throughput
- No database writes (safe for production-like testing)

#### Full Browser Test (More realistic but slower)
```bash
npm run load:test-1000
```

This will:
- Launch actual browser instances
- Mock Supabase calls to prevent database writes
- Test full page rendering and JavaScript execution
- Measure memory usage and WebSocket connections

## Test Scenarios

Both tests cover these key pages:

1. **Home Page** - 100 users
2. **City Registry** - 200 users
3. **Broadcast Page** - 300 users
4. **TCPS Chat** - 400 users

## Safety Features

### Database Protection
- All Supabase calls are mocked to prevent real database writes
- Mock responses return empty data arrays
- No user data is created or modified

### Resource Management
- Tests run in batches to avoid overwhelming your system
- Automatic cleanup of browser instances
- Timeout protection (60 seconds max per test)

## Interpreting Results

### Success Metrics
- **Success Rate**: >95% indicates good reliability
- **Response Time**: <2000ms average is acceptable
- **Throughput**: >50 req/sec shows good performance
- **Memory Usage**: <50MB per user is acceptable

### Example Output
```
🚀 Starting Mai Troll 1000 User Load Test (Simple)
📊 Testing backend performance without database writes

🧪 Testing Home Page with 100 users...
✅ Home Page: 98/100 requests successful (98.0%)
   ⏱️  Duration: 1250.45ms
   📈 Throughput: 79.2 req/sec
   🕐 Avg Response: 245.67ms

🎯 PERFORMANCE ASSESSMENT:
   ✅ EXCELLENT: Ready for 1000+ concurrent users
   ✅ Good request throughput
   ✅ Acceptable response times
   ✅ Scales well to 1000 users
```

## Troubleshooting

### Dev Server Not Running
```
❌ Dev server not running. Please start with: npm run dev
```
**Solution**: Start the dev server in another terminal first

### High Error Rates
- Check your internet connection
- Ensure the dev server has enough resources
- Reduce batch sizes if needed
- Check for memory issues

### Slow Performance
- Close other applications
- Ensure adequate RAM (8GB+ recommended)
- Check CPU usage during tests

## Customizing Tests

### Modifying User Counts
Edit the `testScenarios` array in the script:

```javascript
const testScenarios = [
  { endpoint: '/', users: 50, name: 'Home Page' }, // Reduced for testing
  { endpoint: '/city-registry', users: 100, name: 'City Registry' },
  // ...
];
```

### Adding New Pages
Add new scenarios to test additional endpoints:

```javascript
{ endpoint: '/new-page', users: 200, name: 'New Feature Page' }
```

### Changing Timeouts
Modify timeout values in the scripts:
- HTTP timeout: `timeout: 10000` (10 seconds)
- Overall test timeout: `setTimeout(resolve, 60000)` (60 seconds)

## Performance Optimization

Based on test results, consider these optimizations:

1. **Enable Compression**: Ensure your server compresses responses
2. **CDN Usage**: Serve static assets from a CDN
3. **Caching**: Implement proper HTTP caching headers
4. **Lazy Loading**: Load components only when needed
5. **Database Indexing**: Ensure database queries are optimized
6. **Connection Pooling**: Use connection pooling for database access

## Next Steps

After successful 1000-user testing:

1. **Scale to 10k**: Gradually increase user counts
2. **Database Load Testing**: Test with real database operations (carefully!)
3. **Real-time Features**: Test WebSocket connections under load
4. **Mobile Testing**: Test on mobile devices and networks
5. **Production Deployment**: Test on staging environment first

## Safety Notes

- Always test on development/staging environments first
- Monitor server resources during testing
- Have a rollback plan ready
- Consider rate limiting during testing
- Backup databases before any real-data testing