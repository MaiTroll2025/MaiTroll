import React from 'react'
import { BookOpen, Shield, DollarSign, AlertTriangle, Users, FileText, Scale, Lock } from 'lucide-react'

interface HandbookSection {
  id: string
  title: string
  icon: React.ElementType
  content: string[]
}

const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    id: 'company-rules',
    title: 'Company Rules & Expectations',
    icon: Shield,
    content: [
      'All approved role holders must adhere to the Mai Troll Code of Conduct at all times.',
      'Misuse of role permissions, moderation tools, or platform systems will result in immediate suspension and potential permanent removal.',
      'Role holders represent Mai Troll and must maintain professional conduct in all official interactions.',
      'Confidential information encountered during role duties must not be shared externally.',
      'Failure to clock in/out accurately may affect payroll processing.',
    ],
  },
  {
    id: 'role-expectations',
    title: 'Role Expectations',
    icon: Users,
    content: [
      'Troll Officers must respond to reports within their assigned jurisdiction and maintain accurate logs.',
      'Pastors must provide respectful spiritual guidance and officiate church events with integrity.',
      'Agency HR Managers must review applications promptly and maintain fair, consistent standards.',
      'Secretaries must handle administrative tasks with accuracy and discretion.',
      'All leadership roles (Lead Officer, Agency Leader, CEO Assistant) must mentor junior staff and model platform values.',
    ],
  },
  {
    id: 'payout-rules',
    title: 'Payout & Compensation Rules',
    icon: DollarSign,
    content: [
      'Payroll is processed internally by Mai Troll\'s proprietary payroll system.',
      'Base pay is calculated from verified clock-in/out records and approved shift hours.',
      'Bonuses may be awarded for exceptional performance, special events, or leadership contributions.',
      'Deductions may apply for policy violations, fines, or administrative actions as determined by HR/Admin.',
      'Payout status and history are visible in the Payroll tab of HR Center.',
      'Payroll disputes must be submitted through HR Center resources.',
    ],
  },
  {
    id: 'conduct-rules',
    title: 'Code of Conduct',
    icon: Scale,
    content: [
      'Treat all community members with respect and professionalism.',
      'Do not engage in harassment, discrimination, hate speech, or bullying.',
      'Do not use role powers for personal gain, favoritism, or retaliation.',
      'Report violations through official HR or admin channels.',
      'Spamming, trolling outside of entertainment roles, and disruptive behavior are prohibited.',
      'Content must comply with platform safety guidelines and applicable laws.',
    ],
  },
  {
    id: 'platform-safety',
    title: 'Platform Safety & Security',
    icon: Lock,
    content: [
      'Never share your account credentials, 2FA codes, or session tokens.',
      'Report suspicious activity, phishing attempts, or security vulnerabilities immediately.',
      'Do not attempt to bypass moderation actions, bans, or access restrictions.',
      'Personal information of other users must not be collected, stored, or shared without consent.',
      'Use of bots, automation, or unauthorized third-party tools is prohibited unless explicitly approved.',
    ],
  },
  {
    id: 'anti-fraud',
    title: 'Anti-Fraud & Integrity Rules',
    icon: AlertTriangle,
    content: [
      'Clocking in/out on behalf of another user is strictly prohibited and will result in permanent role removal.',
      'Manipulating payroll records, hours, or payout amounts is fraud and will be prosecuted.',
      'Submitting false information in applications or HR forms is grounds for immediate rejection and potential ban.',
      'Collusion between role holders to exploit systems or bypass controls is a serious violation.',
      'All HR actions are audited. Mai Troll maintains logs of all approvals, rejections, and role changes.',
    ],
  },
  {
    id: 'violation-policy',
    title: 'Violation Policy & Enforcement',
    icon: FileText,
    content: [
      'Violations are reviewed by HR/Admin on a case-by-case basis.',
      'Minor violations may result in a warning or temporary suspension of role privileges.',
      'Serious violations (fraud, abuse, harassment) result in immediate and permanent removal.',
      'Users may appeal enforcement actions through the HR Resources contact channel.',
      'Repeated violations, even minor ones, may escalate to permanent platform removal.',
      'HR/Admin decisions on violations are final unless overturned by a higher authority.',
    ],
  },
]

export default function HandbookPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">Handbook & Rules</h3>
        <p className="text-xs text-slate-400">
          Mai Troll internal handbook covering rules, expectations, and policies for all approved role holders.
        </p>
      </div>

      <div className="rounded-3xl border border-cyan-300/10 bg-cyan-500/5 p-4">
        <p className="text-xs text-cyan-200">
          <BookOpen className="mr-1 inline h-3.5 w-3.5" />
          This handbook applies to all Mai Troll staff, contractors, agency members, moderators, creators, officers, court officials, pastors, and internal platform roles.
        </p>
      </div>

      <div className="space-y-3">
        {HANDBOOK_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <details
              key={section.id}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            >
              <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-bold text-white transition hover:text-cyan-300">
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-cyan-400" />
                  {section.title}
                </span>
                <span className="text-slate-500 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-white/10 px-5 pb-5 pt-3">
                <ul className="space-y-2">
                  {section.content.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
