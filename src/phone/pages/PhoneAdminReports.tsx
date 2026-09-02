import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const ReportsQueue = lazyWithRetry(() => import('../../pages/admin/ReportsQueue'))

export default function PhoneAdminReports() {
  return <PhoneWebEmbed Component={ReportsQueue} title="Admin Reports" />
}
