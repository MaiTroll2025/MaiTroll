import { lazyWithRetry } from '@/utils/lazyImport'
const BroadcastPage = lazyWithRetry(() => import('../../pages/broadcast/BroadcastPage'))

export default function PhoneBroadcastPage() {
  return <BroadcastPage />
}
