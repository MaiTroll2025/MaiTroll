import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const DeleteAccount = lazyWithRetry(() => import('../../pages/DeleteAccount'))

export default function PhoneProfileDelete() {
  return <PhoneWebEmbed Component={DeleteAccount} title="Delete Account" />
}
