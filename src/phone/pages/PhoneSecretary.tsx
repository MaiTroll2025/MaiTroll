import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const SecretaryConsole = lazyWithRetry(() => import('../../pages/SecretaryConsole'))

export default function PhoneSecretary() {
  return <PhoneWebEmbed Component={SecretaryConsole} title="Secretary" />
}
