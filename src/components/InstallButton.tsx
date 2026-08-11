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
  return null;
}