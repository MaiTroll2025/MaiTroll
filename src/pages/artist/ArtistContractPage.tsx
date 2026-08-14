import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Loader2,
  Music,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ContractTier = 'probation' | 'standard' | 'tier_90_10' | 'tier_95_5'

const TIER_LABELS: Record<ContractTier, string> = {
  probation: 'Probation',
  standard: 'Standard',
  tier_90_10: '90/10 Tier',
  tier_95_5: '95/5 Tier',
}

const PLACEHOLDER_TERMS = `This agreement is entered into between MAI Record Label ("Label") and the Artist identified below. By accepting this contract, the Artist agrees to the following terms:

1. The Artist grants the Label exclusive rights to distribute, promote, and monetize the Artist's original recordings submitted during the term of this agreement.
2. Revenue generated from eligible streaming, downloads, and licensing activities shall be split according to the percentages specified in this contract.
3. The Artist warrants that all submitted content is original and that the Artist holds all necessary rights and clearances.
4. The Label shall provide marketing support, distribution infrastructure, and administrative services as outlined in the Artist responsibilities.
5. Either party may terminate this agreement subject to the conditions described herein.`

const ARTIST_RESPONSIBILITIES = [
  'Deliver high-quality, mastered audio recordings in the formats specified by the Label.',
  'Provide accurate metadata, artwork, and promotional materials for all releases.',
  'Maintain original ownership of all content submitted and warrant against third-party claims.',
  'Cooperate with the Label on marketing, promotional, and licensing opportunities.',
  'Notify the Label promptly of any changes to contact information or payout details.',
  'Abide by the Label\'s content guidelines and platform policies.',
]

const MAI_RESPONSIBILITIES = [
  'Distribute submitted recordings to all major streaming and digital platforms.',
  'Provide transparent monthly statements detailing streams, revenue, and splits.',
  'Process artist payouts according to the schedule outlined in this agreement.',
  'Offer marketing support and promotional placement opportunities where applicable.',
  'Protect the Artist\'s content from unauthorized distribution through Label channels.',
  'Maintain confidentiality of the Artist\'s personal and financial information.',
]

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

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!user?.id) {
        navigate('/auth', { replace: true })
        return
      }

      try {
        setLoading(true)

        const [artistResult, contractResult] = await Promise.all([
          recordLabelService.getArtistProfileByUserId(user.id),
          recordLabelService.getArtistContract(user.id),
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
  }, [user?.id, navigate])

  const handleAccept = async () => {
    if (!contract || !agreedToTerms) {
      toast.error('You must agree to the contract terms before proceeding.')
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await recordLabelService.acceptContract(contract.id)

      if (error) throw error

      setAccepted(true)
      toast.success('Contract accepted successfully! Welcome to MAI Record Label.')

      if (data) {
        setContract(data)
      }
    } catch (error: any) {
      console.error('[ArtistContractPage] Accept contract failed:', error)
      toast.error(error?.message || 'Failed to accept contract. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
              <p className={MaiTrollTheme.text.muted}>
                Status: <span className="text-green-400 font-semibold capitalize">{contract.status.replace('_', ' ')}</span>
              </p>
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

            {/* Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-purple-400" />
                  Contract Terms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {PLACEHOLDER_TERMS}
                </pre>
              </CardContent>
            </Card>

            {/* Responsibilities */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCheck className="h-5 w-5 text-green-400" />
                    Artist Responsibilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {ARTIST_RESPONSIBILITIES.map((item, index) => (
                      <li key={index} className="flex gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-cyan-400" />
                    MAI Responsibilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {MAI_RESPONSIBILITIES.map((item, index) => (
                      <li key={index} className="flex gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

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
                    <Label htmlFor="legal-name">Legal Name (optional)</Label>
                    <Input
                      id="legal-name"
                      type="text"
                      placeholder="Enter your full legal name"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                    <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                      Providing your legal name is optional but recommended for contract validity.
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
