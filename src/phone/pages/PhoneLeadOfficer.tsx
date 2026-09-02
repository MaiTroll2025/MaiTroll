import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const LeadOfficerDashboard = lazyWithRetry(
  () => import('../../pages/lead-officer/LeadOfficerDashboard'),
)

export default function PhoneLeadOfficer() {
  return <PhoneWebEmbed Component={LeadOfficerDashboard} title="Lead Officer" />
}
