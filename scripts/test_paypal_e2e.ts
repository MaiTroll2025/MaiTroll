import 'dotenv/config';
import process from 'node:process';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const baseUrl = process.env.PAYPAL_E2E_BASE_URL || (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1` : 'http://127.0.0.1:54321/functions/v1');
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function request(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { response, json };
}

async function run() {
  console.log('Running PayPal smoke test...');

  const create = await request('/create-paypal-order', {
    userId: '00000000-0000-0000-0000-000000000001',
    coins: 2500,
    amountUsd: 24.99,
    packageId: 'sim-pack',
    packageName: 'Simulation Pack',
    purchaseType: 'coins',
    simulationMode: true,
  });

  console.log('create-paypal-order ->', create.response.status, JSON.stringify(create.json));

  const verify = await request('/verify-paypal-payment', {
    paypalOrderId: (create.json as any)?.orderId ?? 'sim_order_test',
    expectedAmount: 24.99,
    userId: '00000000-0000-0000-0000-000000000001',
    packageId: 'sim-pack',
    coins: 2500,
    purchaseType: 'coins',
    simulationMode: true,
  });

  console.log('verify-paypal-payment ->', verify.response.status, JSON.stringify(verify.json));

  const payout = await request('/paypal-payout', {
    payoutRequestId: '00000000-0000-0000-0000-000000000010',
    adminId: '00000000-0000-0000-0000-000000000999',
    force: true,
    simulationMode: true,
  });

  console.log('paypal-payout ->', payout.response.status, JSON.stringify(payout.json));

  const passed = create.response.ok && verify.response.ok && payout.response.ok;
  if (!passed) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('PayPal smoke test failed:', error);
  process.exit(1);
});
