import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const AgencyApplyPage = lazyWithRetry(
  () => import('../../pages/agency-apply/[agencyId]/index.tsx'),
)

export default function PhoneAgencyApply() {
  return <PhoneWebEmbed Component={AgencyApplyPage} title="Apply" />
}
