import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Car, AlertTriangle } from 'lucide-react';

interface DriverTestRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DriverTestRequiredModal({
  isOpen,
  onClose,
  onConfirm,
}: DriverTestRequiredModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onClose();
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-center space-x-3">
          <AlertTriangle size={24} className="text-amber-400" />
          <h2 className="text-2xl font-bold text-white">Driver License Required</h2>
        </div>
        
        <p className="text-slate-300 text-center">
          You must have an active driver license to go live in Mai Troll.
          Please take the driver test first to get your license.
        </p>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={handleConfirm}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold"
          >
            Go to Driver Test
          </Button>
          
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
}