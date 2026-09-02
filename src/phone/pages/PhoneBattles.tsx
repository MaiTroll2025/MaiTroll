import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const BattleView = lazyWithRetry(() => import('../../pages/broadcast/BattleView'))

export default function PhoneBattles() {
  return <PhoneWebEmbed Component={BattleView} title="Battles" />
}
