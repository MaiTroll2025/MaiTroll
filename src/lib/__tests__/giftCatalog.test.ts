import { OFFICIAL_GIFTS } from '../giftConstants'

describe('official gift catalog', () => {
  it('includes the requested premium gift variants with exact pricing', () => {
    const byId = new Map(OFFICIAL_GIFTS.map((gift) => [gift.id, gift]))

    expect(byId.get('crown2')).toMatchObject({
      name: 'Crown 2',
      cost: 400,
      tier: 'II',
    })

    expect(byId.get('galazy2')).toMatchObject({
      name: 'Galazy 2',
      cost: 1000,
      tier: 'III',
    })

    expect(byId.get('tower2')).toMatchObject({
      name: 'Tower 2',
      cost: 500,
      tier: 'II',
    })
  })
})
