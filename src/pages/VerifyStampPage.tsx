import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Stamp, Shield, CheckCircle, XCircle, Search } from 'lucide-react'
import { verifyStamp } from '@/services/notaryService'
import { toast } from 'sonner'

export default function VerifyStampPage() {
  const { code: paramCode } = useParams<{ code: string }>()
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (paramCode) {
      setCode(paramCode)
      handleVerify(paramCode)
    }
  }, [paramCode])

  const handleVerify = async (verifyCode?: string) => {
    const c = verifyCode || code
    if (!c.trim()) {
      toast.error('Please enter a verification code')
      return
    }
    setLoading(true)
    try {
      const res = await verifyStamp(c.trim())
      setResult(res)
      if (!res?.valid) {
        toast.error('Invalid or expired verification code')
      }
    } catch (err: any) {
      toast.error('Verification failed: ' + err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-4">
            <Stamp className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">Verify Mai Troll Document</h1>
          <p className="text-gray-400 text-sm mt-2">Enter a verification code to authenticate an official document</p>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="TC-VERIFY-XXXXXXXXXXXX"
            className="flex-1 px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm font-mono"
          />
          <button
            onClick={handleVerify}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Verifying...' : <><Search size={14} /> Verify</>}
          </button>
        </div>

        {result && (
          <div className={`rounded-xl border p-6 ${result.valid ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.valid ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <h2 className={`text-lg font-bold ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                {result.valid ? 'Document Verified' : 'Document Not Found'}
              </h2>
            </div>

            {result.valid && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-500 text-xs">Stamp ID</span>
                    <p className="text-yellow-400 font-mono">{result.stamp_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Seal</span>
                    <p className="text-white">{result.seal}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Approver</span>
                    <p className="text-white">{result.approver}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Role</span>
                    <p className="text-white">{result.approver_role}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Approval Date</span>
                    <p className="text-white">{new Date(result.approval_date).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Document Status</span>
                    <p className={`font-semibold ${
                      result.document_status === 'approved' ? 'text-green-400' : 'text-yellow-400'
                    }`}>{result.document_status}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Document Type</span>
                    <p className="text-white">{result.document_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Document Title</span>
                    <p className="text-white">{result.document_title}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <span className="text-gray-500 text-xs">Verification Code</span>
                  <p className="text-green-400 font-mono">{code}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Document Checksum (SHA-256)</span>
                  <p className="text-gray-400 font-mono text-xs break-all">{result.document_checksum}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Stamp Hash (SHA-256)</span>
                  <p className="text-gray-400 font-mono text-xs break-all">{result.stamp_hash}</p>
                </div>
                <div className="pt-3 border-t border-white/10 text-xs text-gray-500">
                  <Shield size={10} className="inline mr-1" />
                  This document has been cryptographically verified by the Mai Troll Notary System.
                  The document content has not been altered since approval.
                </div>
              </div>
            )}

            {!result.valid && result.error && (
              <p className="text-red-300 text-sm">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
