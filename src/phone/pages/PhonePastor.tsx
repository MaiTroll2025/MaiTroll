import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const PastorDashboard = lazyWithRetry(() => import('../../pages/church/PastorDashboard'))

export default function PhonePastor() {
  return <PhoneWebEmbed Component={PastorDashboard} title="Pastor" />
}
