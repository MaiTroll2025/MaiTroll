import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const PodcastCentral = lazyWithRetry(() => import('../../pages/PodcastCentral'))

export default function PhonePodcast() {
  return <PhoneWebEmbed Component={PodcastCentral} title="Podcast" />
}
