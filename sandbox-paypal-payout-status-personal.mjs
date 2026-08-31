const PAYPAL_CLIENT_ID = 'ATTXASegCMPothUW1A2VccnHJU4Zc98WI3J-00URaOmLMTtBVPEgHloSWq4DUBl0PQJvqpfOE1DP33nb';
const PAYPAL_CLIENT_SECRET = 'EDqLvHafU-yOyDYbcd4upLSoxerqzQjcVpfjUquRYeRqAg9aNf8x3wfXGQ9ockWCjEoVlJbl-FWjBlSd';
const recipient = 'sb-p6gci46803526@personal.example.com';

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.access_token) {
    throw new Error(`No access token returned: ${text}`);
  }

  return data.access_token;
}

async function createPayout(token) {
  const payload = {
    sender_batch_header: {
      sender_batch_id: `payout_personal_${Date.now()}`,
      email_subject: 'You have a payout from Mai Troll!',
      email_message: 'You have received a payout for your Mai Troll earnings.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: '10.00',
          currency: 'USD',
        },
        note: 'Mai Troll payout sandbox test',
        sender_item_id: `personal_${Date.now()}`,
        receiver: recipient,
        notification_language: 'en-US',
      },
    ],
  };

  const res = await fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('create payout status:', res.status);
  console.log(text);

  if (!res.ok) {
    throw new Error(`Payout creation failed: ${text}`);
  }

  const data = JSON.parse(text);
  return data.batch_header?.payout_batch_id || null;
}

async function pollStatus(token, batchId) {
  const res = await fetch(`https://api-m.sandbox.paypal.com/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  console.log('status lookup status:', res.status);
  console.log(text);
}

async function main() {
  const token = await getAccessToken();
  const batchId = await createPayout(token);
  if (batchId) {
    console.log('batch id:', batchId);
    await pollStatus(token, batchId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
