import React, { useState } from 'react';
import { Button } from '../ui/button';

interface SeatRequestModalProps {
  isOpen: boolean;
  isApproved: boolean;
  isDenied?: boolean;
  denyReason?: string;
  seatIndex?: number;
  broadcasterName?: string;
  isConnecting?: boolean;
  error?: string;
  onAccept: () => void;
  onDeny: () => void;
  onClose: () => void;
}

/**
 * Modal shown to viewer when their seat request is approved
 * Explains that camera/mic will turn on and shows permission dialog flow
 */
export function SeatRequestModal({
  isOpen,
  isApproved,
  isDenied,
  denyReason,
  seatIndex,
  broadcasterName,
  isConnecting,
  error,
  onAccept,
  onDeny,
  onClose,
}: SeatRequestModalProps) {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  // Denied state
  if (isDenied) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
          <h2 className="text-lg font-bold mb-2">Seat Request Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {broadcasterName || 'The broadcaster'} denied your request for Seat {seatIndex || 'N/A'}.
          </p>
          {denyReason && (
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded mb-4">
              <p className="text-xs font-medium mb-1">Reason:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{denyReason}</p>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your coins have been refunded.
          </p>
          <Button
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">Connection Failed</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your coins have been refunded.
          </p>
          <Button
            onClick={onClose}
            variant="danger"
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Approved & waiting for permission
  if (isApproved && !accepted && !isConnecting) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
          <div className="mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-bold">Approved!</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {broadcasterName || 'The broadcaster'} approved your request for Seat {seatIndex || 'N/A'}.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              📹 Your camera and microphone will turn on next.
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
              You&apos;ll see a permission prompt. Please allow camera and microphone access.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Once you accept, you&apos;ll be live in the seat alongside other viewers.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setAccepted(true);
                onAccept();
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
            <Button
              onClick={onDeny}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Connecting state
  if (isConnecting || accepted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 dark:border-t-blue-400 animate-spin"></div>
            </div>
            <h2 className="text-lg font-bold mb-2">Connecting...</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Initializing your camera and microphone. Please wait...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
              If you see a permission prompt, please click &quot;Allow&quot;
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: waiting for approval
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-950 rounded-lg shadow-lg max-w-sm w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-2">Seat Request Sent</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Waiting for {broadcasterName || 'the broadcaster'} to approve your request for Seat {seatIndex || 'N/A'}.
        </p>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-4">
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            ⏱️ Request expires in 2 minutes
          </p>
        </div>
        <Button
          onClick={onDeny}
          variant="ghost"
          className="w-full"
        >
          Cancel Request
        </Button>
      </div>
    </div>
  );
}
