import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const ChatModeration = lazyWithRetry(() => import('../../pages/admin/ChatModeration'))

export default function PhoneAdminModeration() {
  return <PhoneWebEmbed Component={ChatModeration} title="Admin Moderation" />
}
