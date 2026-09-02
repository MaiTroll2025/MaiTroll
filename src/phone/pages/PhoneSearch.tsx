import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const SearchPage = lazyWithRetry(() => import('../../pages/SearchPage'))

export default function PhoneSearch() {
  return <PhoneWebEmbed Component={SearchPage} title="Search" />
}
