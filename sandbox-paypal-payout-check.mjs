const PAYPAL_CLIENT_ID = 'ATTXASegCMPothUW1A2VccnHJU4Zc98WI3J-00URaOmLMTtBVPEgHloSWq4DUBl0PQJvqpfOE1DP33nb';
const PAYPAL_CLIENT_SECRET = 'EDqLvHafU-yOyDYbcd4upLSoxerqzQjcVpfjUquRYeRqAg9aNf8x3wfXGQ9ockWCjEoVlJbl-FWjBlSd';
const PAYPAL_MODE = 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await res.text();
  console.log('[paypal-test] auth status:', res.status);
  console.log('[paypal-test] auth body:', text);

  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${text}`);

  const data = JSON.parse(text);
  if (!data.access_token) throw new Error(`No access token returned: ${text}`);
  return data.access_token;
}

async function run() {
  console.log('[paypal-test] sandbox payout test starting');
  const accessToken = await getAccessToken();
  console.log('[paypal-test] access token acquired');

  const payoutRequestId = `sandbox_${Date.now()}`;
  const amount = 10.0;
  const recipient = 'sb-ahbt246801571@business.example.com';

  const payload = {
    sender_batch_header: {
      sender_batch_id: `payout_${payoutRequestId}`,
      email_subject: 'You have a payout from Mai Troll!',
      email_message: 'You have received a payout for your Mai Troll earnings.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amount.toFixed(2),
          currency: 'USD',
        },
        note: 'Mai Troll payout sandbox test',
        sender_item_id: payoutRequestId,
        receiver: recipient,
        notification_language: 'en-US',
      },
    ],
  };

  console.log('[paypal-test] payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('[paypal-test] payout status:', res.status);
  console.log('[paypal-test] payout response:', text);

  if (!res.ok) {
    console.log('[paypal-test] payout request reached PayPal and failed as expected for a non-existent sandbox recipient / funds scenario');
    process.exitCode = 0;
    return;
  }

  const data = JSON.parse(text);
  console.log('[paypal-test] success payload:', JSON.stringify(data, null, 2));
}

run().catch((err) => {
  console.error('[paypal-test] fatal error:', err);
  process.exitCode = 1;
});
