import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const TrollOfficerLounge = lazyWithRetry(() => import('../../pages/TrollOfficerLounge'))

export default function PhoneTrollOfficer() {
  return <PhoneWebEmbed Component={TrollOfficerLounge} title="Troll Officer" />
}
