export interface MaiRecordLabelAgreementData {
  artistLegalName: string
  artistStageName: string
  maiTrollUserId: string
  artistEmail: string
  contractId: string
  contractNumber: string
  effectiveDate: string
  agreementStatus: string
  termsVersion: string
  tier: string
  artistSplitBps: number
  labelSplitBps: number
  probationEndsAt?: string | null
  expiresAt?: string | null
  artistSignedAt?: string | null
  maiAcceptedAt?: string | null
  availableCoins?: number
  pendingCoins?: number
  lifetimeArtistCoins?: number
  lifetimeGrossCoins?: number
  applicableTracks?: Array<{ id: string; title: string; albumTitle?: string | null }>
  applicableAlbums?: Array<{ id: string; title: string }>
  transactions?: Array<{
    date: string
    trackTitle: string
    albumTitle: string
    artistName: string
    grossCoins: number
    artistCoins: number
    labelCoins: number
    status: string
    transactionType: string
  }>
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m] || m)
}

export function generateMaiRecordLabelAgreement(data: MaiRecordLabelAgreementData): string {
  const artistSplitPercent = (data.artistSplitBps / 100).toFixed(0)
  const labelSplitPercent = (data.labelSplitBps / 100).toFixed(0)
  const stageName = escapeHtml(data.artistStageName)
  const legalName = escapeHtml(data.artistLegalName)
  const userId = escapeHtml(data.maiTrollUserId)
  const email = escapeHtml(data.artistEmail)
  const contractId = escapeHtml(data.contractId)
  const contractNumber = escapeHtml(data.contractNumber)
  const effectiveDate = formatDate(data.effectiveDate)
  const status = escapeHtml(data.agreementStatus)
  const termsVersion = escapeHtml(data.termsVersion)
  const tier = escapeHtml(data.tier)

  const trackRows = (data.applicableTracks || [])
    .map(
      (t) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:11px;color:#cbd5e1;">${escapeHtml(t.title)}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:11px;color:#94a3b8;">${t.albumTitle ? escapeHtml(t.albumTitle) : '—'}</td>
        </tr>
      `
    )
    .join('')

  const txRows = (data.transactions || [])
    .map(
      (tx) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#94a3b8;">${formatDate(tx.date)}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#cbd5e1;">${escapeHtml(tx.trackTitle)}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#94a3b8;">${tx.albumTitle ? escapeHtml(tx.albumTitle) : '—'}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#cbd5e1;">${escapeHtml(tx.artistName)}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#e2e8f0;text-align:right;">${(tx.grossCoins || 0).toLocaleString()}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;">${(tx.artistCoins || 0).toLocaleString()}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;">${(tx.labelCoins || 0).toLocaleString()}</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#94a3b8;">${escapeHtml(tx.status)}</td>
        </tr>
      `
    )
    .join('')

  const _availableCoins = data.availableCoins ?? 0
  const _pendingCoins = data.pendingCoins ?? 0
  const _lifetimeArtistCoins = data.lifetimeArtistCoins ?? 0
  const _lifetimeGrossCoins = data.lifetimeGrossCoins ?? 0

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MAI Record Label Artist Agreement — ${escapeHtml(data.contractNumber)}</title>
<style>
  @page {
    size: A4;
    margin: 1in;
    @top-center {
      content: "MAI CORP / MAI Record Label — Artist Agreement — ${escapeHtml(data.contractNumber)}";
      font-family: monospace;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: monospace;
      font-size: 8pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    page-break-after: always;
    padding: 40px 48px;
    max-width: 6.5in;
    margin: 0 auto;
  }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 18pt; font-weight: bold; margin: 0 0 4px 0; text-align: center; letter-spacing: 0.5px; }
  h2 { font-size: 13pt; font-weight: bold; margin: 18px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1e293b; padding-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: bold; margin: 14px 0 6px 0; }
  .subtitle { text-align: center; font-size: 10pt; color: #475569; margin-bottom: 20px; font-family: monospace; }
  .meta-box {
    border: 1px solid #cbd5e1;
    padding: 12px 16px;
    margin: 16px 0;
    background: #f8fafc;
    font-family: monospace;
    font-size: 9pt;
    line-height: 1.5;
  }
  .meta-box .label { color: #64748b; }
  .meta-box .value { color: #0f172a; font-weight: bold; }
  p { margin: 0 0 10px 0; text-align: justify; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  li { margin-bottom: 6px; }
  .section { margin-bottom: 20px; }
  .signature-block {
    margin-top: 28px;
    padding: 16px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
  }
  .signature-block h3 {
    margin-top: 0;
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #334155;
  }
  .sign-line {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #94a3b8;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sign-line span {
    font-size: 9pt;
    color: #475569;
  }
  .stamp-area {
    margin: 32px auto 0;
    width: 320px;
    height: 200px;
    border: 2px dashed #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 16px;
    background: #fefefe;
    page-break-inside: avoid;
  }
  .stamp-area-inner {
    font-family: monospace;
    font-size: 9pt;
    color: #64748b;
    line-height: 1.5;
  }
  .stamp-area-inner strong { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #f1f5f9; font-weight: bold; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 9pt; }
  td { padding: 6px 8px; border: 1px solid #cbd5e1; }
  .right { text-align: right; }
  .center { text-align: center; }
  .muted { color: #64748b; }
  .bold { font-weight: bold; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; margin: 0; max-width: none; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="page">
  <h1>MAI RECORD LABEL ARTIST AGREEMENT</h1>
  <div class="subtitle">MAI CORP / MAI Record Label — Official Artist Contract</div>

  <div class="meta-box">
    <span class="label">Contract ID: </span><span class="value">${contractId}</span><br>
    <span class="label">Contract Number: </span><span class="value">${contractNumber}</span><br>
    <span class="label">Effective Date: </span><span class="value">${effectiveDate}</span><br>
    <span class="label">Agreement Status: </span><span class="value">${status.toUpperCase()}</span><br>
    <span class="label">Terms Version: </span><span class="value">${termsVersion}</span><br>
    <span class="label">Tier: </span><span class="value">${tier.toUpperCase()}</span>
  </div>

  <div class="section">
    <h2>1. Parties</h2>
    <p>This <strong>MAI Record Label Artist Agreement</strong> ("Agreement") is entered into by and between:</p>
    <p><strong>MAI CORP</strong>, operating as <strong>MAI Record Label</strong> ("Label," "MAI CORP," or "Company"), and</p>
    <p><strong>${legalName}</strong> ("Artist"), also known by the stage/display name <strong>${stageName}</strong>, MaiTroll User ID: <strong>${userId}</strong>, Email: <strong>${email}</strong>.</p>
  </div>

  <div class="section">
    <h2>2. Recitals</h2>
    <p><strong>WHEREAS</strong>, MAI CORP operates the MaiTroll platform and the MAI Record Label program;</p>
    <p><strong>WHEREAS</strong>, the Artist is an approved, verified music creator who has submitted an application and been accepted into the MAI Record Label program;</p>
    <p><strong>WHEREAS</strong>, the parties wish to establish the terms under which the Artist's music may be distributed, promoted, and monetized through the MaiTroll platform;</p>
    <p><strong>NOW, THEREFORE</strong>, in consideration of the mutual covenants contained herein, the parties agree as follows:</p>
  </div>

  <div class="section">
    <h2>3. Definitions</h2>
    <p><strong>"Eligible Track Revenue"</strong> means gross revenue actually received by MAI CORP from the monetization of the Artist's Published Tracks on the MaiTroll platform, including but not limited to streaming-generated coin purchases, track tips, and album revenue directly attributable to the Artist's Published Tracks, prior to any platform fees, processing fees, or chargebacks.</p>
    <p><strong>"Track Revenue"</strong> means revenue generated from the Artist's individual tracks, including streaming engagement monetization and direct tips on specific tracks.</p>
    <p><strong>"Album Revenue"</strong> means revenue generated from the Artist's albums or releases, including album-level tips and engagement.</p>
    <p><strong>"MaiTroll Coins"</strong> or <strong>"Coins"</strong> means the virtual currency used within the MaiTroll platform.</p>
    <p><strong>"MaiPay"</strong> means the MaiTroll payout/cashout system through which eligible platform participants may request conversion of eligible MaiTroll Coins to United States Dollars.</p>
    <p><strong>"Published Tracks"</strong> means tracks that have been approved and published by MAI CORP and are available for streaming on the MaiTroll platform.</p>
    <p><strong>"Probation Period"</strong> means the initial thirty (30)-day period following the Effective Date during which the standard revenue split applies.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>4. Grant of Rights</h2>
    <p><strong>4.1 License Grant.</strong> Subject to the terms of this Agreement, the Artist grants to MAI CORP a non-exclusive, worldwide, royalty-bearing license to host, stream, display, reproduce, distribute, promote, and monetize the Artist's Submitted Content solely within the MaiTroll platform and its affiliated services.</p>
    <p><strong>4.2 Scope of License.</strong> The license granted herein is limited to the specific uses necessary for MAI CORP to operate the MaiTroll platform, including but not limited to: audio streaming, metadata display, promotional placement, algorithmic recommendation, and monetization through MaiTroll's coin and payout systems.</p>
    <p><strong>4.3 Master Recording Rights.</strong> The license includes the right to use, stream, and monetize the Artist's master sound recordings within the MaiTroll platform. MAI CORP does not acquire ownership of the master recordings. The Artist retains full ownership of all masters.</p>
    <p><strong>4.4 Composition / Songwriting Rights.</strong> The Artist retains 100% ownership of all underlying musical compositions, lyrics, and songwriting rights. This Agreement does not transfer, assign, or license any composition rights to MAI CORP, except as expressly necessary for the distribution and monetization of the sound recordings as described in Section 4.1. MAI CORP shall not collect publishing royalties or administer the Artist's compositions without a separate written agreement.</p>
    <p><strong>4.5 Publishing Rights.</strong> The Artist retains 100% of publishing rights. MAI CORP does not administer, control, or collect publishing royalties on behalf of the Artist.</p>
    <p><strong>4.6 Future Releases.</strong> The license granted under this Section 4 applies to all content created and submitted by the Artist during the term of this Agreement, including singles, albums, EPs, music videos, cover artwork, and promotional materials.</p>
    <p><strong>4.7 Reservation of Rights.</strong> Except for the limited license expressly granted in Section 4.1, the Artist retains all right, title, and interest in and to the underlying musical compositions, sound recordings, and all associated intellectual property embodied in the Submitted Content. This Agreement does not constitute a transfer, assignment, or conveyance of copyright ownership from the Artist to MAI CORP.</p>
    <p><strong>4.8 No Blanket Assignment.</strong> Nothing in this Agreement shall be construed as a blanket copyright assignment, work-for-hire agreement, or transfer of ownership of the Artist's underlying music. The Artist remains the sole and exclusive owner of all copyrights and related rights in the Submitted Content, subject only to the express license granted herein.</p>
    <p><strong>4.9 Territorial and Temporal Limits.</strong> The license granted under this Section 4 is limited to the territory of the world and to the term of this Agreement.</p>
  </div>

  <div class="section">
    <h2>5. Revenue Split</h2>
    <p><strong>5.1 Standard Split.</strong> Subject to the terms of this Agreement, eligible Track Revenue and Album Revenue shall be divided as follows:</p>
    <ul>
      <li><strong>Artist Share:</strong> ${artistSplitPercent}% of eligible revenue</li>
      <li><strong>MAI CORP / Label Share:</strong> ${labelSplitPercent}% of eligible revenue</li>
    </ul>
    <p><strong>5.2 Probation Period.</strong> The initial ${artistSplitPercent}/${labelSplitPercent} revenue split described in Section 5.1 shall apply for the first thirty (30) days of the Artist's applicable agreement and track monetization period (the "Probation Period"). Any modifications to the revenue split after the Probation Period shall be documented in a written amendment or contract tier update.</p>
    <p><strong>5.3 Eligible Revenue.</strong> Only revenue that is (a) actually collected by MAI CORP, (b) attributable to the Artist's Published Tracks, (c) not subject to refund, chargeback, or reversal, and (d) not derived from fraudulent or manipulative activity shall constitute "eligible revenue" subject to the split described herein.</p>
    <p><strong>5.4 Revenue Identification.</strong> Each eligible transaction shall be identified in the MaiTroll earnings system with the following information: the applicable Artist, the applicable Track or Album/Release, the gross revenue amount, the Artist's share, the MAI CORP/Label share, the transaction type, and the transaction status.</p>
    <p><strong>5.5 No Guaranteed Earnings.</strong> This Agreement does not guarantee any minimum amount of earnings, plays, tips, or revenue. Actual earnings depend entirely on audience engagement, platform activity, and market demand. MAI CORP makes no representation or warranty regarding the Artist's potential or actual earnings under this Agreement.</p>
  </div>

  <div class="section">
    <h2>6. Track Revenue and Earnings</h2>
    <p><strong>6.1 Track Revenue.</strong> Track Revenue consists of eligible gross revenue generated from the Artist's individual tracks, including but not limited to streaming monetization and track-level tips. Track Revenue is calculated and credited according to the platform's earnings system.</p>
    <p><strong>6.2 Album Revenue.</strong> Album Revenue consists of eligible gross revenue generated at the album or release level, including album tips and engagement attributable to the Artist's albums. Album Revenue is calculated separately from Track Revenue where applicable.</p>
    <p><strong>6.3 Distinction from Other MaiTroll Revenue.</strong> Track Revenue and Album Revenue under this Agreement are distinct from other MaiTroll revenue streams, including but not limited to: coin purchases by general users, key cashouts, academy payouts, agency commissions, advertising revenue, and third-party licensing not involving the Artist's Submitted Content.</p>
    <p><strong>6.4 Tips and Monetized Interactions.</strong> Tips and other monetized interactions (including virtual gifts, coin transfers, and similar features) on the Artist's content shall be subject to the ${artistSplitPercent}/${labelSplitPercent} revenue split described in Section 5.1. The applicable revenue split for tips shall be calculated on the gross coin amount received by the Artist from the tipping party, before any conversion to United States Dollars or other currency. The Artist's share of tips shall be credited to the Artist's MaiTroll account balance according to the platform's earnings system.</p>
    <p><strong>6.5 Earnings Dashboard.</strong> All completed eligible transactions are recorded in the MaiTroll earnings system. The Artist may view applicable earnings, transaction history, and balance information through their Artist/Earnings dashboard on the MaiTroll platform.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>6.6 Earnings Transaction Format</h2>
    <p>The following table illustrates the format in which Track Revenue transactions shall be recorded and made available to the Artist. Completed transactions are recorded in the MaiTroll earnings system and the Artist can view applicable earnings through their Artist/Earnings dashboard.</p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Track</th>
          <th>Album / Release</th>
          <th>Artist</th>
          <th class="right">Gross Eligible Revenue</th>
          <th class="right">Artist Share</th>
          <th class="right">MAI CORP / Label Share</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${txRows || '<tr><td colspan="8" style="padding:8px;border:1px solid #334155;color:#64748b;text-align:center;">No transactions recorded at this time.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>7. Applicable Tracks and Releases</h2>
    <p>The following tracks and releases are subject to this Agreement. Only approved, published content is eligible for revenue sharing under this Agreement.</p>
    <table>
      <thead>
        <tr>
          <th>Track Title</th>
          <th>Album / Release</th>
        </tr>
      </thead>
      <tbody>
        ${trackRows || '<tr><td colspan="2" style="padding:8px;border:1px solid #334155;color:#64748b;text-align:center;">No applicable tracks recorded at this time.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>8. MaiPay and Payouts</h2>
    <p><strong>8.1 MaiPay System.</strong> Eligible artists may cash out their available MaiTroll Coin earnings through the MaiPay payout system, subject to the current MaiTroll payout rules, including but not limited to: minimum coin requirements, maximum cashout limits, verification requirements, identity confirmation, processing times, and applicable fees. MAI CORP does not guarantee approval of any cashout request, and payout timing is subject to review, verification, and processing schedules that may change from time to time.</p>
    <p><strong>8.2 Payout Rules.</strong> The Artist acknowledges that MaiPay payouts are subject to:</p>
    <ul>
      <li>A minimum coin threshold for eligibility (currently 2,000 MaiTroll Coins for the lowest cashout tier);</li>
      <li>Weekly and rolling cashout limits (currently 10 rolling cashouts per standard account);</li>
      <li>Manual review requirements for certain tiers;</li>
      <li>Identity verification and tax documentation requirements;</li>
      <li>Processing fees and chargeback liability; and</li>
      <li>Any other rules published by MAI CORP from time to time.</li>
    </ul>
    <p><strong>8.3 MaiPay Plus.</strong> MaiPay Plus is an optional paid feature available for purchase through the MaiTroll platform. MaiPay Plus may provide additional cashout capacity, including an increased number of rolling cashouts and modified coin requirements per tier, according to the current MaiTroll pricing and feature rules. MaiPay Plus is not a guaranteed income opportunity, does not guarantee cashout approval, and does not alter the revenue split described in Section 5.1. The purchase of MaiPay Plus is optional and does not create any additional obligation on the part of MAI CORP.</p>
    <p><strong>8.4 Account Balance.</strong> Artist earnings are credited to the Artist's MaiTroll account according to the platform's earnings system. The Artist may become eligible to cash out their available earnings through the MaiTroll/MaiPay payout system, subject to the applicable payout rules, minimums, limits, verification requirements, and applicable fees.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>9. Artist Representations and Warranties</h2>
    <p><strong>9.1 Original Music.</strong> The Artist represents and warrants that all Submitted Content is original, created by the Artist or with full authorization, and does not infringe upon the intellectual property rights, moral rights, or any other rights of any third party.</p>
    <p><strong>9.2 Rights to Submit.</strong> The Artist represents and warrants that the Artist has the full legal right, power, and authority to enter into this Agreement and to grant the license described in Section 4.1.</p>
    <p><strong>9.3 No Infringement.</strong> The Artist represents and warrants that, to the Artist's knowledge, the Submitted Content does not knowingly infringe, misappropriate, or violate any patent, copyright, trademark, trade secret, moral right, or other intellectual property right of any third party.</p>
    <p><strong>9.4 Clearances.</strong> The Artist represents and warrants that all necessary clearances, releases, and permissions have been obtained for any samples, features, or third-party content incorporated in the Submitted Content.</p>
    <p><strong>9.5 Compliance.</strong> The Artist represents and warrants that the Submitted Content and the Artist's activities on the MaiTroll platform comply with all applicable laws, regulations, and MaiTroll platform policies.</p>
  </div>

  <div class="section">
    <h2>10. Platform Rules and Prohibited Conduct</h2>
    <p><strong>10.1 Content Policy.</strong> The Artist agrees to abide by all MaiTroll platform policies, community guidelines, and terms of service.</p>
    <p><strong>10.2 Copyright Claims and Takedowns.</strong> MAI CORP respects the intellectual property rights of others. The Artist agrees to cooperate with any copyright claim, takedown notice, or counter-notification process conducted through the MaiTroll platform or in accordance with applicable law. MAI CORP reserves the right to remove or restrict access to any Submitted Content that is the subject of a valid copyright claim.</p>
    <p><strong>10.3 Fraudulent Activity.</strong> The Artist shall not engage in any fraudulent activity, including but not limited to: artificial inflation of plays, likes, or engagement; creation of fake accounts to tip or interact with the Artist's own content; collusion with other users to manipulate platform metrics; misrepresentation of identity or ownership; or any other scheme designed to improperly increase revenue or visibility.</p>
    <p><strong>10.4 Manipulation of Plays and Engagement.</strong> The Artist shall not use bots, scripts, automated systems, or any other artificial means to generate plays, streams, likes, tips, or other engagement metrics. Any revenue attributed to manipulated activity shall be subject to reversal, forfeiture, and potential termination of this Agreement.</p>
    <p><strong>10.5 Violation of MaiTroll Policies.</strong> The Artist agrees not to violate any MaiTroll platform policies, including but not limited to: prohibited content, harassment, impersonation, spam, phishing, malware distribution, or any activity that disrupts or harms the MaiTroll platform or its users.</p>
  </div>

  <div class="section">
    <h2>11. Intellectual Property</h2>
    <p><strong>11.1 Artist Ownership.</strong> The Artist retains full ownership of all underlying musical compositions, sound recordings, lyrics, and related intellectual property in the Submitted Content, except as expressly limited by the license granted in Section 4.1.</p>
    <p><strong>11.2 Moral Rights.</strong> To the extent applicable, the Artist reserves all moral rights in the Submitted Content, and MAI CORP agrees not to take any action that would falsely attribute the Submitted Content to any party other than the Artist.</p>
    <p><strong>11.3 Registration.</strong> The Artist is encouraged to register their works with applicable copyright offices. Registration numbers may be provided to MAI CORP upon request but are not required for this Agreement to take effect.</p>
  </div>

  <div class="section">
    <h2>12. Term and Termination</h2>
    <p><strong>12.1 Term.</strong> This Agreement shall commence on the Effective Date and continue until terminated in accordance with this Section 12.</p>
    <p><strong>12.2 Termination by Artist.</strong> The Artist may terminate this Agreement by providing written notice to MAI CORP through the MaiTroll platform. Termination by the Artist shall not affect the Artist's right to receive payment for eligible revenue earned prior to the effective date of termination.</p>
    <p><strong>12.3 Termination by MAI CORP.</strong> MAI CORP may terminate this Agreement:</p>
    <ul>
      <li>Immediately, for material breach by the Artist, including but not limited to fraud, misrepresentation, infringement, or violation of platform policies;</li>
      <li>Upon thirty (30) days' written notice for convenience; or</li>
      <li>Immediately, if the Artist's account is suspended or terminated for violation of MaiTroll terms of service.</li>
    </ul>
    <p><strong>12.4 Effect of Termination.</strong> Upon termination of this Agreement:</p>
    <ul>
      <li>The license granted in Section 4.1 shall terminate, and MAI CORP shall cease distributing the Artist's Submitted Content through the MaiTroll platform, subject to technical processing delays;</li>
      <li>The Artist's eligible earnings that have been credited to the Artist's MaiTroll account prior to termination shall remain available for cashout according to the MaiPay rules then in effect;</li>
      <li>Revenue earned but not yet credited at the time of termination shall be processed and credited according to MAI CORP's standard settlement procedures;</li>
      <li>Pending transactions under review for fraud or manipulation shall be held and may be reversed in accordance with Section 10.4; and</li>
      <li>All provisions of this Agreement that by their nature should survive termination shall survive, including but not limited to: representations and warranties, payment obligations for earned revenue, and limitation of liability.</li>
    </ul>
    <p><strong>12.5 Post-Termination Earnings.</strong> Already-earned revenue that has been credited to the Artist's account prior to termination shall not be forfeited solely by reason of termination. The Artist's right to cash out such earned revenue through MaiPay shall continue according to the platform's standard payout rules and any applicable waiting periods.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>13. Electronic Acceptance</h2>
    <p><strong>13.1 Electronic Signature.</strong> The Artist's acceptance of this Agreement through the MaiTroll platform—including but not limited to clicking "Accept," "I Agree," or similar electronic confirmation buttons, or providing an electronic signature through the MaiTroll contract interface—shall constitute a legally binding electronic signature and acceptance of all terms and conditions contained herein.</p>
    <p><strong>13.2 Binding Effect.</strong> Electronic acceptance through MaiTroll carries the same legal weight and effect as a handwritten signature on a physical document. The Artist acknowledges that no physical signature is required for this Agreement to be enforceable.</p>
    <p><strong>13.3 Record of Acceptance.</strong> The date and time of the Artist's electronic acceptance shall be recorded in the MaiTroll system and shall serve as the "Effective Date" of this Agreement for all purposes.</p>
  </div>

  <div class="section">
    <h2>14. Miscellaneous</h2>
    <p><strong>14.1 Entire Agreement.</strong> This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, understandings, negotiations, and discussions.</p>
    <p><strong>14.2 Amendment.</strong> This Agreement may be amended only by a written instrument signed by both parties or through the MaiTroll platform's official contract amendment interface.</p>
    <p><strong>14.3 Severability.</strong> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
    <p><strong>14.4 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of [JURISDICTION], without regard to its conflict of law principles.</p>
    <p><strong>14.5 Company Address.</strong> Notices under this Agreement may be sent to MAI CORP at its principal place of business: [COMPANY ADDRESS].</p>
    <p><strong>14.6 Waiver.</strong> No waiver of any provision of this Agreement shall be effective unless in writing and signed by the waiving party.</p>
    <p><strong>14.7 Independent Contractors.</strong> The Artist is an independent contractor. Nothing in this Agreement creates an employer-employee relationship, partnership, joint venture, or agency relationship between the parties.</p>
  </div>

  <div class="section">
    <h2>15. Signatures</h2>
    <div class="signature-block">
      <h3>Artist</h3>
      <div class="sign-line">
        <span><strong>Legal Name:</strong> ${legalName}</span>
      </div>
      <div class="sign-line">
        <span><strong>Stage Name:</strong> ${stageName}</span>
      </div>
      <div class="sign-line">
        <span><strong>MaiTroll User ID:</strong> ${userId}</span>
      </div>
      <div class="sign-line">
        <span><strong>Email:</strong> ${email}</span>
      </div>
      <div class="sign-line">
        <span><strong>Electronic Signature:</strong> __________________________</span>
      </div>
      <div class="sign-line">
        <span><strong>Date:</strong> __________________________</span>
      </div>
    </div>

    <div class="signature-block">
      <h3>MAI CORP / MAI Record Label</h3>
      <div class="sign-line">
        <span><strong>Authorized Representative:</strong> __________________________</span>
      </div>
      <div class="sign-line">
        <span><strong>Title:</strong> __________________________</span>
      </div>
      <div class="sign-line">
        <span><strong>Electronic Signature:</strong> __________________________</span>
      </div>
      <div class="sign-line">
        <span><strong>Date:</strong> __________________________</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>16. Official MAI CORP Corporate Stamp</h2>
    <div class="stamp-area">
      <div class="stamp-area-inner">
        <strong>[RESERVED STAMP AREA]</strong><br><br>
        The official MAI CORP corporate stamp/seal asset must be inserted here before this contract is finalized.<br><br>
        Do not substitute, fabricate, or alter the official stamp.
      </div>
    </div>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>17. Schedules</h2>
    <p>The following schedules are incorporated by reference into this Agreement and form an integral part hereof. In the event of any conflict between the body of this Agreement and any schedule, the body of this Agreement shall control unless the schedule expressly states otherwise.</p>
    <p><strong>Schedule A — Artist Information.</strong> Legal name, stage/display name, MaiTroll User ID, email address, and contact information for the Artist.</p>
    <p><strong>Schedule B — Royalty &amp; Revenue Split.</strong> The exact percentages applicable to the Artist and MAI CORP, the specific revenue categories covered, and any tier-specific terms.</p>
    <p><strong>Schedule C — Release/Recording Schedule.</strong> The specific albums, singles, EPs, and other releases covered by this Agreement, including delivery dates and status.</p>
    <p><strong>Schedule D — Rights &amp; Ownership.</strong> A detailed description of the rights granted to MAI CORP, the rights retained by the Artist, and any limitations on use.</p>
  </div>

  <div class="section">
    <h2>18. Artist Content &amp; Rights Declaration</h2>
    <p><strong>18.1 Ownership Declaration.</strong> The Artist declares that the Artist owns or controls all rights necessary to submit the content hereunder and to grant the license described in Section 4.1.</p>
    <p><strong>18.2 Non-Infringement.</strong> The Artist declares that the Submitted Content does not knowingly infringe the rights of any third party.</p>
    <p><strong>18.3 Sample Clearances.</strong> The Artist declares that all samples, interpolations, or third-party content incorporated in the Submitted Content have been properly cleared.</p>
    <p><strong>18.4 Featured Artists.</strong> The Artist declares that any featured artists have granted appropriate permissions for inclusion in the Submitted Content.</p>
    <p><strong>18.5 Co-Writer Disclosure.</strong> The Artist has disclosed all co-writers, producers, and rightsholders with an interest in the Submitted Content.</p>
  </div>

  <div class="section">
    <h2>19. Release Authorization</h2>
    <p>The Artist hereby authorizes MAI CORP to distribute, promote, and monetize the specific songs, albums, and releases identified in Schedule C on the Artist's behalf through the channels described in Section 20. This authorization applies only to content that has been approved and published by MAI CORP. Unreleased content requires separate written authorization.</p>
  </div>

  <div class="section">
    <h2>20. Distribution</h2>
    <p><strong>20.1 Authorized Channels.</strong> MAI CORP may distribute the Artist's Submitted Content through the following channels:</p>
    <ul>
      <li>Major streaming services (including but not limited to Spotify, Apple Music, Amazon Music, YouTube Music);</li>
      <li>Digital download stores;</li>
      <li>The MaiTroll platform and its affiliated services;</li>
      <li>The MAI Record Label website and associated marketing channels;</li>
      <li>Social platforms (including but not limited to TikTok, Instagram, Facebook);</li>
      <li>Music video platforms (including but not limited to YouTube); and</li>
      <li>Such other channels as MAI CORP may designate from time to time.</li>
    </ul>
    <p><strong>20.2 Distributor Accounts.</strong> MAI CORP controls and maintains the distributor accounts used to upload and distribute the Artist's content. The Artist shall not attempt to upload, distribute, or modify the Artist's Submitted Content through distributor accounts not controlled by MAI CORP without prior written consent.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>21. MaiTroll Artist Integration</h2>
    <p><strong>21.1 Platform Features.</strong> As an approved MAI Record Label artist, the Artist shall have access to the following MaiTroll platform features:</p>
    <ul>
      <li>Artist badge/status indicating verified MAI Record Label affiliation;</li>
      <li>Dedicated Artist profile page;</li>
      <li>Albums tab displaying the Artist's releases;</li>
      <li>Tracks tab displaying the Artist's published tracks;</li>
      <li>Artist tipping functionality;</li>
      <li>Music promotion and placement opportunities;</li>
      <li>Label page placement and featuring;</li>
      <li>Artist analytics and reporting dashboards; and</li>
      <li>Revenue reporting and earnings tracking.</li>
    </ul>
    <p><strong>21.2 No Administrative Access.</strong> Being an approved MAI artist does not automatically grant the Artist administrative access to MAI CORP systems, distributor accounts, or backend platform controls. Administrative access must be explicitly granted in writing by MAI CORP.</p>
  </div>

  <div class="section">
    <h2>22. Recording &amp; Release Obligations</h2>
    <p><strong>22.1 Recording Commitments.</strong> During the term of this Agreement, the Artist agrees to deliver a commercially reasonable number of releases as agreed upon by the parties. Specific delivery expectations shall be documented in Schedule C.</p>
    <p><strong>22.2 Delivery Requirements.</strong> All recordings delivered to MAI CORP shall meet the following minimum requirements:</p>
    <ul>
      <li>Audio quality: Mastered, broadcast-ready audio files in the formats specified by MAI CORP (typically WAV 44.1kHz/16-bit or higher);</li>
      <li>Artwork: High-resolution cover artwork meeting MAI CORP specifications (minimum 3000x3000 pixels, 300 DPI, RGB or CMYK as specified);</li>
      <li>Metadata: Complete and accurate metadata including title, artist name, genre, release date, ISRC codes, and applicable credits; and</li>
      <li>Legal clearance documentation for any samples, features, or third-party content.</li>
    </ul>
    <p><strong>22.3 Release Deadlines.</strong> The Artist shall deliver content sufficiently in advance of desired release dates to allow MAI CORP adequate time for review, processing, and distribution setup. Target release dates shall be mutually agreed upon.</p>
    <p><strong>22.4 MAI Approval.</strong> MAI CORP reserves the right to approve or reject release dates, artwork, metadata, and content for quality, legal, or brand-compliance reasons. Rejected content may be revised and resubmitted at the Artist's expense.</p>
  </div>

  <div class="section">
    <h2>23. Promotion</h2>
    <p><strong>23.1 MAI Promotion Commitment.</strong> MAI CORP agrees to provide reasonable promotional support for the Artist's releases, which may include:</p>
    <ul>
      <li>Social media promotion through MAI CORP channels;</li>
      <li>Playlist consideration on MaiTroll and affiliated platforms;</li>
      <li>Label page featuring and placement;</li>
      <li>MaiTroll platform promotion and discovery features; and</li>
      <li>Coordinated marketing campaigns for significant releases.</li>
    </ul>
    <p><strong>23.2 No Guarantee.</strong> MAI CORP does not guarantee any specific level of promotion, streams, followers, playlist placement, or revenue. The extent of promotional support depends on available resources, market conditions, and MAI CORP's discretion. The Artist acknowledges that promotional efforts do not guarantee commercial success.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>24. Accounting &amp; Payments</h2>
    <p><strong>24.1 Earnings Calculation.</strong> Artist earnings shall be calculated based on eligible revenue attributed to the Artist's Published Tracks, subject to the revenue split described in Section 5.1 and Schedule B.</p>
    <p><strong>24.2 Accounting Period.</strong> MAI CORP shall calculate and account for Artist earnings on a monthly basis, unless otherwise specified.</p>
    <p><strong>24.3 Payment Schedule.</strong> Eligible earnings shall be made available for cashout through MaiPay according to the platform's standard payout schedule and rules. MAI CORP does not guarantee specific payout timing.</p>
    <p><strong>24.4 Minimum Payout Threshold.</strong> The Artist must meet the minimum coin threshold for MaiPay eligibility (currently 2,000 MaiTroll Coins for the lowest cashout tier) before requesting a cashout.</p>
    <p><strong>24.5 Payment Method.</strong> Payments shall be made through the MaiPay system using the Artist's verified payout method. MAI CORP is not responsible for delays or failures caused by the Artist's payment provider.</p>
    <p><strong>24.6 Statements.</strong> MAI CORP shall provide electronic statements through the Artist/Earnings dashboard showing transaction-level detail including date, track, album, gross revenue, Artist share, and Label share.</p>
    <p><strong>24.7 Dispute Resolution.</strong> The Artist may dispute any accounting statement by providing written notice to MAI CORP within thirty (30) days of the statement date. MAI CORP shall investigate and respond within a reasonable time. Unresolved disputes shall be handled in accordance with Section 31.</p>
  </div>

  <div class="section">
    <h2>25. Taxes</h2>
    <p>The Artist is solely responsible for all taxes, levies, duties, and similar governmental charges arising from the Artist's earnings under this Agreement, including but not limited to income tax, self-employment tax, and sales tax. MAI CORP shall provide applicable tax documentation (such as IRS Form 1099 or equivalent) as required by law, but the Artist remains responsible for reporting and paying all taxes. MAI CORP may withhold taxes as required by applicable law.</p>
  </div>

  <div class="section">
    <h2>26. Expenses</h2>
    <p><strong>26.1 No Recoupment.</strong> MAI CORP does not recoup distribution fees, marketing expenses, production expenses, advertising costs, artwork costs, video production costs, or any other expenses from the Artist's revenue share. The Artist's revenue split as described in Section 5.1 applies to gross eligible revenue before any expenses.</p>
    <p><strong>26.2 Pre-Approved Expenses.</strong> If MAI CORP incurs pre-approved, extraordinary expenses on the Artist's behalf (such as a major music video production explicitly agreed to in writing), the parties shall document the expense, the repayment terms, and the impact on revenue splits in a written amendment to this Agreement. No expenses shall be recouped without such written amendment.</p>
  </div>

  <div class="section">
    <h2>27. Name, Image &amp; Likeness</h2>
    <p><strong>27.1 Limited License.</strong> The Artist grants to MAI CORP a limited, non-exclusive license to use the Artist's name, stage name, photograph, voice, logo, biography, and approved promotional materials solely for legitimate label promotion, marketing, and distribution of the Artist's Submitted Content.</p>
    <p><strong>27.2 Scope Limitation.</strong> This license does not grant MAI CORP unlimited ownership of the Artist's identity. MAI CORP shall not use the Artist's name, image, or likeness for purposes unrelated to the promotion of the Artist's music or the MAI Record Label without the Artist's prior written consent.</p>
    <p><strong>27.3 Approval.</strong> MAI CORP shall obtain the Artist's approval for any use of the Artist's name, image, or likeness in contexts beyond standard promotional materials, provided that the Artist responds to approval requests within fourteen (14) days. Failure to respond within fourteen (14) days shall be deemed approval.</p>
  </div>

  <div class="section">
    <h2>28. AI / Voice / Likeness</h2>
    <p><strong>28.1 Opt-In Required.</strong> MAI CORP shall not use, create, or authorize the creation of AI-generated versions of the Artist's voice, digital likeness, or AI-generated promotional material featuring the Artist without the Artist's explicit opt-in consent in writing.</p>
    <p><strong>28.2 Prohibited Uses Without Consent.</strong> Without the Artist's written opt-in consent, MAI CORP shall not:</p>
    <ul>
      <li>Generate AI versions of the Artist's voice or vocal performances;</li>
      <li>Create digital clones or deepfakes of the Artist's likeness;</li>
      <li>Train machine learning or AI models using the Artist's recordings, voice, or likeness;</li>
      <li>Produce AI-generated promotional material depicting the Artist; or</li>
      <li>Use the Artist's content for any synthetic media or AI training purposes.</li>
    </ul>
    <p><strong>28.3 Opt-In Documentation.</strong> Any opt-in consent under this Section 28 shall be documented in writing, specify the permitted uses, and may be revoked by the Artist at any time with thirty (30) days' written notice.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>29. Confidentiality</h2>
    <p>Each party agrees to maintain the confidentiality of the following information belonging to the other party:</p>
    <ul>
      <li>The terms and conditions of this Agreement;</li>
      <li>Revenue information, earnings data, and financial statements;</li>
      <li>Unreleased music, demos, and pending releases;</li>
      <li>Business information, strategies, and forecasts;</li>
      <li>Artist analytics, audience data, and platform metrics; and</li>
      <li>Private communications between the parties regarding the Agreement.</li>
    </ul>
    <p>This confidentiality obligation shall not apply to information that is publicly available, required to be disclosed by law, or independently developed without reference to the confidential information.</p>
  </div>

  <div class="section">
    <h2>30. Post-Termination Rights</h2>
    <p><strong>30.1 Ownership of Released Masters.</strong> The Artist retains ownership of all released master recordings. Nothing in this Agreement transfers ownership of released masters to MAI CORP.</p>
    <p><strong>30.2 Continued Distribution.</strong> Following termination, MAI CORP may continue distributing the Artist's previously released content for a period of up to ninety (90) days to wind down operations and fulfill existing distribution commitments.</p>
    <p><strong>30.3 Royalty Continuation.</strong> The Artist shall continue to receive royalties for eligible revenue generated from previously released content during the wind-down period and thereafter, according to the revenue split in effect at the time of termination, until such content is removed from distribution.</p>
    <p><strong>30.4 MaiTroll Artist Profile.</strong> Following termination, the Artist's MaiTroll artist profile may be archived or deactivated at MAI CORP's discretion, subject to applicable platform policies. The Artist's earnings history and balance information shall remain accessible according to MaiTroll's standard data retention policies.</p>
    <p><strong>30.5 Unreleased Music.</strong> All unreleased music, demos, and pending recordings shall be returned to the Artist or destroyed at the Artist's written request within thirty (30) days of termination. MAI CORP shall not release, distribute, or use any unreleased content after termination without the Artist's written consent.</p>
    <p><strong>30.6 Promotional Materials.</strong> Existing promotional materials may be used for a reasonable period to wind down campaigns, but MAI CORP shall cease creating new promotional materials after termination.</p>
  </div>

  <div class="section">
    <h2>31. Dispute Resolution</h2>
    <p><strong>31.1 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of [JURISDICTION], without regard to its conflict of law principles.</p>
    <p><strong>31.2 Venue.</strong> Any legal action, suit, or proceeding arising out of this Agreement shall be brought exclusively in the courts of [JURISDICTION], and each party irrevocably accepts the jurisdiction and venue of such courts.</p>
    <p><strong>31.3 Negotiation.</strong> Before initiating any formal dispute resolution, the parties agree to negotiate in good faith for a period of thirty (30) days.</p>
    <p><strong>31.4 Mediation/Arbitration.</strong> If negotiation fails, the dispute shall be resolved through mediation or binding arbitration in accordance with the rules of [ARBITRATION BODY], unless applicable law requires a different process. The prevailing party shall be entitled to reasonable attorneys' fees and costs.</p>
  </div>

  <div class="section">
    <h2>32. No Guaranteed Success</h2>
    <p>MAI CORP does not guarantee, warrant, or represent:</p>
    <ul>
      <li>Any specific level of streams, plays, or downloads;</li>
      <li>Any specific level of sales or revenue;</li>
      <li>Any specific number of followers, fans, or audience growth;</li>
      <li>Viral success, chart placement, or media coverage;</li>
      <li>Playlist placement on any streaming platform;</li>
      <li>Marketing or promotional support of any particular magnitude;</li>
      <li>Record deals, publishing deals, or other industry opportunities; or</li>
      <li>The Artist's future commercial success or career trajectory.</li>
    </ul>
    <p>The music industry is inherently uncertain. The Artist acknowledges that past performance of other artists does not guarantee future results, and that investment in music careers carries significant risk.</p>
  </div>
</div>

<div class="page">
  <div class="section">
    <h2>Schedule A — Artist Information</h2>
    <table>
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;width:40%;">Legal Name</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;font-weight:bold;">${legalName}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">Stage / Display Name</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;font-weight:bold;">${stageName}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">MaiTroll User ID</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;font-weight:bold;">${userId}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">Email Address</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;font-weight:bold;">${email}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">Contract Effective Date</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;font-weight:bold;">${effectiveDate}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Schedule B — Royalty &amp; Revenue Split</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="right">Artist Share</th>
          <th class="right">MAI CORP / Label Share</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Eligible Track Revenue (Standard)</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Eligible Album Revenue</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Track Tips / Monetized Interactions</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Streaming Revenue</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Downloads / Digital Sales</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Licensing / Sync</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">Merchandise (if applicable)</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#34d399;text-align:right;font-weight:bold;">${artistSplitPercent}%</td>
          <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#fbbf24;text-align:right;font-weight:bold;">${labelSplitPercent}%</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top:10px;"><strong>Net Revenue Definition.</strong> "Net Revenue" means gross revenue actually received by MAI CORP from the applicable source, minus (a) refunds, chargebacks, and reversals, (b) platform fees and processing fees paid to third parties, and (c) taxes withheld by MAI CORP. Net Revenue shall be calculated and reported in MaiTroll Coins or United States Dollars as applicable.</p>
  </div>

  <div class="section">
    <h2>Schedule C — Release / Recording Schedule</h2>
    <p>The following releases are subject to this Agreement as of the Effective Date. Additional releases may be added by written amendment or through the MaiTroll platform's release management interface.</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Album / Release</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${(data.applicableTracks && data.applicableTracks.length > 0)
          ? data.applicableTracks.map((t) => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#0f172a;">${escapeHtml(t.title)}</td>
                <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">Track</td>
                <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">${t.albumTitle ? escapeHtml(t.albumTitle) : '—'}</td>
                <td style="padding:6px 8px;border:1px solid #334155;font-size:10px;color:#64748b;">Published</td>
              </tr>
            `).join('')
          : '<tr><td colspan="4" style="padding:8px;border:1px solid #334155;color:#64748b;text-align:center;">No applicable tracks recorded at this time.</td></tr>'
        }
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Schedule D — Rights &amp; Ownership</h2>
    <p><strong>Master Recordings.</strong> MAI CORP receives a non-exclusive license to use, distribute, and monetize the Artist's master recordings solely within the MaiTroll platform and its affiliated services for the term of this Agreement. The Artist retains full ownership of all master recordings.</p>
    <p><strong>Compositions / Songwriting.</strong> The Artist retains 100% ownership of all underlying musical compositions, lyrics, and songwriting rights. This Agreement does not transfer, assign, or license any composition rights to MAI CORP, except as expressly necessary for the distribution and monetization of the sound recordings as described in Section 4.1.</p>
    <p><strong>Publishing Rights.</strong> The Artist retains 100% of publishing rights. MAI CORP does not administer, control, or collect publishing royalties on behalf of the Artist.</p>
    <p><strong>Future Releases.</strong> The license granted in Section 4.1 applies to all content created and submitted by the Artist during the term of this Agreement.</p>
    <p><strong>Music Videos.</strong> MAI CORP receives a license to distribute and monetize music videos created for the Artist's releases within the MaiTroll platform.</p>
    <p><strong>Cover Artwork.</strong> The Artist retains ownership of cover artwork. MAI CORP receives a license to display and use artwork in connection with the distribution and promotion of the Artist's releases.</p>
    <p><strong>Promotional Materials.</strong> The Artist retains ownership of promotional materials. MAI CORP receives a limited license to use approved promotional materials for label promotion as described in Section 27.</p>
  </div>
</div>

<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
  <div style="font-family:monospace;font-size:8pt;color:#94a3b8;">
    MAI CORP / MAI Record Label — Official Artist Agreement — Contract ${contractNumber} — Generated ${new Date().toISOString()}
  </div>
</div>
</body>
</html>`
}
