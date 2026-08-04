import type { NotaryDocument, DocumentSignature, DocumentStamp } from '@/types/notary'

interface StampData {
  stampId: string
  sealText: string
  approverUsername: string
  approverRole: string
  approvalDate: string
  verificationCode: string
  stampHash: string
}

export function generateStampSVG(stamp: StampData): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160" viewBox="0 0 280 160">
  <defs>
    <linearGradient id="stampGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0d1b2a;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="2" y="2" width="276" height="156" rx="8" ry="8" fill="url(#stampGrad)" stroke="#3b82f6" stroke-width="2"/>
  <rect x="6" y="6" width="268" height="148" rx="6" ry="6" fill="none" stroke="#60a5fa" stroke-width="0.5" stroke-dasharray="4 2"/>
  <text x="140" y="28" text-anchor="middle" fill="#60a5fa" font-family="monospace" font-size="11" font-weight="bold" filter="url(#glow)">${stamp.sealText}</text>
  <line x1="20" y1="36" x2="260" y2="36" stroke="#3b82f6" stroke-width="0.5"/>
  <text x="140" y="52" text-anchor="middle" fill="#93c5fd" font-family="monospace" font-size="9">APPROVED BY Mai Troll</text>
  <text x="20" y="70" fill="#cbd5e1" font-family="monospace" font-size="8">Approved By:</text>
  <text x="100" y="70" fill="#ffffff" font-family="monospace" font-size="8" font-weight="bold">${stamp.approverUsername}</text>
  <text x="20" y="84" fill="#cbd5e1" font-family="monospace" font-size="8">Role:</text>
  <text x="100" y="84" fill="#ffffff" font-family="monospace" font-size="8">${stamp.approverRole}</text>
  <text x="20" y="98" fill="#cbd5e1" font-family="monospace" font-size="8">Date:</text>
  <text x="100" y="98" fill="#ffffff" font-family="monospace" font-size="8">${stamp.approvalDate}</text>
  <text x="20" y="112" fill="#cbd5e1" font-family="monospace" font-size="8">Approval ID:</text>
  <text x="100" y="112" fill="#fbbf24" font-family="monospace" font-size="8">${stamp.stampId}</text>
  <text x="20" y="126" fill="#cbd5e1" font-family="monospace" font-size="8">Verify:</text>
  <text x="100" y="126" fill="#34d399" font-family="monospace" font-size="7">${stamp.verificationCode}</text>
  <line x1="20" y1="134" x2="260" y2="134" stroke="#3b82f6" stroke-width="0.5"/>
  <text x="140" y="148" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="6">HASH: ${stamp.stampHash.substring(0, 32)}...</text>
</svg>`
}

export function generateSignatureBlock(signature: DocumentSignature): string {
  const sigDate = new Date(signature.signed_at).toLocaleString()
  return `<div style="margin:12px 0;padding:10px;border:1px solid #334155;border-radius:6px;background:#0f172a;">
  <div style="font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:4px;">DIGITAL SIGNATURE</div>
  <div style="font-family:serif;font-size:22px;color:#3b82f6;font-style:italic;margin:8px 0;">${signature.typed_signature}</div>
  <div style="font-family:monospace;font-size:9px;color:#cbd5e1;">
    <span style="color:#64748b;">Legal Name:</span> ${signature.legal_name}
    &nbsp;|&nbsp; <span style="color:#64748b;">Username:</span> ${signature.username}
    &nbsp;|&nbsp; <span style="color:#64748b;">Signed:</span> ${sigDate}
  </div>
  <div style="font-family:monospace;font-size:8px;color:#475569;margin-top:4px;">
    Doc Version: v${signature.agreement_version} | Hash: ${signature.signature_hash.substring(0, 40)}...
  </div>
</div>`
}

export function generateDocumentHTML(options: {
  document: NotaryDocument
  signatures?: DocumentSignature[]
  stamp?: DocumentStamp | null
}): string {
  const { document: doc, signatures = [], stamp } = options
  const createdDate = new Date(doc.created_at).toLocaleString()
  const submittedDate = doc.submitted_at ? new Date(doc.submitted_at).toLocaleString() : null

  let stampHTML = ''
  if (stamp) {
    stampHTML = `<div style="margin:20px 0;text-align:center;">${generateStampSVG({
      stampId: stamp.stamp_id,
      sealText: stamp.seal_text,
      approverUsername: stamp.approver_username,
      approverRole: stamp.approver_role,
      approvalDate: new Date(stamp.approval_date).toLocaleString(),
      verificationCode: stamp.verification_code,
      stampHash: stamp.stamp_hash
    })}</div>`
  }

  let signaturesHTML = ''
  if (signatures.length > 0) {
    signaturesHTML = `<div style="margin:20px 0;">
  <div style="font-family:monospace;font-size:11px;color:#94a3b8;margin-bottom:8px;border-bottom:1px solid #334155;padding-bottom:4px;">SIGNATURES (${signatures.length})</div>
  ${signatures.map(s => generateSignatureBlock(s)).join('')}
</div>`
  }

  let approvalHistoryHTML = ''
  if (stamp) {
    approvalHistoryHTML = `<div style="margin:20px 0;padding:10px;border:1px solid #334155;border-radius:6px;background:#0f172a;">
  <div style="font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:8px;">APPROVAL HISTORY</div>
  <div style="font-family:monospace;font-size:9px;color:#cbd5e1;">
    <div style="margin-bottom:4px;"><span style="color:#34d399;">&#10003;</span> Approved by <strong style="color:#fff;">${stamp.approver_username}</strong> (${stamp.approver_role}) on ${new Date(stamp.approval_date).toLocaleString()}</div>
    <div style="color:#475569;font-size:8px;">Verification Code: ${stamp.verification_code} | Document Checksum: ${stamp.document_checksum?.substring(0, 32)}...</div>
  </div>
</div>`
  }

  let rejectionHTML = ''
  if (doc.status === 'rejected' && doc.rejection_reason) {
    rejectionHTML = `<div style="margin:20px 0;padding:10px;border:1px solid #ef4444;border-radius:6px;background:#1a0a0a;">
  <div style="font-family:monospace;font-size:10px;color:#f87171;margin-bottom:4px;">&#10007; REJECTED</div>
  <div style="font-family:monospace;font-size:9px;color:#fca5a5;">${doc.rejection_reason}</div>
  ${doc.rejected_at ? `<div style="font-family:monospace;font-size:8px;color:#991b1b;margin-top:4px;">${new Date(doc.rejected_at).toLocaleString()}</div>` : ''}
</div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head>
<body style="background:#0a0a0a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:800px;margin:0 auto;">
<div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #1e3a5f;">
  <div style="font-family:monospace;font-size:24px;font-weight:bold;color:#3b82f6;letter-spacing:2px;">Mai Troll</div>
  <div style="font-family:monospace;font-size:11px;color:#64748b;margin-top:4px;">OFFICIAL DOCUMENT</div>
</div>
<div style="margin-bottom:20px;">
  <h1 style="font-size:20px;font-weight:bold;color:#fff;margin:0 0 8px 0;">${doc.title}</h1>
  <div style="font-family:monospace;font-size:10px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap;">
    <span>Type: ${doc.document_type_slug}</span>
    <span>Status: <span style="color:${doc.status === 'approved' ? '#34d399' : doc.status === 'rejected' ? '#f87171' : '#fbbf24'};">${doc.status.toUpperCase()}</span></span>
    <span>Version: v${doc.version}</span>
    <span>Created: ${createdDate}</span>
    ${submittedDate ? `<span>Submitted: ${submittedDate}</span>` : ''}
  </div>
  ${doc.checksum ? `<div style="font-family:monospace;font-size:8px;color:#475569;margin-top:4px;">Checksum: ${doc.checksum.substring(0, 48)}...</div>` : ''}
</div>
<div style="border-top:1px solid #1e293b;padding-top:20px;margin-bottom:20px;">
  <div style="font-size:14px;line-height:1.7;color:#cbd5e1;white-space:pre-wrap;">${doc.content}</div>
</div>
${rejectionHTML}${signaturesHTML}${approvalHistoryHTML}${stampHTML}
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #1e293b;text-align:center;">
  <div style="font-family:monospace;font-size:8px;color:#475569;">Generated by Mai Troll Notary & Document Management System. ${stamp ? `Verify at Mai Troll.app/verify/${stamp.verification_code}` : 'Verification pending.'}</div>
  <div style="font-family:monospace;font-size:7px;color:#334155;margin-top:4px;">${new Date().toISOString()} | Doc ID: ${doc.id}</div>
</div></body></html>`
}

export async function downloadPDF(options: {
  document: NotaryDocument
  signatures?: DocumentSignature[]
  stamp?: DocumentStamp | null
}): Promise<void> {
  const html = generateDocumentHTML(options)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    // Fallback: create blob and download
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${options.document.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
  }, 500)
}
