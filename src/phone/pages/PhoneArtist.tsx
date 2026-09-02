import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const ArtistDashboardPage = lazyWithRetry(() => import('../../pages/artist/ArtistDashboardPage'))

export default function PhoneArtist() {
  return <PhoneWebEmbed Component={ArtistDashboardPage} title="Artist" />
}
