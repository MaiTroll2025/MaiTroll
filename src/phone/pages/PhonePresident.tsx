import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const PresidentPage = lazyWithRetry(() => import('../../pages/President'))

export default function PhonePresident() {
  return <PhoneWebEmbed Component={PresidentPage} title="President" />
}
