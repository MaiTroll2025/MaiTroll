import React, { useState } from 'react'
import { BookOpen, DollarSign, CalendarOff, Users, UserPlus, HelpCircle, AlertCircle, Mail } from 'lucide-react'

interface ResourceItem {
  id: string
  title: string
  description: string
  icon: React.ElementType
  category: string
}

const RESOURCES: ResourceItem[] = [
  {
    id: 'role-expectations',
    title: 'Role Expectations',
    description: 'Understand the duties, standards, and conduct expected for your approved role.',
    icon: Users,
    category: 'General',
  },
  {
    id: 'payroll-questions',
    title: 'Payroll Questions',
    description: 'How pay is calculated, when payouts are processed, and how to report discrepancies.',
    icon: DollarSign,
    category: 'Payroll',
  },
  {
    id: 'time-off-policy',
    title: 'Time Off Policy',
    description: 'How to request time off, approval process, and how it affects your schedule.',
    icon: CalendarOff,
    category: 'Time Off',
  },
  {
    id: 'free-agency-rules',
    title: 'Free Agency Rules',
    description: 'Rules governing agency membership, contracts, fees, and creator representation.',
    icon: BookOpen,
    category: 'Agency',
  },
  {
    id: 'staff-code-of-conduct',
    title: 'Staff Code of Conduct',
    description: 'The official code of conduct for all Mai Troll staff and role holders.',
    icon: BookOpen,
    category: 'Conduct',
  },
  {
    id: 'creator-agency-onboarding',
    title: 'Creator/Agency Onboarding',
    description: 'Step-by-step guide for joining or creating an agency on Mai Troll.',
    icon: UserPlus,
    category: 'Onboarding',
  },
  {
    id: 'support-contact',
    title: 'Support Contact',
    description: 'Reach out to HR for questions, disputes, or assistance with your role.',
    icon: Mail,
    category: 'Support',
  },
  {
    id: 'tromail',
    title: 'TrolMail (Internal Email)',
    description: 'Send and receive internal emails, calendar events, and team meetings via TrolMail.',
    icon: Mail,
    category: 'Communication',
  },
]

const RESOURCE_CONTENT: Record<string, string[]> = {
  'role-expectations': [
    'Fulfill the duties outlined in your role description on the Jobs page.',
    'Maintain regular availability as expected by your department or agency.',
    'Follow all Mai Troll rules, safety guidelines, and code of conduct.',
    'Participate in required training, meetings, or briefings.',
    'Escalate issues to HR/Admin when they exceed your authority.',
  ],
  'payroll-questions': [
    'Pay is calculated based on verified clock-in/out records from the HR Center time clock.',
    'Base pay rates are set by HR/Admin and may vary by role, department, or seniority.',
    'Bonuses may be awarded for exceptional performance, special events, or leadership.',
    'Payroll is processed on a regular schedule by the HR/Admin team.',
    'If you believe there is a discrepancy, contact HR through the support channel.',
  ],
  'time-off-policy': [
    'Submit time off requests through the Time Off tab in HR Center.',
    'Requests are reviewed by HR/Admin and approved or rejected based on coverage needs.',
    'Approved time off will remove your scheduled shifts for those dates.',
    'Plan ahead — last-minute requests may not be guaranteed approval.',
    'Excessive unapproved absences may affect your role status.',
  ],
  'free-agency-rules': [
    'Agencies operate under the oversight of Agency HR Managers and Mai Troll Admin.',
    'Agency fees and platform fees are set in agency settings and contracts.',
    'Creators are free to leave agencies according to their contract terms.',
    'Disputes between creators and agencies are mediated by Agency HR or Mai Troll Admin.',
    'All agency operations must comply with Mai Troll platform rules.',
  ],
  'staff-code-of-conduct': [
    'Treat all users, colleagues, and community members with respect.',
    'Do not abuse role powers, moderation tools, or access privileges.',
    'Maintain confidentiality of sensitive information encountered in your role.',
    'Report violations, concerns, or conflicts of interest to HR.',
    'Represent Mai Troll with integrity in all official interactions.',
  ],
  'creator-agency-onboarding': [
    'Apply to an agency through the Agencies page or receive an invitation from an Agency Leader.',
    'Review and sign the agency contract outlining fees, responsibilities, and terms.',
    'Complete any required onboarding steps set by the agency leader.',
    'Once onboarded, you gain access to agency tools, roster, and collaborative features.',
    'Contact Agency HR for onboarding questions or issues.',
  ],
  'support-contact': [
    'For HR questions, payroll disputes, or role issues, contact the HR team.',
    'Use the official support channels — do not share sensitive information publicly.',
    'Include your user ID, a clear description, and any relevant evidence in your message.',
    'HR aims to respond within 48 hours for non-urgent matters.',
    'For emergencies or urgent safety concerns, use the in-platform emergency report tools.',
  ],
  'tromail': [
    'TrolMail is Mai Troll\'s internal email and communication system for approved role holders.',
    'Access TrolMail at /utromail or /tromail to send messages, create calendar events, and schedule team meetings.',
    'HR managers can use TrolMail to communicate with staff, send notices, and coordinate role-related matters.',
    'All TrolMail messages are internal to Mai Troll and are not accessible to regular users without approved roles.',
    'Use TrolMail for official HR communication — do not share sensitive HR information through public channels.',
  ],
  'reporting-issues': [
    'Report bugs through the official bug report tool or support contact.',
    'Report rule violations, harassment, or safety concerns through the report system.',
    'Include as much detail as possible: what happened, when, who was involved, and any evidence.',
    'False reports are a violation of platform rules and may result in action against the reporter.',
    'Serious issues may be escalated to admin or law enforcement if appropriate.',
  ],
}

export default function HRResourcesPanel() {
  const [selectedResource, setSelectedResource] = useState<string | null>(null)

  const categories = Array.from(new Set(RESOURCES.map(r => r.category)))
  const selected = RESOURCES.find(r => r.id === selectedResource)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">HR Resources</h3>
        <p className="text-xs text-slate-400">
          Quick access to policies, guides, and support for all HR-related topics.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <span key={cat} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {cat}
          </span>
        ))}
      </div>

      {!selected ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {RESOURCES.map(resource => {
            const Icon = resource.icon
            return (
              <button
                key={resource.id}
                type="button"
                onClick={() => setSelectedResource(resource.id)}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-xl transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{resource.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{resource.description}</p>
                    <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                      {resource.category}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelectedResource(null)}
            className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
          >
            ← Back to Resources
          </button>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              {selected && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10">
                    <selected.icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <h4 className="text-base font-black text-white">{selected.title}</h4>
                </>
              )}
            </div>
            <ul className="space-y-2">
              {(RESOURCE_CONTENT[selected?.id || ''] || []).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
