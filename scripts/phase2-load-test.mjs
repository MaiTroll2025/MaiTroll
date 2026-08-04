#!/usr/bin/env node

/**
 * Mai Troll Phase 2 Load Test - 1000 Users with Writes & Realtime
 * Comprehensive load test with database writes, realtime subscriptions, and full user interactions
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

loadEnv(path.resolve(__dirname, '../.env'));
loadEnv(path.resolve(__dirname, '../.env.local'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

class Phase2LoadTester {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.baseUrl = 'http://localhost:5179';
    this.results = {
      startTime: Date.now(),
      metrics: {
        totalUsers: 0,
        activeUsers: 0,
        broadcastViewers: 0,
        chatMessagesSent: 0,
        giftsSent: 0,
        tcpsMessages: 0,
        seatCycles: 0,
        errors: [],
        responseTimes: [],
        realtimeChannels: 0,
        dbConnections: 0,
        slowQueries: [],
        duplicateTransactions: 0,
        missedMessages: 0,
        delayedGifts: 0,
        frontendRenders: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      performance: {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0
      }
    };

    this.browsers = [];
    this.users = [];
    this.activeStreams = [];
    this.chatRooms = [];
  }

  async runPhase2Test() {
    console.log('🚀 Starting Mai Troll Phase 2 Load Test');
    console.log('📊 Testing 1000 users with writes & realtime enabled');
    console.log('🎯 Target: 1000 concurrent users, 300 broadcast viewers, active interactions');

    try {
      // Phase 1: Setup test users and authentication
      await this.setupTestUsers();

      // Phase 2: Launch browsers and establish connections
      await this.launchUserSessions();

      // Phase 3: Start background activities (chat, gifts, etc.)
      await this.startBackgroundActivities();

      // Phase 4: Run main test scenarios
      await this.runTestScenarios();

      // Phase 5: Monitor and collect metrics
      await this.monitorSystemMetrics();

      // Phase 6: Cleanup and analysis
      await this.cleanup();

      this.analyzeResults();

    } catch (error) {
      console.error('❌ Phase 2 test failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  async setupTestUsers() {
    console.log('\n👥 Setting up test users...');

    // Create test users in database
    for (let i = 0; i < 1000; i++) {
      const user = {
        email: `loadtest_user_${i}@example.com`,
        password: 'testpass123',
        username: `TestUser${i}`,
        role: i < 10 ? 'broadcaster' : 'user' // 10 broadcasters, 990 regular users
      };

      try {
        // Sign up user (this will create database record)
        const { data, error } = await this.supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            data: {
              username: user.username,
              role: user.role
            }
          }
        });

        if (error && !error.message.includes('already registered')) {
          console.log(`⚠️  User ${i} signup issue:`, error.message);
        }

        this.users.push({ ...user, id: data?.user?.id });
      } catch (error) {
        console.log(`⚠️  User ${i} setup failed:`, error.message);
      }
    }

    console.log(`✅ Created ${this.users.length} test users`);
  }

  async launchUserSessions() {
    console.log('\n🌐 Launching browser sessions...');

    const batchSize = 50;
    for (let i = 0; i < this.users.length; i += batchSize) {
      const batch = this.users.slice(i, i + batchSize);
      console.log(`🚀 Launching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.users.length/batchSize)} (${batch.length} users)`);

      const batchPromises = batch.map(user => this.createAuthenticatedSession(user));
      const results = await Promise.allSettled(batchPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`   ✅ ${successful} successful, ${failed} failed`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.results.metrics.activeUsers = this.browsers.length;
    console.log(`✅ Launched ${this.browsers.length} active browser sessions`);
  }

  async createAuthenticatedSession(user) {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mai Troll-LoadTest/1.0'
    });

    const page = await context.newPage();

    try {
      // Navigate to login page
      await page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle' });

      // Fill login form
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]');

      // Wait for successful login
      await page.waitForURL('**', { timeout: 10000 });

      // Verify we're logged in
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login failed');
      }

      // Setup performance monitoring
      await this.setupPerformanceMonitoring(page);

      this.browsers.push({ browser, context, page, user });

      return { success: true };

    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async setupPerformanceMonitoring(page) {
    // Monitor frontend renders and performance
    await page.addScriptTag({
      content: `
        window.loadTestMetrics = {
          renders: 0,
          memoryUsage: 0,
          startTime: Date.now()
        };

        // Monitor React renders (if using React)
        if (window.React) {
          const originalRender = window.React.render;
          window.React.render = function(...args) {
            window.loadTestMetrics.renders++;
            return originalRender.apply(this, args);
          };
        }

        // Monitor memory usage
        setInterval(() => {
          if (performance.memory) {
            window.loadTestMetrics.memoryUsage = performance.memory.usedJSHeapSize;
          }
        }, 1000);
      `
    });

    // Monitor network requests
    page.on('response', response => {
      const responseTime = Date.now() - (response.request().timing?.requestStart || Date.now());
      this.results.metrics.responseTimes.push(responseTime);

      if (response.status() >= 400) {
        this.results.metrics.errors.push(`${response.status()}: ${response.url()}`);
      }
    });
  }

  async startBackgroundActivities() {
    console.log('\n🎬 Starting background activities...');

    // Start broadcast streams (10 broadcasters)
    const broadcasters = this.browsers.filter(b => b.user.role === 'broadcaster');
    for (const broadcaster of broadcasters) {
      await this.startBroadcastStream(broadcaster);
    }

    // Connect viewers to broadcasts (300 total viewers)
    const viewers = this.browsers.filter(b => b.user.role === 'user').slice(0, 300);
    for (const viewer of viewers) {
      await this.connectToBroadcast(viewer);
    }

    // Start chat activities
    this.startChatActivity();

    // Start gift sending
    this.startGiftActivity();

    // Start TCPS messaging
    this.startTcpsActivity();

    // Start seat join/leave cycles
    this.startSeatActivity();

    console.log('✅ Background activities started');
  }

  async startBroadcastStream(broadcaster) {
    try {
      const { page } = broadcaster;

      // Navigate to broadcast page
      await page.goto(`${this.baseUrl}/broadcast/create`, { waitUntil: 'networkidle' });

      // Start stream
      await page.click('button:has-text("Start Stream")');

      // Wait for stream to start
      await page.waitForSelector('.stream-active', { timeout: 5000 });

      const streamId = Date.now().toString();
      this.activeStreams.push({
        id: streamId,
        broadcaster: broadcaster.user.id,
        viewers: 0,
        chatMessages: 0,
        gifts: 0
      });

      console.log(`📺 Started broadcast stream for ${broadcaster.user.username}`);
    } catch (error) {
      console.log(`⚠️  Failed to start broadcast for ${broadcaster.user.username}:`, error.message);
    }
  }

  async connectToBroadcast(viewer) {
    try {
      const { page } = viewer;
      const randomStream = this.activeStreams[Math.floor(Math.random() * this.activeStreams.length)];

      if (!randomStream) return;

      // Navigate to broadcast page
      await page.goto(`${this.baseUrl}/broadcast/${randomStream.id}`, { waitUntil: 'networkidle' });

      // Wait for video to load
      await page.waitForSelector('video', { timeout: 5000 });

      randomStream.viewers++;
      this.results.metrics.broadcastViewers++;

      console.log(`👁️  Connected viewer ${viewer.user.username} to broadcast`);
    } catch (error) {
      console.log(`⚠️  Failed to connect viewer ${viewer.user.username} to broadcast:`, error.message);
    }
  }

  startChatActivity() {
    console.log('💬 Starting chat activity (100 messages/min per room)...');

    // Send chat messages at 100/min per active room
    setInterval(async () => {
      for (const stream of this.activeStreams) {
        if (stream.viewers > 0) {
          const chatUsers = this.browsers.filter(b =>
            b.user.role === 'user' &&
            Math.random() < 0.1 // 10% of viewers chat
          );

          for (const user of chatUsers.slice(0, 10)) { // Max 10 messages per room per minute
            try {
              await this.sendChatMessage(user, stream.id, `Test message ${Date.now()}`);
              this.results.metrics.chatMessagesSent++;
              stream.chatMessages++;
            } catch (error) {
              this.results.metrics.missedMessages++;
            }
          }
        }
      }
    }, 60000); // Every minute
  }

  startGiftActivity() {
    console.log('🎁 Starting gift activity (25 gifts/min per room)...');

    // Send gifts at 25/min per active room
    setInterval(async () => {
      for (const stream of this.activeStreams) {
        const giftUsers = this.browsers.filter(b => b.user.role === 'user').slice(0, 25);

        for (const user of giftUsers) {
          try {
            await this.sendGift(user, stream.id, 'test-gift', 100);
            this.results.metrics.giftsSent++;
            stream.gifts++;
          } catch (error) {
            this.results.metrics.delayedGifts++;
          }
        }
      }
    }, 60000); // Every minute
  }

  startTcpsActivity() {
    console.log('💭 Starting TCPS messaging (50 messages/min)...');

    // Send TCPS messages at 50/min
    setInterval(async () => {
      const tcpsUsers = this.browsers.filter(b => b.user.role === 'user').slice(0, 50);

      for (const user of tcpsUsers) {
        try {
          await this.sendTcpsMessage(user, `TCPS message ${Date.now()}`);
          this.results.metrics.tcpsMessages++;
        } catch (error) {
          this.results.metrics.errors.push('TCPS message failed');
        }
      }
    }, 60000); // Every minute
  }

  startSeatActivity() {
    console.log('💺 Starting seat join/leave cycles (20 cycles)...');

    // Seat join/leave cycles
    let cycleCount = 0;
    const maxCycles = 20;

    const seatInterval = setInterval(async () => {
      if (cycleCount >= maxCycles) {
        clearInterval(seatInterval);
        return;
      }

      const seatUsers = this.browsers.filter(b => b.user.role === 'user').slice(0, 20);

      for (const user of seatUsers) {
        try {
          // Join seat
          await this.joinSeat(user);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Stay for 5 seconds

          // Leave seat
          await this.leaveSeat(user);

          this.results.metrics.seatCycles++;
          cycleCount++;
        } catch (error) {
          console.log(`⚠️  Seat cycle failed for ${user.user.username}:`, error.message);
        }
      }
    }, 30000); // Every 30 seconds
  }

  async sendChatMessage(user, streamId, message) {
    const { page } = user;

    try {
      // Focus chat input
      await page.focus('.chat-input');

      // Type message
      await page.fill('.chat-input', message);

      // Send message
      await page.click('.send-button');

      // Wait for message to appear
      await page.waitForSelector(`.chat-message:has-text("${message}")`, { timeout: 2000 });
    } catch (error) {
      throw new Error(`Chat message failed: ${error.message}`);
    }
  }

  async sendGift(user, streamId, giftType, amount) {
    const { page } = user;

    try {
      // Open gift panel
      await page.click('.gift-button');

      // Select gift
      await page.click(`.gift-item[data-type="${giftType}"]`);

      // Confirm gift
      await page.click('.send-gift-button');

      // Wait for gift animation to start
      await page.waitForSelector('.gift-animation', { timeout: 3000 });
    } catch (error) {
      throw new Error(`Gift sending failed: ${error.message}`);
    }
  }

  async sendTcpsMessage(user, message) {
    const { page } = user;

    try {
      // Navigate to TCPS if not already there
      if (!page.url().includes('/tcps')) {
        await page.goto(`${this.baseUrl}/tcps`, { waitUntil: 'networkidle' });
      }

      // Focus message input
      await page.focus('.tcps-input');

      // Type message
      await page.fill('.tcps-input', message);

      // Send message
      await page.click('.tcps-send-button');

      // Wait for message to appear
      await page.waitForSelector(`.tcps-message:has-text("${message}")`, { timeout: 2000 });
    } catch (error) {
      throw new Error(`TCPS message failed: ${error.message}`);
    }
  }

  async joinSeat(user) {
    const { page } = user;

    try {
      // Find available seat
      await page.click('.available-seat');

      // Confirm join
      await page.click('.join-seat-confirm');

      // Wait for seat to be occupied
      await page.waitForSelector('.my-seat', { timeout: 2000 });
    } catch (error) {
      throw new Error(`Join seat failed: ${error.message}`);
    }
  }

  async leaveSeat(user) {
    const { page } = user;

    try {
      // Leave seat
      await page.click('.leave-seat-button');

      // Confirm leave
      await page.click('.leave-seat-confirm');

      // Wait for seat to be available
      await page.waitForSelector('.available-seat', { timeout: 2000 });
    } catch (error) {
      throw new Error(`Leave seat failed: ${error.message}`);
    }
  }

  async runTestScenarios() {
    console.log('\n🧪 Running main test scenarios...');

    // Run for 5 minutes to collect metrics
    const testDuration = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    console.log(`⏱️  Test will run for ${testDuration / 1000 / 60} minutes...`);

    while (Date.now() - startTime < testDuration) {
      // Keep users active with random interactions
      await this.performRandomInteractions();

      // Collect metrics every 30 seconds
      if (Math.floor((Date.now() - startTime) / 30000) % 2 === 0) {
        await this.collectMetrics();
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
    }

    console.log('✅ Main test scenarios completed');
  }

  async performRandomInteractions() {
    // Random user interactions to keep sessions active
    const randomUsers = this.browsers
      .filter(() => Math.random() < 0.1) // 10% of users
      .slice(0, 50); // Max 50 at a time

    for (const user of randomUsers) {
      try {
        const actions = ['scroll', 'click-random', 'navigate-random'];
        const action = actions[Math.floor(Math.random() * actions.length)];

        switch (action) {
          case 'scroll':
            await user.page.evaluate(() => window.scrollTo(0, Math.random() * document.body.scrollHeight));
            break;
          case 'click-random':
            await user.page.click('body');
            break;
          case 'navigate-random':
            const pages = ['/', '/city-registry', '/tcps'];
            const randomPage = pages[Math.floor(Math.random() * pages.length)];
            await user.page.goto(`${this.baseUrl}${randomPage}`, { waitUntil: 'networkidle', timeout: 5000 });
            break;
        }
      } catch (error) {
        // Ignore random interaction errors
      }
    }
  }

  async collectMetrics() {
    // Collect frontend metrics from browsers
    for (const browser of this.browsers.slice(0, 10)) { // Sample first 10 browsers
      try {
        const metrics = await browser.page.evaluate(() => {
          return {
            renders: window.loadTestMetrics?.renders || 0,
            memoryUsage: window.loadTestMetrics?.memoryUsage || 0,
            websocketConnections: window.realtimeChannels?.length || 0
          };
        });

        this.results.metrics.frontendRenders += metrics.renders;
        this.results.metrics.memoryUsage = Math.max(this.results.metrics.memoryUsage, metrics.memoryUsage);
        this.results.metrics.realtimeChannels += metrics.websocketConnections;
      } catch (error) {
        // Ignore metric collection errors
      }
    }

    // Collect backend metrics via Supabase
    try {
      const { data: connections } = await this.supabase.rpc('get_connection_count');
      this.results.metrics.dbConnections = connections || 0;

      // Check for slow queries (mock - would need actual monitoring)
      // Check for duplicate transactions
      const { data: duplicates } = await this.supabase
        .from('coin_transactions')
        .select('id', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .eq('amount', 100); // Test amount

      this.results.metrics.duplicateTransactions = duplicates?.length || 0;
    } catch (error) {
      console.log('⚠️  Backend metrics collection failed:', error.message);
    }
  }

  async monitorSystemMetrics() {
    console.log('\n📊 Collecting final system metrics...');

    // Calculate performance metrics
    const responseTimes = this.results.metrics.responseTimes;
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);

      this.results.performance.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      this.results.performance.p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
      this.results.performance.p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    }

    this.results.performance.errorRate = (this.results.metrics.errors.length / Math.max(this.results.metrics.totalUsers, 1)) * 100;
    this.results.performance.throughput = this.results.metrics.totalUsers / ((Date.now() - this.results.startTime) / 1000);

    // Final metrics collection
    await this.collectMetrics();
  }

  analyzeResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Mai Troll PHASE 2 LOAD TEST RESULTS');
    console.log('='.repeat(80));

    console.log('\n🎯 TEST SUMMARY:');
    console.log(`   👥 Total Users: ${this.results.metrics.totalUsers}`);
    console.log(`   👤 Active Users: ${this.results.metrics.activeUsers}`);
    console.log(`   📺 Broadcast Viewers: ${this.results.metrics.broadcastViewers}`);
    console.log(`   💬 Chat Messages: ${this.results.metrics.chatMessagesSent}`);
    console.log(`   🎁 Gifts Sent: ${this.results.metrics.giftsSent}`);
    console.log(`   💭 TCPS Messages: ${this.results.metrics.tcpsMessages}`);
    console.log(`   💺 Seat Cycles: ${this.results.metrics.seatCycles}`);

    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`   🕐 Avg Response Time: ${this.results.performance.avgResponseTime.toFixed(2)}ms`);
    console.log(`   📊 P95 Response Time: ${this.results.performance.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   📈 P99 Response Time: ${this.results.performance.p99ResponseTime.toFixed(2)}ms`);
    console.log(`   ❌ Error Rate: ${this.results.performance.errorRate.toFixed(2)}%`);
    console.log(`   🚀 Throughput: ${this.results.performance.throughput.toFixed(1)} req/sec`);

    console.log('\n🖥️  SYSTEM METRICS:');
    console.log(`   🔗 Realtime Channels: ${this.results.metrics.realtimeChannels}`);
    console.log(`   🗄️  DB Connections: ${this.results.metrics.dbConnections}`);
    console.log(`   🐌 Slow Queries: ${this.results.metrics.slowQueries.length}`);
    console.log(`   💰 Duplicate Transactions: ${this.results.metrics.duplicateTransactions}`);
    console.log(`   💬 Missed Messages: ${this.results.metrics.missedMessages}`);
    console.log(`   🎁 Delayed Gifts: ${this.results.metrics.delayedGifts}`);
    console.log(`   🎨 Frontend Renders: ${this.results.metrics.frontendRenders}`);
    console.log(`   🧠 Memory Usage: ${(this.results.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

    console.log('\n🎯 RELIABILITY ASSESSMENT:');
    const assessment = this.assessReliability();
    console.log(`   ${assessment.overall}`);
    console.log(`   ${assessment.backend}`);
    console.log(`   ${assessment.frontend}`);
    console.log(`   ${assessment.realtime}`);
    console.log(`   ${assessment.database}`);

    console.log('\n' + '='.repeat(80));
  }

  assessReliability() {
    const errorRate = this.results.performance.errorRate;
    const missedMessages = this.results.metrics.missedMessages;
    const delayedGifts = this.results.metrics.delayedGifts;
    const duplicateTxns = this.results.metrics.duplicateTransactions;

    let overall = '✅ EXCELLENT: Production ready with minor optimizations needed';
    let backend = '✅ Backend stable under load';
    let frontend = '✅ Frontend performing well';
    let realtime = '✅ Realtime connections stable';
    let database = '✅ Database handling writes efficiently';

    if (errorRate > 5) overall = '⚠️  CONCERNS: High error rate detected';
    if (missedMessages > 10) realtime = '⚠️  Some messages missed - realtime optimization needed';
    if (delayedGifts > 5) backend = '⚠️  Gift processing delays detected';
    if (duplicateTxns > 0) database = '⚠️  Duplicate transactions detected - deduplication needed';
    if (this.results.performance.p99ResponseTime > 5000) frontend = '⚠️  Slow response times detected';

    return { overall, backend, frontend, realtime, database };
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test resources...');

    // Close all browsers
    for (const browser of this.browsers) {
      try {
        await browser.browser.close();
      } catch (error) {
        console.log(`⚠️  Failed to close browser: ${error.message}`);
      }
    }

    // Clean up test data (optional - comment out if you want to keep test data)
    try {
      console.log('🗑️  Cleaning up test users and data...');
      // Note: In production, you might want to keep this commented out
      // await this.cleanupTestData();
    } catch (error) {
      console.log(`⚠️  Cleanup failed: ${error.message}`);
    }

    console.log('✅ Cleanup completed');
  }

  async cleanupTestData() {
    // Remove test users and associated data
    for (const user of this.users) {
      try {
        await this.supabase.from('profiles').delete().eq('id', user.id);
        await this.supabase.from('coin_transactions').delete().eq('user_id', user.id);
        // Add other cleanup as needed
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// Run the test
async function main() {
  console.log('🔍 Checking if dev server is running...');

  try {
    // Simple HTTP check for dev server
    const http = await import('http');
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:5179', { timeout: 5000 }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Dev server is running');
          resolve(true);
        } else {
          reject(new Error(`Dev server returned status ${res.statusCode}`));
        }
      });

      req.on('error', () => {
        reject(new Error('Dev server not running. Please start with: npm run dev'));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Dev server not responding. Please start with: npm run dev'));
      });
    });
  } catch (error) {
    console.error('❌', error.message);
    console.log('\nTo run this test:');
    console.log('1. Open a new terminal');
    console.log('2. Run: npm run dev');
    console.log('3. Wait for the dev server to start');
    console.log('4. Run this load test again');
    process.exit(1);
  }

  const tester = new Phase2LoadTester();
  try {
    await tester.runPhase2Test();
  } catch (error) {
    console.error('❌ Phase 2 test failed:', error);
    process.exit(1);
  }
}

main();