import React from 'react';
import { useConsent } from '../contexts/ConsentContext';
import { ConsentPreferences } from '../lib/consent';
import { Shield, BarChart3, Share2, Settings, RefreshCw, Download, Trash2 } from 'lucide-react';

export default function PrivacySettings() {
  const {
    consent,
    acceptAll,
    rejectNonEssential,
    updatePreferences,
    resetConsent,
    canInitializeAnalytics,
    canInitializeMarketing,
    canInitializePreferences,
  } = useConsent();

  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const currentPrefs = consent?.preferences || {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  };

  const handleToggle = (category: keyof ConsentPreferences) => {
    if (category === 'necessary') return;
    updatePreferences({ [category]: !currentPrefs[category] });
  };

  const handleResetConfirm = () => {
    resetConsent();
    setShowResetConfirm(false);
  };

  const exportConsent = () => {
    const data = {
      consent: consent,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maitroll-consent-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryInfo = [
    {
      key: 'necessary' as const,
      icon: Shield,
      title: 'Necessary',
      description:
        'Essential cookies and data required for authentication, security, session management, payments, broadcasting, notifications, and core platform functionality.',
      alwaysOn: true,
    },
    {
      key: 'analytics' as const,
      icon: BarChart3,
      title: 'Analytics',
      description:
        'Help us understand how visitors interact with the platform. Includes Google Analytics, telemetry events, error reporting, and usage statistics.',
      alwaysOn: false,
      enabled: canInitializeAnalytics,
    },
    {
      key: 'marketing' as const,
      icon: Share2,
      title: 'Marketing',
      description:
        'Used to deliver personalized advertisements and measure the effectiveness of marketing campaigns.',
      alwaysOn: false,
      enabled: canInitializeMarketing,
    },
    {
      key: 'preferences' as const,
      icon: Settings,
      title: 'Preferences',
      description:
        'Remember your settings like theme, language, and display preferences to enhance your experience.',
      alwaysOn: false,
      enabled: canInitializePreferences,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 text-slate-200">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Privacy & Cookie Settings</h1>
        <p className="text-slate-400 text-sm">
          Manage your consent preferences for cookies and tracking technologies used on MaiTroll.
        </p>
      </div>

      <div className="space-y-4">
        {categoryInfo.map((cat) => {
          const Icon = cat.icon;
          const isOn = cat.alwaysOn || cat.enabled;
          return (
            <div
              key={cat.key}
              className="flex items-start gap-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Icon className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium">{cat.title}</h3>
                  {cat.alwaysOn && (
                    <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded">
                      Always Active
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">{cat.description}</p>
              </div>
              {!cat.alwaysOn && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => handleToggle(cat.key)}
                    className="sr-only peer"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${
                      isOn ? 'bg-purple-600' : 'bg-slate-600'
                    } peer-focus:ring-2 peer-focus:ring-purple-500/50`}
                  />
                  <span
                    className={`absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform ${
                      isOn ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={acceptAll}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          Accept All
        </button>
        <button
          onClick={rejectNonEssential}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600 flex items-center justify-center gap-2"
        >
          Reject Non-Essential
        </button>
        <button
          onClick={exportConsent}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Consent Data
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-5 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium rounded-lg text-sm transition-colors border border-red-600/30 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Consent Preferences
        </button>
        <p className="text-slate-500 text-xs mt-2">
          Resetting will clear your current preferences and display the cookie consent banner again.
        </p>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Reset Consent Preferences?</h3>
            <p className="text-slate-400 text-sm mb-4">
              This will clear your current cookie consent choice and show the consent banner again.
              You will need to select your preferences again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
