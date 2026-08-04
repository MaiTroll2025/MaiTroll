/**
 * InstallButton Component
 * Unified PWA install button for Android (native prompt) and iOS (instruction modal)
 */

import React, { useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';
import { useInstallPrompt } from '../pwa/useInstallPrompt';
import { getInstallStatus, type InstallStatus } from '../pwa/install';
import IosInstallModal from './IosInstallModal';
import { toast } from 'sonner';

interface InstallButtonProps {
  /** Custom className for styling */
  className?: string;
  
  /** Show as compact icon-only button */
  compact?: boolean;
  
  /** Custom text for the button */
  text?: string;
  
  /** Hide button when app is installed (default: true) */
  hideWhenInstalled?: boolean;
  
  /** Show "Installed" badge instead of hiding (default: false) */
  showInstalledBadge?: boolean;
}

export default function InstallButton({
  className = '',
  compact = false,
  text = 'Install App',
  hideWhenInstalled = true,
  showInstalledBadge = false,
}: InstallButtonProps) {
  const { canPromptInstall, promptInstall, isInstalling } = useInstallPrompt();
  const [showIosModal, setShowIosModal] = useState(false);
  
  const installStatus: InstallStatus = getInstallStatus(canPromptInstall);

  // Handle button click based on platform
  const handleClick = async () => {
    switch (installStatus) {
      case 'installed': {
        toast.info('App is already installed!');
        break;
      }

      case 'prompt-available': {
        // Android/Chrome: Show native install prompt
        const outcome = await promptInstall();
        if (outcome === 'accepted') {
          toast.success('Thanks for installing Mai Troll!');
        } else if (outcome === 'dismissed') {
          toast.info('You can install later from your browser menu');
        }
        break;
      }

      case 'ios-manual': {
        // iOS Safari: Show manual "Add to Home Screen" instructions
        setShowIosModal(true);
        break;
      }

      case 'unsupported': {
        // Desktop or unsupported — try prompt anyway in case the event fired
        // after our initial check, then fall back to browser menu instructions
        if (canPromptInstall) {
          const outcome = await promptInstall();
          if (outcome === 'accepted') {
            toast.success('Thanks for installing Mai Troll!');
          }
        } else {
          toast.info('Look for the install icon ⊡ in Chrome/Edge menu (three dots)');
        }
        break;
      }
    }
  };

  // Hide button if installed and hideWhenInstalled is true
  if (installStatus === 'installed' && hideWhenInstalled && !showInstalledBadge) {
    return null;
  }

  // Show "Installed" badge
  if (installStatus === 'installed' && showInstalledBadge) {
    return (
      <button
        disabled
        className={`
          flex items-center gap-2 px-4 py-2 rounded-xl
          bg-green-600/20 border border-green-500/30 text-green-400
          cursor-default
          ${className}
        `}
      >
        <CheckCircle size={18} />
        {!compact && <span className="font-medium">Installed</span>}
      </button>
    );
  }

  // Determine button style based on platform
  const getButtonStyle = () => {
    switch (installStatus) {
      case 'prompt-available':
        return 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/30';
      case 'ios-manual':
        return 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/30';
      case 'mobile-installable':
        return 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/30';
      case 'unsupported':
        return 'bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:bg-slate-700';
      default:
        return 'bg-slate-700/50 border border-slate-600/50 text-slate-400';
    }
  };

  // Button title/tooltip
  const getButtonTitle = () => {
    if (installStatus === 'installed') return 'App is installed';
    if (installStatus === 'prompt-available') return 'Install Mai Troll';
    if (installStatus === 'ios-manual') return 'See installation instructions';
    if (installStatus === 'mobile-installable') return 'Install Mai Troll';
    return 'Install not available';
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isInstalling}
        className={`
          flex items-center gap-2 rounded-xl font-semibold
          transition-all active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? 'p-2' : 'px-4 py-2'}
          ${getButtonStyle()}
          ${className}
        `}
        title={getButtonTitle()}
      >
        {isInstalling ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {!compact && <span>Installing...</span>}
          </>
        ) : (
          <>
            <Download size={18} />
            {!compact && <span>{text}</span>}
          </>
        )}
      </button>

      {/* iOS Install Instructions Modal */}
      <IosInstallModal
        isOpen={showIosModal}
        onClose={() => setShowIosModal(false)}
        enableDontShowAgain={true}
      />
    </>
  );
}