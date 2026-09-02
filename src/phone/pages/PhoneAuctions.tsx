import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const AuctionsPage = lazyWithRetry(() => import('../../pages/AuctionsPage'))

export default function PhoneAuctions() {
  return <PhoneWebEmbed Component={AuctionsPage} title="Auctions" />
}
