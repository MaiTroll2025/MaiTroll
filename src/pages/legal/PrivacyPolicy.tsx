import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function PrivacyPolicy() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-purple-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-purple-300">
          Legal
        </p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Last updated: January 2026
        </p>

        <p>
          <strong>Mai Troll</strong> (also referred to as "<strong>MaiMaiTroll</strong>") is a social streaming platform. This Privacy Policy explains how we collect, use, and protect your information when you use our app and services.
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, such as when you create an account, verify your identity,
          request payouts, or contact support. This includes:
        </p>
        <ul>
          <li><strong>Account Information:</strong> Username, email address, date of birth, and profile content.</li>
          <li><strong>Identity Verification:</strong> Legal name, address, tax ID (last 4 digits), and government ID (if required for payouts).</li>
          <li><strong>Payment Information:</strong> Transaction history and payout details (processed securely).</li>
          <li><strong>User Content:</strong> Streaming content, chat messages, and interactions.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use your information to operate and improve Mai Troll, including:
        </p>
        <ul>
          <li>Processing transactions and payouts.</li>
          <li>Verifying your identity and age (compliance).</li>
          <li>Providing customer support and moderation.</li>
          <li>Detecting fraud, abuse, and security incidents.</li>
          <li>Complying with legal obligations (e.g., tax reporting).</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>
          We do not sell your personal data. We share information only in the following circumstances:
        </p>
        <ul>
          <li><strong>Service Providers:</strong> With partners who help us provide services (e.g., payment processors, hosting).</li>
          <li><strong>Legal Requirements:</strong> If required by law, subpoena, or legal process.</li>
          <li><strong>Safety:</strong> To protect the rights, property, or safety of Mai Troll, our users, or others.</li>
        </ul>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.
          You are responsible for keeping your account credentials confidential.
        </p>

        <h2>5. Your Rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, or delete your personal information.
          You can manage most of your data in your Profile Settings. For other requests, contact support.
        </p>

        <h2>6. Children&apos;s Privacy</h2>
        <p>
          Mai Troll is not intended for children under 13. We do not knowingly collect data from children under 13.
          If we learn we have collected such data, we will delete it. Users must be at least 18 to monetize or use paid features.
        </p>

        <h2>7. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy here.
        </p>

        <h2>8. Contact Information</h2>
        <p>
          This app is operated by MaiMaiTroll. For privacy-related questions, please contact support through the app.
        </p>
      </article>
    </LegalLayout>
  )
}
