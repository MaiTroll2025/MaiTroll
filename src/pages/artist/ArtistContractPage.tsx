import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import type { MaiRecordLabelAgreementData } from '@/services/maiRecordLabelAgreement'
import { generateMaiRecordLabelAgreement } from '@/services/maiRecordLabelAgreement'
import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Loader2,
  Music,
  ShieldCheck,
  UserCheck,
  Download,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { downloadPDF } from '@/services/notaryPDF'
import type { NotaryDocument, DocumentSignature, DocumentStamp } from '@/types/notary'

type ContractTier = 'probation' | 'standard' | 'tier_90_10' | 'tier_95_5'

const TIER_LABELS: Record<ContractTier, string> = {
  probation: 'Probation',
  standard: 'Standard',
  tier_90_10: '90/10 Tier',
  tier_95_5: '95/5 Tier',
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

export default function ArtistContractPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [contract, setContract] = useState<recordLabelService.RecordLabelContract | null>(null)
  const [artistProfile, setArtistProfile] = useState<recordLabelService.RecordLabelArtistProfile | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [legalName, setLegalName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [agreementHTML, setAgreementHTML] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!user?.id) {
        navigate('/auth', { replace: true })
        return
      }

      try {
        setLoading(true)

        const [artistResult, contractResult, appResult] = await Promise.all([
          recordLabelService.getArtistProfileByUserId(user.id),
          recordLabelService.getArtistContract(user.id),
          recordLabelService.getMyApplication(user.id),
        ])

        if (!active) return

        const artist = artistResult.data
        if (!artist) {
          toast.error('You must be an approved MAI artist to view this page.')
          navigate('/mai-record-label', { replace: true })
          return
        }

        setArtistProfile(artist)

        const contractData = contractResult.data
        if (!contractData) {
          toast.error('No active contract found. Please contact MAI Record Label staff.')
          navigate('/mai-record-label', { replace: true })
          return
        }

        setContract(contractData)
        if (contractData.status === 'active' && contractData.artist_signed_at) {
          setAccepted(true)
        }

        const application = appResult.data
        if (application) {
          setLegalName(application.legal_name || '')
        }

        const [tracksRes, albumsRes, txRes] = await Promise.all([
          recordLabelService.getArtistTracks(artist.id),
          recordLabelService.getArtistAlbums(artist.id),
          supabase
            .from('record_label_transactions')
            .select('id, transaction_type, gross_coins, artist_coins, label_coins, track_id, album_id, created_at, status')
            .eq('artist_id', artist.id)
            .order('created_at', { ascending: false })
            .limit(20),
        ])

        const trackMap = new Map<string, string>()
        const albumMap = new Map<string, string>()

        for (const t of tracksRes.data || []) {
          trackMap.set(t.id, t.title)
        }
        for (const a of albumsRes || []) {
          albumMap.set(a.id, a.title)
        }

        const applicableTracks = (tracksRes.data || [])
          .filter((t) => t.status === 'published' || t.status === 'processing')
          .map((t) => ({
            id: t.id,
            title: t.title,
            albumTitle: t.album_id ? albumMap.get(t.album_id) || null : null,
          }))

        const applicableAlbums = (albumsRes || [])
          .filter((a) => a.status === 'published')
          .map((a) => ({ id: a.id, title: a.title }))

        const transactions = (txRes.data || []).map((tx) => {
          const trackTitle = tx.track_id ? trackMap.get(tx.track_id) || null : null
          const albumTitle = tx.album_id ? albumMap.get(tx.album_id) || null : null
          return {
            date: tx.created_at,
            trackTitle: trackTitle || 'General',
            albumTitle: albumTitle || '—',
            artistName: artist.stage_name,
            grossCoins: tx.gross_coins || 0,
            artistCoins: tx.artist_coins || 0,
            labelCoins: tx.label_coins || 0,
            status: tx.status || 'pending',
            transactionType: tx.transaction_type,
          }
        })

        const agreementData: MaiRecordLabelAgreementData = {
          artistLegalName: application?.legal_name || user?.user_metadata?.full_name || user?.email || '—',
          artistStageName: artist.stage_name || artist.user_profiles?.display_name || 'Artist',
          maiTrollUserId: user.id,
          artistEmail: user?.email || '—',
          contractId: contractData.id,
          contractNumber: contractData.contract_number,
          effectiveDate: contractData.effective_at,
          agreementStatus: contractData.status,
          termsVersion: contractData.terms_version,
          tier: contractData.tier,
          artistSplitBps: contractData.artist_split_bps,
          labelSplitBps: contractData.label_split_bps,
          probationEndsAt: contractData.probation_ends_at,
          expiresAt: contractData.expires_at,
          artistSignedAt: contractData.artist_signed_at,
          maiAcceptedAt: contractData.mai_accepted_at,
          applicableTracks,
          applicableAlbums,
          transactions,
        }

        setAgreementHTML(generateMaiRecordLabelAgreement(agreementData))
      } catch (error) {
        console.error('[ArtistContractPage] Failed to load:', error)
        toast.error('Failed to load contract details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id, navigate, user])

  const handleAccept = async () => {
    if (!contract || !agreedToTerms) {
      toast.error('You must agree to the contract terms before proceeding.')
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase.rpc('accept_contract_with_notary', {
        p_contract_id: contract.id,
        p_user_id: user?.id,
        p_legal_name: legalName || user?.user_metadata?.full_name || user?.email || 'Artist',
        p_typed_signature: legalName || user?.user_metadata?.full_name || user?.email || 'Artist',
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to accept contract')

      setAccepted(true)
      toast.success('Contract accepted successfully! Welcome to MAI Record Label.')

      if (data?.contract_id) {
        const refreshed = await recordLabelService.getArtistContract(user.id)
        if (refreshed.data) {
          setContract(refreshed.data)
        }
      }
    } catch (error: any) {
      console.error('[ArtistContractPage] Accept contract failed:', error)
      toast.error(error?.message || 'Failed to accept contract. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadContract = async () => {
    if (!contract?.document_id) return

    try {
      const [docRes, sigRes, stampRes] = await Promise.all([
        supabase.from('documents').select('*').eq('id', contract.document_id).maybeSingle(),
        supabase.from('document_signatures').select('*').eq('document_id', contract.document_id).order('signed_at', { ascending: false }),
        supabase.from('document_stamps').select('*').eq('document_id', contract.document_id).eq('is_valid', true).maybeSingle(),
      ])

      if (docRes.error) throw docRes.error
      if (!docRes.data) throw new Error('Document not found')

      const doc = docRes.data as NotaryDocument
      const sigs = (sigRes.data || []) as DocumentSignature[]
      const stp = (stampRes.data || null) as DocumentStamp | null

      downloadPDF({
        document: doc,
        signatures: sigs,
        stamp: stp,
      })
    } catch (err: any) {
      console.error('Failed to download contract:', err)
      toast.error(err?.message || 'Failed to download contract')
    }
  }

  const handlePrintPDF = () => {
    if (!agreementHTML) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(agreementHTML)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 500)
    } else {
      alert('Please allow popups to print this document.')
    }
  }

  const handleDownloadHTML = () => {
    if (!agreementHTML) return
    const blob = new Blob([agreementHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MAI_Record_Label_Agreement_${contract?.contract_number || 'contract'}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-lg text-slate-300">Loading your contract...</p>
        </div>
      </div>
    )
  }

  if (!contract || !artistProfile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-lg text-slate-300">Contract not available.</p>
          <button
            onClick={() => navigate('/mai-record-label')}
            className={`mt-4 ${MaiTrollTheme.components.buttonSecondary} inline-flex items-center gap-2`}
          >
            <ArrowLeft size={18} />
            Back to MAI Record Label
          </button>
        </div>
      </div>
    )
  }

  const artistSplitPercent = (contract.artist_split_bps / 100).toFixed(0)
  const labelSplitPercent = (contract.label_split_bps / 100).toFixed(0)
  const stageName = artistProfile.stage_name || artistProfile.user_profiles?.display_name || 'Artist'

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
            <Music size={32} className="text-purple-300" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            MAI Entertainment
          </span>
          <h1 className="text-3xl font-black md:text-4xl">MAI Record Label</h1>
          <p className={`mt-2 ${MaiTrollTheme.text.muted}`}>
            Artist Contract Agreement
          </p>
        </div>

        {accepted ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-6 w-6" />
                Contract Accepted
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={MaiTrollTheme.text.secondary}>
                You have accepted contract <strong>{contract.contract_number}</strong>.
              </p>
              <p className={MaiTrollTheme.text.muted}>
                Signed on: {formatDate(contract.artist_signed_at)}
              </p>
              {contract.notarized_at && (
                <p className={MaiTrollTheme.text.muted}>
                  Notarized on: {formatDate(contract.notarized_at)}
                </p>
              )}
              <p className={MaiTrollTheme.text.muted}>
                Status: <span className="text-green-400 font-semibold capitalize">{contract.status.replace('_', ' ')}</span>
              </p>
              <div className="flex gap-3 pt-4">
                <Button onClick={handlePrintPDF} className={MaiTrollTheme.components.buttonSecondary}>
                  Print / Save as PDF
                </Button>
                <Button onClick={handleDownloadHTML} className={MaiTrollTheme.components.buttonSecondary}>
                  Download HTML
                </Button>
                {contract.document_id && (
                  <Button onClick={handleDownloadContract} className={MaiTrollTheme.components.buttonPrimary}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Notarized Contract
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Artist & Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-cyan-400" />
                  Artist Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Artist Name</p>
                  <p className="font-semibold text-white">{artistProfile.user_profiles?.display_name || user?.user_metadata?.full_name || '—'}</p>
                </div>
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Stage Name</p>
                  <p className="font-semibold text-white">{stageName}</p>
                </div>
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Contract Number</p>
                  <p className="font-mono font-semibold text-white">{contract.contract_number}</p>
                </div>
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Contract Tier</p>
                  <p className="font-semibold text-white">{TIER_LABELS[contract.tier] || contract.tier}</p>
                </div>
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Revenue Split</p>
                  <p className="font-semibold text-white">
                    Artist {artistSplitPercent}% <span className="text-slate-400">/</span> MAI {labelSplitPercent}%
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Start Date</p>
                  <p className="font-semibold text-white">{formatDate(contract.effective_at)}</p>
                </div>
                {contract.probation_ends_at && (
                  <div>
                    <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Probation End Date</p>
                    <p className="font-semibold text-white">{formatDate(contract.probation_ends_at)}</p>
                  </div>
                )}
                <div>
                  <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Terms Version</p>
                  <p className="font-mono text-sm text-slate-300">{contract.terms_version}</p>
                </div>
              </CardContent>
            </Card>

            {/* Full Agreement */}
            {agreementHTML ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 text-purple-400" />
                    Full Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                    <iframe
                      title="MAI Record Label Artist Agreement"
                      srcDoc={agreementHTML}
                      className="h-[600px] w-full rounded border border-slate-700 bg-white"
                    />
                </CardContent>
                <CardFooter>
                  <div className="flex gap-3">
                    <Button onClick={handlePrintPDF} className={MaiTrollTheme.components.buttonSecondary}>
                      Print / Save as PDF
                    </Button>
                    <Button onClick={handleDownloadHTML} className={MaiTrollTheme.components.buttonSecondary}>
                      Download HTML
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <p className="text-slate-400">Loading agreement document...</p>
                </CardContent>
              </Card>
            )}

            {/* Acceptance Form */}
            {!accepted && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-pink-400" />
                    Accept Contract
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Checkbox
                    id="agree-terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    label="I have read and agree to the contract terms"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="legal-name">Legal Name</Label>
                    <Input
                      id="legal-name"
                      type="text"
                      placeholder="Enter your full legal name"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                    <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                      Providing your legal name is recommended for contract validity.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={handleAccept}
                    disabled={submitting || !agreedToTerms}
                    className={`${MaiTrollTheme.components.buttonPrimary} w-full`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Accept Contract
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
