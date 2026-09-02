import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const AgencyProfilePage = lazyWithRetry(
  () => import('../../pages/agency/[agencyId]/index.tsx'),
)

export default function PhoneAgency() {
  return <PhoneWebEmbed Component={AgencyProfilePage} title="Agency" />
}
