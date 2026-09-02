import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const GovernmentPage = lazyWithRetry(() => import('../../pages/MayorDashboard'))

export default function PhoneGovernment() {
  return <PhoneWebEmbed Component={GovernmentPage} title="Government" />
}
