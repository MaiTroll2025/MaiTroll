import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { CheckCircle, ChevronRight, ChevronLeft, Shield, FileText, DollarSign, Users, Bell, Award } from 'lucide-react'

interface WizardStep {
  id: number
  title: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 1, title: 'FERPA Guidelines', icon: Shield },
  { id: 2, title: 'Moderation Preferences', icon: FileText },
  { id: 3, title: 'Financial Transparency', icon: DollarSign },
  { id: 4, title: 'Authorized Broadcasters', icon: Users },
  { id: 5, title: 'Designate Compliance Officer', icon: Bell },
  { id: 6, title: 'Export Setup Certificate', icon: Award },
]

export default function SetupWizard() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [completed, setCompleted] = useState(false)

  const [ferpa, setFerpa] = useState({
    ferpa_mode_enabled: true,
    restricted_mode: true,
    require_annual_privacy_agreement: true,
    privacy_agreement_version: '1.0',
  })
  const [rules, setRules] = useState('')
  const [financial, setFinancial] = useState({
    require_student_opt_out: true,
    audit_data_access: true,
  })
  const [complianceOfficer, setComplianceOfficer] = useState('')

  useEffect(() => {
    const fetch = async () => {
      if (!user) return
      try {
        const { data: staff } = await supabase
          .from('institution_staff')
          .select('*, institutions(name, id)')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          setInstitutionId(staff.institutions.id)
          setInstitutionName(staff.institutions.name)
        }
      } catch (err) {
        console.error('Error fetching institution:', err)
      }
    }
    fetch()
  }, [user])

  const handleNext = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleComplete = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await supabase.rpc('update_institution_privacy_settings', {
        p_institution_id: institutionId,
        p_ferpa_mode_enabled: ferpa.ferpa_mode_enabled,
        p_restricted_mode: ferpa.restricted_mode,
        p_require_annual_privacy_agreement: ferpa.require_annual_privacy_agreement,
        p_privacy_agreement_version: ferpa.privacy_agreement_version,
        p_audit_data_access: financial.audit_data_access,
        p_allow_student_opt_out: financial.require_student_opt_out,
      })
      setCompleted(true)
    } catch (err) {
      console.error('Error saving setup:', err)
    } finally {
      setSaving(false)
    }
  }

  const progress = (currentStep / STEPS.length) * 100
  return (
    <SchoolLayout requiredRole="institution_staff">
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType="institution_staff"
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Institution Setup Wizard"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="max-w-4xl mx-auto p-4 md:p-6">
            {completed ? (
              <div className="text-center py-12">
                <CheckCircle className="size-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
                <p className="text-white/60">Your institution is now configured with full FERPA compliance, moderation controls, and financial transparency.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Progress Bar */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">
                      Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.title}
                    </h2>
                    <span className="text-white/60 text-sm">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-[#6366f1] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-4">
                    {STEPS.map((step) => {
                      const Icon = step.icon
                      const isComplete = step.id < currentStep
                      const isCurrent = step.id === currentStep
                      return (
                        <div key={step.id} className="flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                            isComplete ? 'bg-green-600' : isCurrent ? 'bg-[#6366f1]' : 'bg-white/10'
                          }`}>
                            {isComplete ? (
                              <CheckCircle className="size-4 text-white" />
                            ) : (
                              <Icon className="size-4 text-white" />
                            )}
                          </div>
                          <span className="text-xs text-white/60 hidden md:block">{step.title}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Step Content */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className="size-5 text-green-400" />
                        FERPA Guidelines
                      </h3>
                      <p className="text-white/70 text-sm">
                        Configure your institution's FERPA compliance settings.
                      </p>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ferpa.ferpa_mode_enabled}
                          onChange={(e) => setFerpa({ ...ferpa, ferpa_mode_enabled: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Enable FERPA mode (recommended)</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ferpa.restricted_mode}
                          onChange={(e) => setFerpa({ ...ferpa, restricted_mode: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Restricted mode (only institution members see student data)</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ferpa.require_annual_privacy_agreement}
                          onChange={(e) => setFerpa({ ...ferpa, require_annual_privacy_agreement: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Require annual privacy agreement from instructors</span>
                      </label>
                    </div>
                  )}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText className="size-5 text-purple-400" />
                        Moderation Preferences
                      </h3>
                      <p className="text-white/70 text-sm">
                        Set your institution's code of conduct rules.
                      </p>
                      <textarea
                        value={rules}
                        onChange={(e) => setRules(e.target.value)}
                        rows={6}
                        placeholder={'Rule 1: No harassment or bullying\nRule 2: No explicit content\nRule 3: No hate speech\nRule 4: No spam'}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none"
                      />
                      <p className="text-white/40 text-xs">These rules will be referenced when filing incidents.</p>
                    </div>
                  )}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <DollarSign className="size-5 text-blue-400" />
                        Financial Transparency
                      </h3>
                      <p className="text-white/70 text-sm">
                        Configure financial transparency settings. Students own their earnings; schools have zero tax liability.
                      </p>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={financial.require_student_opt_out}
                          onChange={(e) => setFinancial({ ...financial, require_student_opt_out: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Allow students to opt out of earnings tracking</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={financial.audit_data_access}
                          onChange={(e) => setFinancial({ ...financial, audit_data_access: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Audit all financial data access by staff</span>
                      </label>
                      <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                        <p className="text-white/80 text-sm">
                          <strong>100% of tips go directly to students.</strong> The school has no financial liability for student tax reporting. All payouts are processed as independent student earnings.
                        </p>
                      </div>
                    </div>
                  )}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="size-5 text-cyan-400" />
                        Authorized Broadcasters
                      </h3>
                      <p className="text-white/70 text-sm">
                        Designate which students are authorized to broadcast under your institution's name. Instructors can report rule violations to the moderation engine.
                      </p>
                      <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-lg p-4">
                        <p className="text-white/80 text-sm">
                          <strong>How it works:</strong> Students broadcast under their own name. Instructors file incidents through the Incidents panel, which routes to the moderation engine for career/mod action. The school maintains a complete compliance trail.
                        </p>
                      </div>
                    </div>
                  )}
                  {currentStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Bell className="size-5 text-yellow-400" />
                        Designate Compliance Officer
                      </h3>
                      <p className="text-white/70 text-sm">
                        Designate the staff member responsible for compliance oversight.
                      </p>
                      <input
                        type="text"
                        value={complianceOfficer}
                        onChange={(e) => setComplianceOfficer(e.target.value)}
                        placeholder="Enter compliance officer name"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  )}
                  {currentStep === 6 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Award className="size-5 text-green-400" />
                        Export Setup Certificate
                      </h3>
                      <p className="text-white/70 text-sm">
                        Your institution is ready. Review your configuration summary and complete setup.
                      </p>
                      <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-4">
                        <h4 className="text-white font-semibold mb-2">Configuration Summary</h4>
                        <ul className="text-white/70 text-sm space-y-1">
                          <li>✓ FERPA Mode: {ferpa.ferpa_mode_enabled ? 'Enabled' : 'Disabled'}</li>
                          <li>✓ Restricted Mode: {ferpa.restricted_mode ? 'Enabled' : 'Disabled'}</li>
                          <li>✓ Annual Privacy Agreement: {ferpa.require_annual_privacy_agreement ? 'Required' : 'Optional'}</li>
                          <li>✓ Financial Audit: {financial.audit_data_access ? 'Enabled' : 'Disabled'}</li>
                          <li>✓ Student Opt-Out: {financial.require_student_opt_out ? 'Allowed' : 'Not Allowed'}</li>
                          <li>✓ Compliance Officer: {complianceOfficer || 'Not set'}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </button>
                  <span className="text-white/60 text-sm">
                    {institutionName || 'Your Institution'}
                  </span>
                  {currentStep === STEPS.length ? (
                    <button
                      onClick={handleComplete}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 text-white rounded-lg border border-green-500/50 transition disabled:opacity-50"
                    >
                      <CheckCircle className="size-4" />
                      {saving ? 'Completing...' : 'Complete Setup'}
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-2 px-4 py-2 bg-[#6366f1]/30 hover:bg-[#6366f1]/40 text-white rounded-lg border border-[#6366f1]/50 transition"
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
