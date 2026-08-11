import { sendMessage, UTROMAIL_SYSTEM_SENDER_ID, UTROMAIL_SYSTEM_SENDER_MAIL } from '../services/utromailService'

export interface PromoCardMailPayload {
  userId: string
  promoCode: string
  tokenAmount: number
  expiresAt: string
  rewardReason: string
  metadata?: Record<string, unknown>
}

export async function sendPromoCardMailToUser(payload: PromoCardMailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const body = [
      'You received a Mai Troll promo card.',
      '',
      `Promo Code: ${payload.promoCode}`,
      `Token Reward: ${payload.tokenAmount}`,
      `Expires: ${payload.expiresAt}`,
      `Reward: ${payload.rewardReason}`,
      '',
      '— Mai Troll System',
    ].join('\n')

    const message = await sendMessage({
      senderId: UTROMAIL_SYSTEM_SENDER_ID,
      senderMail: UTROMAIL_SYSTEM_SENDER_MAIL,
      recipientId: payload.userId,
      subject: `Promo Card Received: ${payload.promoCode}`,
      body,
      messageType: 'promo_card',
      threadId: undefined,
      attachments: [],
    })

    return { success: true, messageId: message.id }
  } catch (error: any) {
    console.error('[promoCardDelivery] Failed to send promo card message:', error)
    return { success: false, error: error?.message || 'Failed to send promo card notification' }
  }
}
