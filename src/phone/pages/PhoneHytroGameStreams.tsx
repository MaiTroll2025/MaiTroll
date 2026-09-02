import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const HytroGaming = lazyWithRetry(() => import('../../pages/gaming/HytroGaming'))

export default function PhoneHytroGameStreams() {
  return <PhoneWebEmbed Component={HytroGaming} title="Hytro" />
}
