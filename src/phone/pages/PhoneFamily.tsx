import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const FamilyPage = lazyWithRetry(() => import('../../pages/TrollFamilyHome'))

export default function PhoneFamily() {
  return <PhoneWebEmbed Component={FamilyPage} title="Family" />
}
