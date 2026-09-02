import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const AdminPoliciesDocs = lazyWithRetry(() => import('../../pages/admin/AdminPoliciesDocs'))

export default function PhoneAdminSettings() {
  return <PhoneWebEmbed Component={AdminPoliciesDocs} title="Admin Settings" />
}
