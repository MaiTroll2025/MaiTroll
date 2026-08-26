import { lazyWithRetry } from '@/utils/lazyImport'
const BroadcastPage = lazyWithRetry(() => import('../../pages/broadcast/BroadcastPage').then(m => ({ default: m.BroadcastPage })))

export default function PhoneBroadcastPage() {
  return <BroadcastPage />
}
