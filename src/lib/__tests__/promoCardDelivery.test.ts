import { sendPromoCardMailToUser } from '../promoCardDelivery'
import { sendMessage } from '../../services/utromailService'

jest.mock('../../services/utromailService', () => ({
  sendMessage: jest.fn(),
  UTROMAIL_SYSTEM_SENDER_ID: '00000000-0000-0000-0000-000000000000',
  UTROMAIL_SYSTEM_SENDER_MAIL: 'system@tromail.Mai Troll',
}))

describe('sendPromoCardMailToUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delivers promo cards as a Mai Troll System message that can reuse the same thread', async () => {
    ;(sendMessage as jest.Mock).mockResolvedValue({ id: 'msg-1' })

    await sendPromoCardMailToUser({
      userId: 'user-1',
      promoCode: 'TC-2026-001',
      tokenAmount: 750,
      expiresAt: '2026-07-10T00:00:00.000Z',
      rewardReason: 'broadcasting',
    })

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      senderId: '00000000-0000-0000-0000-000000000000',
      senderMail: 'system@tromail.Mai Troll',
      recipientId: 'user-1',
      subject: expect.stringContaining('Promo Card'),
      body: expect.stringContaining('TC-2026-001'),
      messageType: 'promo_card',
    }))
  })
})
