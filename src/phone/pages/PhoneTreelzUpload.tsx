import { lazyWithRetry } from '@/utils/lazyImport'
import { neonCard, neonTextGradient } from '../phoneTheme'

const TreelzUploadPage = lazyWithRetry(
  () => import('../../pages/TreelzUploadPage.tsx')
)

export default function PhoneTreelzUpload() {
  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white">
      <TreelzUploadPage />
    </div>
  )
}
