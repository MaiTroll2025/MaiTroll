import { buildViewerJoinRequest } from '../broadcastJoin'

describe('buildViewerJoinRequest', () => {
  it('keeps ordinary viewers in audience mode and never grants publisher permissions', () => {
    const request = buildViewerJoinRequest({
      userId: 'viewer-123',
      streamId: 'stream-abc',
      roomName: 'room-abc',
      viewerIdentity: 'viewer-stream-abc-viewer-123',
      allowSeatPublishing: false,
    })

    expect(request).toEqual({
      userId: 'viewer-123',
      streamId: 'stream-abc',
      roomName: 'room-abc',
      viewerIdentity: 'viewer-stream-abc-viewer-123',
      publishCapable: false,
    })
  })

  it('allows seat-based publishers only when explicitly enabled', () => {
    const request = buildViewerJoinRequest({
      userId: 'seat-789',
      streamId: 'stream-abc',
      roomName: 'room-abc',
      viewerIdentity: 'viewer-stream-abc-seat-789',
      allowSeatPublishing: true,
    })

    expect(request.publishCapable).toBe(true)
  })
})
