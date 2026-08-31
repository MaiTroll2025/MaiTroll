const PAYPAL_CLIENT_ID = 'ATTXASegCMPothUW1A2VccnHJU4Zc98WI3J-00URaOmLMTtBVPEgHloSWq4DUBl0PQJvqpfOE1DP33nb';
const PAYPAL_CLIENT_SECRET = 'EDqLvHafU-yOyDYbcd4upLSoxerqzQjcVpfjUquRYeRqAg9aNf8x3wfXGQ9ockWCjEoVlJbl-FWjBlSd';
const batchId = 'JXSQWUCHGQGB2';

async function main() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error('token status', tokenRes.status);
    console.error(tokenText);
    process.exit(1);
  }

  const tokenData = JSON.parse(tokenText);
  const accessToken = tokenData.access_token;

  const res = await fetch(`https://api-m.sandbox.paypal.com/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  console.log('status', res.status);
  console.log(text);

  if (!res.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
