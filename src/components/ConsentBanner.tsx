import React from 'react';
import { X, Settings } from 'lucide-react';
import { useConsent } from '../contexts/ConsentContext';
import { ConsentPreferences } from '../lib/consent';

export default function ConsentBanner() {
  const {
    showBanner,
    setShowBanner,
    acceptAll,
    rejectNonEssential,
    updatePreferences,
    canInitializeAnalytics,
    canInitializeMarketing,
    canInitializePreferences,
  } = useConsent();

  const [expanded, setExpanded] = React.useState(false);
  const [preferences, setPreferences] = React.useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  React.useEffect(() => {
    if (showBanner && !expanded) {
      setPreferences({
        necessary: true,
        analytics: canInitializeAnalytics,
        marketing: canInitializeMarketing,
        preferences: canInitializePreferences,
      });
    }
  }, [showBanner, canInitializeAnalytics, canInitializeMarketing, canInitializePreferences, expanded]);

  const handleToggle = (category: keyof ConsentPreferences) => {
    if (category === 'necessary') return;
    const newPrefs = { ...preferences, [category]: !preferences[category] };
    setPreferences(newPrefs);
    updatePreferences(newPrefs);
  };

  const handleAcceptAll = () => {
    acceptAll();
    setExpanded(false);
  };

  const handleRejectAll = () => {
    rejectNonEssential();
    setExpanded(false);
  };

  const handleSavePreferences = () => {
    updatePreferences(preferences);
    setExpanded(false);
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:bottom-4 md:left-auto md:right-4 md:w-96"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-description"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {!expanded ? (
          <div className="p-4 md:p-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="consent-title" className="text-white font-semibold text-sm md:text-base">
                  We value your privacy
                </h3>
                <p id="consent-description" className="text-slate-400 text-xs md:text-sm mt-1">
                  We use cookies and similar technologies to enhance your experience, analyze usage, and
                  personalize content. Choose your preferences below.
                </p>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600"
              >
                Reject Non-Essential
              </button>
              <button
                onClick={() => setExpanded(true)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600"
              >
                Manage Preferences
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-base">Manage Preferences</h3>
              <button
                onClick={() => setExpanded(false)}
                className="text-slate-400 hover:text-slate-200"
                aria-label="Collapse"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Necessary cookies enable core functionality. Other categories are optional.
            </p>
            <div className="space-y-3 mb-4">
              {([
                { key: 'necessary', label: 'Necessary', desc: 'Required for authentication, security, sessions, payments, and core platform functionality.' },
                { key: 'analytics', label: 'Analytics', desc: 'Help us understand how visitors interact with the platform (Google Analytics).' },
                { key: 'marketing', label: 'Marketing', desc: 'Used to deliver personalized ads and measure campaign effectiveness.' },
                { key: 'preferences', label: 'Preferences', desc: 'Remember your settings like theme, language, and display preferences.' },
              ] as const).map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{label}</span>
                      {key === 'necessary' && (
                        <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded">Required</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={preferences[key]}
                      onChange={() => handleToggle(key)}
                      disabled={key === 'necessary'}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${
                      preferences[key] ? 'bg-purple-600' : 'bg-slate-600'
                    } peer-focus:ring-2 peer-focus:ring-purple-500/50`} />
                    <span className={`absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences[key] ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSavePreferences}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Save Preferences
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-600"
              >
                Reject Non-Essential
              </button>
            </div>
            <p className="text-slate-500 text-xs text-center mt-3">
              You can change your preferences anytime in Settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}