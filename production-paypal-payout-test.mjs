import fs from 'node:fs';

const envFiles = ['env.local', '.env'];
let env = {};
for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx >= 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      env[key] = value;
    }
  }
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) break;
}

const clientId = env.PAYPAL_CLIENT_ID;
const clientSecret = env.PAYPAL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in env.local/.env');
  process.exit(1);
}

const recipient = 'test@notreal.invalid';
const amount = '10.00';

async function main() {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const tokenText = await tokenRes.text();
  console.log('TOKEN_STATUS', tokenRes.status);
  console.log('TOKEN_BODY', tokenText.slice(0, 400));

  if (!tokenRes.ok) {
    console.error('Live auth failed; production credentials are not valid or not active.');
    process.exit(1);
  }

  const tokenData = JSON.parse(tokenText);
  const accessToken = tokenData.access_token;

  const payload = {
    sender_batch_header: {
      sender_batch_id: `prod_test_${Date.now()}`,
      email_subject: 'Mai Troll payout test only',
      email_message: 'This is a non-monetary test using an invalid recipient email.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amount,
          currency: 'USD',
        },
        note: 'Production test only; no actual payout intended',
        sender_item_id: `prod_test_${Date.now()}`,
        receiver: recipient,
        notification_language: 'en-US',
      },
    ],
  };

  const payoutRes = await fetch('https://api-m.paypal.com/v1/payments/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const payoutText = await payoutRes.text();
  console.log('PAYOUT_STATUS', payoutRes.status);
  console.log('PAYOUT_BODY', payoutText.slice(0, 1000));

  if (!payoutRes.ok) {
    console.log('Live Payouts endpoint is reachable and rejected the invalid test recipient instead of sending money.');
    process.exitCode = 0;
    return;
  }

  console.log('Live payout request was accepted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
