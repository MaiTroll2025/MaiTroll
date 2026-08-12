const privacyPolicyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - MaiTroll</title>
  <link rel="canonical" href="https://www.maitroll.com/legal/privacy">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #e0e0e0; background: #05010a; }
    h1 { color: #f8f8f2; border-bottom: 1px solid #2c2c2c; padding-bottom: 10px; }
    h2 { color: #f8f8f2; margin-top: 30px; }
    p, li { color: #a0a0a0; }
    a { color: #8e44ad; }
    .header { text-align: center; margin-bottom: 30px; }
    .last-updated { color: #666; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Privacy Policy</h1>
    <p class="last-updated">Last updated: January 2026</p>
  </div>

  <p><strong>MaiTroll</strong> (also referred to as "<strong>MaiMaiTroll</strong>") is a social streaming platform. This Privacy Policy explains how we collect, use, and protect your information when you use our app and services.</p>

  <h2>1. Information We Collect</h2>
  <p>We collect information you provide directly to us, such as when you create an account, verify your identity, request payouts, or contact support. This includes:</p>
  <ul>
    <li><strong>Account Information:</strong> Username, email address, date of birth, and profile content.</li>
    <li><strong>Identity Verification:</strong> Legal name, address, tax ID (last 4 digits), and government ID (if required for payouts).</li>
    <li><strong>Payment Information:</strong> Transaction history and payout details (processed securely).</li>
    <li><strong>User Content:</strong> Streaming content, chat messages, and interactions.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <p>We use your information to operate and improve Mai Troll, including:</p>
  <ul>
    <li>Processing transactions and payouts.</li>
    <li>Verifying your identity and age (compliance).</li>
    <li>Providing customer support and moderation.</li>
    <li>Detecting fraud, abuse, and security incidents.</li>
    <li>Complying with legal obligations (e.g., tax reporting).</li>
  </ul>

  <h2>3. Information Sharing</h2>
  <p>We do not sell your personal data. We share information only in the following circumstances:</p>
  <ul>
    <li><strong>Service Providers:</strong> With partners who help us provide services (e.g., payment processors, hosting).</li>
    <li><strong>Legal Requirements:</strong> If required by law, subpoena, or legal process.</li>
    <li><strong>Safety:</strong> To protect the rights, property, or safety of Mai Troll, our users, or others.</li>
  </ul>

  <h2>4. Data Security</h2>
  <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure. You are responsible for keeping your account credentials confidential.</p>

  <h2>5. Your Rights</h2>
  <p>Depending on your location, you may have rights to access, correct, or delete your personal information. You can manage most of your data in your Profile Settings. For other requests, contact support.</p>

  <h2>6. Children's Privacy</h2>
  <p>Mai Troll is not intended for children under 13. We do not knowingly collect data from children under 13. If we learn we have collected such data, we will delete it. Users must be at least 18 to monetize or use paid features.</p>

  <h2>7. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy here.</p>

  <h2>8. Contact Information</h2>
  <p>This app is operated by MaiTroll. For privacy-related questions, please contact support through the app.</p>
</body>
</html>`;

const termsOfServiceHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - MaiTroll</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #e0e0e0; background: #05010a; }
    h1 { color: #f8f8f2; border-bottom: 1px solid #2c2c2c; padding-bottom: 10px; }
    h2 { color: #f8f8f2; margin-top: 30px; }
    p, li { color: #a0a0a0; }
    a { color: #8e44ad; }
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="last-updated">Last updated: January 2026</p>
  <p>By accessing or using MaiTroll ("the App"), you agree to be bound by these Terms of Service.</p>
  <h2>1. Acceptance of Terms</h2>
  <p>These terms constitute a binding agreement between you and MaiTroll. If you do not agree to these terms, do not use the App.</p>
  <h2>2. License Grant</h2>
  <p>We grant you a limited, non-exclusive, non-transferable license to use MaiTroll for personal, non-commercial purposes.</p>
  <h2>3. User Responsibilities</h2>
  <ul>
    <li>You must be at least 18 years old to use this app.</li>
    <li>You are responsible for your account and content you post.</li>
    <li>You will not engage in harassment, abuse, or illegal activity.</li>
  </ul>
  <h2>4. Content Ownership</h2>
  <p>You retain ownership of content you create. By posting, you grant MaiTroll a license to display and distribute your content within the platform.</p>
  <h2>5. Termination</h2>
  <p>We may terminate or suspend your account for violation of these terms.</p>
  <p><em>MaiTroll is operated by MaiTroll. These terms are governed by the laws of [Jurisdiction].</em></p>
</body>
</html>`;

export const runtime = 'edge';

export async function GET({ params }: { params: { slug: string[] } }) {
  const { slug } = params;
  const slugStr = slug.join('/').toLowerCase();

  let html = privacyPolicyHTML;
  let title = 'Privacy Policy';

  if (slugStr === 'terms' || slugStr === 'terms-of-service') {
    html = termsOfServiceHTML;
    title = 'Terms of Service';
  }

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}