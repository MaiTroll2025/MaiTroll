import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function PayoutPolicy() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-cyan-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-cyan-300">
          Legal
        </p>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Creator & Payout Policy
        </h1>

        <p className="mb-6 text-xs text-slate-400">
          Last updated: May 2026
        </p>

        <h2>1. Eligibility for Payouts</h2>
        <p>
          To be eligible for payouts, you must meet all payout requirements before
          your request can be approved or paid.
        </p>

        <ul>
          <li>
            Hold enough eligible Troll Coins to qualify for one of the payout tiers.
          </li>
          <li>
            Have a verified email address on file.
          </li>
          <li>
            Complete identity verification if requested.
          </li>
          <li>
            Submit any required tax forms, such as a W-9 for eligible United States
            users or equivalent documentation for international users.
          </li>
          <li>
            Have no active account restrictions, fraud flags, unresolved payment
            disputes, or open chargebacks.
          </li>
          <li>
            Have a valid PayPal payout account or another approved payout method if
            Mai Troll makes one available.
          </li>
        </ul>

        <h2>2. Payout Request Window</h2>
        <p>
          Mai Troll payout requests are submitted through MAI Pay.
          A payout request is not automatically approved just because it is
          submitted. Each request must go through review before it can be included
          in a payout batch.
        </p>

        <p>
          If the payout window is closed, you may need to wait until the next
          available payout cycle.
          payout window to submit or process a payout request.
        </p>

        <h2>3. Payout Review and Batch Process</h2>
        <p>
          Mai Troll uses a review and batch process for payouts:
        </p>

        <ol>
          <li>
            A user submits a cashout request through MAI Pay.
          </li>
          <li>
            A payout request is created with a pending status.
          </li>
          <li>
            Authorized reviewers inspect the request for eligibility, payout
            details, coin balance, account standing, and possible fraud risk.
          </li>
          <li>
            Verified payout requests may be forwarded into a payout batch.
          </li>
          <li>
            A payout batch is created with an open status.
          </li>
          <li>
            An admin reviews the payout batch and processes the payouts through
            PayPal or marks the payout as paid manually when appropriate.
          </li>
        </ol>

        <p>
          Mai Troll may delay, reject, or require additional review for any payout
          request that appears suspicious, incomplete, inaccurate, abusive, or in
          violation of platform rules.
        </p>

        <h2>4. Payout Tiers and Conversion Rates</h2>
        <p>
          Payouts are processed according to fixed tiers. You must meet the minimum
          eligible coin balance for a tier before that tier can be requested.
        </p>

        <ul className="list-none space-y-2 pl-0">
          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-slate-200">Starter Tier:</span>
            <span>
              7,500 coins = <span className="text-green-400">$25 USD</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-amber-600">Bronze Tier:</span>
            <span>
              15,000 coins = <span className="text-green-400">$50 USD</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-slate-400">Silver Tier:</span>
            <span>
              30,000 coins = <span className="text-green-400">$150 USD</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-yellow-400">Gold Tier:</span>
            <span>
              60,000 coins = <span className="text-green-400">$300 USD</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-purple-400">Platinum Tier:</span>
            <span>
              120,000 coins = <span className="text-green-400">$600 USD</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-cyan-400">Diamond Tier:</span>
            <span>
              200,000 coins = <span className="text-green-400">$1,000 USD</span>{' '}
              <span className="text-yellow-300">manual review</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-pink-400">VIP Tier:</span>
            <span>
              400,000 coins = <span className="text-green-400">$2,000 USD</span>{' '}
              <span className="text-yellow-300">manual review</span>
            </span>
          </li>

          <li className="flex items-center gap-2">
            <span className="w-36 font-bold text-blue-300">Empire Tier:</span>
            <span>
              600,000 coins = <span className="text-green-400">$3,000 USD</span>{' '}
              <span className="text-yellow-300">manual review</span>
            </span>
          </li>
        </ul>

        <p className="mt-4 text-sm text-slate-400">
          Cashout amounts are based on eligible gift coins only. Rates, tiers,
          review rules, payout timing, and eligibility requirements may change as
          Mai Troll grows or updates its payout system.
        </p>

        <h2>5. Minimum and Maximum Payouts</h2>
        <p>
          Minimum payout: <strong>7,500 eligible Troll Coins ($25 USD)</strong>
          <br />
          Higher payout tiers, including $1,000, $2,000, and $3,000 payouts, may
          require manual review before approval.
        </p>

        <h2>6. Eligible Coins</h2>
        <p>
          Not every coin balance is automatically eligible for payout. Cashout
          amounts are based on eligible gift coins only unless Mai Troll states
          otherwise.
        </p>

        <p>
          Mai Troll may separate paid coins, gift-earned coins, promotional coins,
          Hype Coins, bonuses, credits, and other balances for review and payout
          eligibility.
        </p>

        <p>
          Mai Troll may deny or delay a payout if the requested coins came from
          suspicious activity, fake engagement, chargeback-related activity,
          platform abuse, exploit behavior, or any source that is not eligible for
          cashout.
        </p>

        <h2>7. Hype Coins</h2>
        <p>
          Hype Coins are a broadcast engagement currency and may have separate
          conversion rules before they become eligible Troll Coins. Hype Coin
          conversion may depend on platform requirements, account status, timing,
          and cashout eligibility.
        </p>

        <p>
          Converted Hype Coins may still be reviewed before a payout is approved.
        </p>

        <h2>8. Tax Obligations</h2>
        <p>
          <strong>United States users:</strong> If you receive $600 or more in
          payouts during a calendar year, Mai Troll may be required to collect tax
          information and may issue applicable tax forms.
        </p>

        <p>
          <strong>International users:</strong> You are responsible for reporting
          and paying any taxes required by your local jurisdiction. Mai Troll may
          request tax documentation when required by law, payment processors, or
          platform policy.
        </p>

        <p>
          <strong>Important:</strong> Payouts may be delayed, held, or denied if
          required tax information is missing, incomplete, inaccurate, or not
          approved.
        </p>

        <h2>9. Payout Denials</h2>
        <p>
          Payout requests may be denied for reasons including, but not limited to:
        </p>

        <ul>
          <li>Insufficient eligible Troll Coin balance.</li>
          <li>Incomplete identity verification.</li>
          <li>Missing or unapproved tax forms.</li>
          <li>Incorrect payout details.</li>
          <li>
            Active account restrictions, Troll Jail restrictions, or suspensions.
          </li>
          <li>
            Suspected fraud, fake engagement, payout abuse, or suspicious activity.
          </li>
          <li>Chargebacks, refunds, payment disputes, or processor risk flags.</li>
          <li>Violation of the Terms of Service or Safety Guidelines.</li>
          <li>
            PayPal account issues, payout account limits, or payment processor
            restrictions.
          </li>
        </ul>

        <p>
          If your payout is denied, Mai Troll may provide a reason when available.
          You may be allowed to correct the issue and request another review.
        </p>

        <h2>10. Processing Fees</h2>
        <p>
          PayPal or other payment processor fees may apply. Mai Troll may deduct
          applicable processor fees from the payout amount or require users to
          account for those fees depending on the payout method.
        </p>

        <p>
          Mai Troll does not guarantee that the amount requested will exactly match
          the final amount received after third-party payment processor fees, holds,
          reversals, or restrictions.
        </p>

        <h2>11. Payment Method</h2>
        <p>
          Payouts are primarily processed through PayPal unless Mai Troll provides
          another approved payout method. You are responsible for providing accurate
          payout information.
        </p>

        <p>
          Mai Troll is not responsible for delays, failed payments, or lost funds
          caused by incorrect payout details submitted by the user.
        </p>

        <h2>12. Payout Timeline</h2>
        <p>
Payouts are reviewed and processed on request. After admin processing, funds may arrive Within 5 Minutes, but
          timing can vary based on PayPal, payment processor review, account limits,
          holidays, weekends, or additional platform review.
        </p>

        <h2>13. Holds and Manual Review</h2>
        <p>
          Mai Troll may place a payout on hold or require manual review for larger
          payouts, suspicious activity, new accounts, unusual gifting patterns,
          refund risk, chargeback risk, or violations of platform rules.
        </p>

        <p>
          A manual review does not guarantee approval. Mai Troll may approve,
          partially approve, delay, deny, or cancel a payout depending on the review.
        </p>

        <h2>14. Disputes and Appeals</h2>
        <p>
          If you disagree with a payout denial or have questions about your payout
          status, contact support through the in-app support system. Include your
          payout request details, payout method, and any relevant documentation.
        </p>

        <h2>15. Policy Updates</h2>
        <p>
          Mai Troll may update this Creator & Payout Policy at any time. Continued
          use of Mai Troll after updates means you accept the revised payout
          policy.
        </p>
      </article>
    </LegalLayout>
  )
}