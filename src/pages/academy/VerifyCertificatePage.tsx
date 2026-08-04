// ============================================================
// Mai Troll ACADEMY - PUBLIC CERTIFICATE VERIFICATION
// ============================================================

import React, { useState } from 'react';
import {
  Search,
  CheckCircle,
  XCircle,
  Award,
  GraduationCap,
  FileText,
  QrCode,
} from 'lucide-react';
import { verifyCertificate, verifyCertificateById } from '@/services/academyService';
import type { AcademyCertificate } from '@/types/academy';

export default function VerifyCertificatePage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AcademyCertificate | null | 'not_found'>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      // Try as certificate number first, then as verification ID
      let cert = await verifyCertificate(query.trim());
      if (!cert) {
        cert = await verifyCertificateById(query.trim());
      }
      setResult(cert || 'not_found');
    } catch (err) {
      console.error('Verification error:', err);
      setResult('not_found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-[#070b19]/70 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600">
          <QrCode className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-white">Certificate Verification</h1>
        <p className="mt-2 text-sm text-slate-400">Verify Mai Troll Academy certificates</p>
      </div>

      {/* Search */}
      <form onSubmit={handleVerify} className="rounded-2xl border border-white/10 bg-[#070b19]/70 p-5">
        <label className="mb-2 block text-xs font-bold text-slate-300">Certificate Number or Verification ID</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., CERT-2026-000001 or V-84A7K92"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50"
            />
          </div>
          <button type="submit" disabled={loading}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>

      {/* Result */}
      {result === 'not_found' && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.05] p-6 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-3 text-lg font-black text-white">Certificate Not Found</h2>
          <p className="mt-1 text-sm text-slate-400">The certificate number or verification ID you entered could not be found.</p>
        </div>
      )}

      {result && result !== 'not_found' && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <div>
              <h2 className="text-lg font-black text-white">Certificate Verified ✓</h2>
              <p className="text-xs text-emerald-300">This is a valid Mai Troll Academy certificate</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Student Name</p>
              <p className="text-sm font-bold text-white">{result.student_name}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Username</p>
              <p className="text-sm font-bold text-white">@{result.student_username}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Course</p>
              <p className="text-sm font-bold text-white">{result.course_name}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Teacher</p>
              <p className="text-sm font-bold text-white">{result.teacher_name}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Final Grade</p>
              <p className="text-sm font-bold text-white">{result.final_grade} ({result.final_percentage}%)</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-400">Completion Date</p>
              <p className="text-sm font-bold text-white">{new Date(result.issued_at).toLocaleDateString()}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:col-span-2">
              <p className="text-[10px] text-slate-400">Certificate Number</p>
              <p className="text-sm font-bold text-white">{result.certificate_number}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:col-span-2">
              <p className="text-[10px] text-slate-400">Verification ID</p>
              <p className="text-sm font-bold text-white">{result.verification_id}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-500/10 p-3">
            <span className="text-xs font-bold text-emerald-300">Status: {result.status.toUpperCase()}</span>
            <span className="text-xs text-slate-400">Verified at {new Date().toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
