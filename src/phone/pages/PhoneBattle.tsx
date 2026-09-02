import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const BattleView = lazyWithRetry(() => import('../../pages/broadcast/BattleView'))

export default function PhoneBattle() {
  return <PhoneWebEmbed Component={BattleView} title="Battle" />
}
