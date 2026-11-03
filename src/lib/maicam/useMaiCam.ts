import { useContext } from 'react';
import { MaiCamContext } from './MaiCamContext';

export function useMaiCam() {
  const ctx = useContext(MaiCamContext);
  if (!ctx) {
    throw new Error('useMaiCam must be used within a MaiCamProvider');
  }
  return ctx;
}
