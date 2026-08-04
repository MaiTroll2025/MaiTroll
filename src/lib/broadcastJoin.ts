export interface ViewerJoinRequest {
  userId: string
  streamId: string
  roomName: string
  viewerIdentity: string
  publishCapable: boolean
}

export interface BuildViewerJoinRequestInput {
  userId: string
  streamId: string
  roomName: string
  viewerIdentity: string
  allowSeatPublishing?: boolean
}

export function buildViewerJoinRequest({
  userId,
  streamId,
  roomName,
  viewerIdentity,
  allowSeatPublishing = false,
}: BuildViewerJoinRequestInput): ViewerJoinRequest {
  return {
    userId,
    streamId,
    roomName,
    viewerIdentity,
    publishCapable: Boolean(allowSeatPublishing),
  }
}
