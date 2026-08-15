import React from 'react'
import { Shield, Check, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SLA_TIER_CONFIG, SlaTierName, StreamSlaStatus } from '../hooks/useSlaStatus'

interface SlaBadgeProps {
  tier: SlaTierName
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function SlaBadge({
  tier,
  showLabel = true,
  size = 'sm',
  className,
}: SlaBadgeProps) {
  const config = SLA_TIER_CONFIG[tier]
  if (!config) return null

  const sizeClasses = {
    sm: 'h-5 px-1.5 text-[9px]',
    md: 'h-6 px-2 text-xs',
    lg: 'h-7 px-3 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-black',
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: config.color + '20',
        color: config.color,
        border: `1px solid ${config.color}40`,
        boxShadow: `0 0 8px ${config.glow}`,
      }}
      title={`SLA Tier: ${config.label} (min ${config.minUptime}% uptime)`}
    >
      <Shield className="h-2.5 w-2.5" />
      {showLabel && config.label}
    </span>
  )
}

interface SlaStatusIndicatorProps {
  slaStatus: StreamSlaStatus | null
  className?: string
}

export function SlaStatusIndicator({ slaStatus, className }: SlaStatusIndicatorProps) {
  if (!slaStatus) return null

  const isCompliant = slaStatus.sla_actual_uptime_pct >= slaStatus.sla_target_uptime_pct
  const hasViolations = slaStatus.violation_count > 0

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-1.5',
      className
    )}>
      <div className="flex items-center gap-1.5">
        <div className={cn(
          'h-2 w-2 rounded-full',
          isCompliant ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400',
          hasViolations && 'bg-rose-400'
        )} />
        <span className="text-xs font-bold text-cyan-300">
          SLA {slaStatus.sla_tier === 'none' ? 'None' : slaStatus.sla_tier.toUpperCase()}
        </span>
      </div>
      <div className="text-xs text-slate-400">
        {slaStatus.sla_actual_uptime_pct.toFixed(1)}%
        <span className="text-slate-500"> / </span>
        {slaStatus.sla_target_uptime_pct.toFixed(1)}%
      </div>
      {hasViolations > 0 && (
        <span className="text-xs text-rose-400 font-bold">⚠ {slaStatus.violation_count}</span>
      )}
    </div>
  )
}

interface SlaGuaranteeItemProps {
  icon: React.ElementType
  label: string
  value: string
  compliant: boolean
}

function SlaGuaranteeItem({ icon: Icon, label, value, compliant }: SlaGuaranteeItemProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] p-2">
      <div className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md',
        compliant ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-slate-400 uppercase">{label}</span>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      {compliant && <Check className="h-3 w-3 text-emerald-400 ml-auto self-center" />}
    </div>
  )
}

interface SlaGuaranteesCardProps {
  tierName: string
  uptimeGuarantee: number
  qualityGuarantee: string
  chatPriority: 'standard' | 'priority' | 'vip_only'
  supportResponseSecs: number
  features: string[]
  className?: string
}

export function SlaGuaranteesCard({
  tierName,
  uptimeGuarantee,
  qualityGuarantee,
  chatPriority,
  supportResponseSecs,
  features,
  className,
}: SlaGuaranteesCardProps) {
  const supportMins = Math.floor(supportResponseSecs / 60)

  return (
    <div className={cn(
      'rounded-xl border border-cyan-400/20 bg-slate-900/60 p-3',
      className
    )}>
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-bold uppercase text-cyan-300">SLA: {tierName}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SlaGuaranteeItem
          icon={TrendingUp}
          label="Uptime"
          value={`${uptimeGuarantee}%`}
          compliant={uptimeGuarantee >= 99.0}
        />
        <SlaGuaranteeItem
          icon={Shield}
          label="Quality"
          value={qualityGuarantee}
          compliant={qualityGuarantee !== 'none'}
        />
        <SlaGuaranteeItem
          icon={Shield}
          label="Chat Priority"
          value={chatPriority}
          compliant={chatPriority !== 'standard'}
        />
        <SlaGuaranteeItem
          icon={Shield}
          label="Support"
          value={supportMins > 0 ? `<${supportMins}m` : 'N/A'}
          compliant={supportResponseSecs <= 3600}
        />
      </div>

      {features.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] font-medium text-slate-400 uppercase">Guaranteed Features</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {features.map((feature) => (
              <span
                key={feature}
                className="text-[9px] font-medium text-slate-300 bg-white/[0.05] border border-white/5 rounded-full px-1.5 py-0.5"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
