/**
 * InstallButton Component
 * Unified PWA install button for Android (native prompt) and iOS (instruction modal)
 */


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
  className: _className = '',
  compact: _compact = false,
  text: _text = 'Install App',
  hideWhenInstalled: _hideWhenInstalled = true,
  showInstalledBadge: _showInstalledBadge = false,
}: InstallButtonProps) {
  return null;
}