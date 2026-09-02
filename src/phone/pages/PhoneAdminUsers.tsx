import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const UserSearch = lazyWithRetry(() => import('../../pages/admin/UserSearch'))

export default function PhoneAdminUsers() {
  return <PhoneWebEmbed Component={UserSearch} title="Admin Users" />
}
