import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const TCNNMainPage = lazyWithRetry(() => import('../../pages/tcnn/TCNNMainPage'))

export default function PhoneTCNN() {
  return <PhoneWebEmbed Component={TCNNMainPage} title="TCNN" />
}
