import { lazyWithRetry } from '@/utils/lazyImport'
const ViewerPage = lazyWithRetry(() => import('../../pages/broadcast/ViewerPage'))

export default function PhoneViewerPage() {
  return <ViewerPage />
}
