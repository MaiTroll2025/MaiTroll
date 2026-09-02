import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const CeoDashboard = lazyWithRetry(() => import('../../pages/ceo-assistant-dashboard'))

export default function PhoneCeoDashboard() {
  return <PhoneWebEmbed Component={CeoDashboard} title="CEO Assistant" />
}
