import { lazyWithRetry } from '@/utils/lazyImport'
import PhoneWebEmbed from '../components/PhoneWebEmbed'

const MaiRecordLabelPage = lazyWithRetry(() => import('../../pages/MaiRecordLabelPage'))

export default function PhoneRecordLabel() {
  return <PhoneWebEmbed Component={MaiRecordLabelPage} title="Record Label" />
}
