import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Shield, Lock, DollarSign, CheckCircle, Eye, Award } from 'lucide-react'

interface Props {
  institutionId: string
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
}

interface Settings {
  ferpa_mode_enabled: boolean
  restricted_mode: boolean
  audit_data_access: boolean
  require_annual_privacy_agreement: boolean
}

export default function TrustBadges({ institutionId, size = 'md', showLabels = true }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    const fetch = async () => {
      if (!institutionId) return
      try {
        const { data } = await supabase.rpc('get_institution_privacy_settings', {
          p_institution_id: institutionId
        })
        if (data) setSettings(data)
      } catch (err) {
        console.error('Error fetching trust badge settings:', err)
      }
    }
    fetch()
  }, [institutionId])

  const iconSize = size === 'sm' ? 'size-3' : size === 'lg' ? 'size-6' : 'size-4'
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'lg' ? 'px-4 py-2' : 'px-3 py-1.5'

  const badges = [
    {
      label: 'FERPA Compliant',
      icon: Shield,
      color: 'text-green-400',
      bg: 'bg-green-600/10',
      border: 'border-green-500/30',
      active: settings?.ferpa_mode_enabled ?? true,
    },
    {
      label: 'Privacy Audited',
      icon: Lock,
      color: 'text-blue-400',
      bg: 'bg-blue-600/10',
      border: 'border-blue-500/30',
      active: settings?.audit_data_access ?? true,
    },
    {
      label: 'Financial Transparency',
      icon: DollarSign,
      color: 'text-purple-400',
      bg: 'bg-purple-600/10',
      border: 'border-purple-500/30',
      active: true,
    },
    {
      label: 'Zero Tax Liability',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-600/10',
      border: 'border-emerald-500/30',
      active: true,
    },
    {
      label: 'Brand Protected',
      icon: Eye,
      color: 'text-cyan-400',
      bg: 'bg-cyan-600/10',
      border: 'border-cyan-500/30',
      active: true,
    },
    {
      label: 'Verified',
      icon: Award,
      color: 'text-yellow-400',
      bg: 'bg-yellow-600/10',
      border: 'border-yellow-500/30',
      active: true,
    },
  ]

  if (!settings) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-8 h-8 bg-white/5 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => {
        const Icon = badge.icon
        return (
          <div
            key={badge.label}
            className={`flex items-center gap-1.5 ${padding} rounded-lg border ${badge.bg} ${badge.border} ${badge.active ? 'opacity-100' : 'opacity-50'}`}
            title={badge.label}
          >
            <Icon className={`${iconSize} ${badge.color}`} />
            {showLabels && (
              <span className={`text-xs font-semibold ${badge.color}`}>
                {badge.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
