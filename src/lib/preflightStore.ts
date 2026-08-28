import type { LocalAudioTrack, LocalVideoTrack, Room } from 'livekit-client'
import { create } from 'zustand'

type TransferSession = {
  [x: string]: any
  room: Room | null
  roomName: string | null
  streamId: string | null
  participantIdentity: string | null
  cameraTrack: LocalVideoTrack | null
  microphoneTrack: LocalAudioTrack | null
  screenTrack: LocalVideoTrack | null
  screenAudioTrack: LocalAudioTrack | null
  mode: 'camera' | 'screen' | null
  cameraOverlayEnabled: boolean
  transferredAt: number | null
  ownership: string | null
  transitionInProgress: boolean
}

type PreflightState = {
  room: Room | null
  audioTrack: LocalAudioTrack | null
  videoTrack: LocalVideoTrack | null
  streamId: string | null
  roomName: string | null
  transferringToBroadcast: boolean
  transferSession: TransferSession | null

  setPreflightConnection: (data: {
    room: Room
    audioTrack: LocalAudioTrack | null
    videoTrack: LocalVideoTrack | null
    streamId: string
    roomName: string
  }) => void

  setTransferringToBroadcast: (value: boolean) => void
  clearPreflightConnection: () => void
}

export const usePreflightStore = create<PreflightState>((set) => ({
  room: null,
  audioTrack: null,
  videoTrack: null,
  streamId: null,
  roomName: null,
  transferringToBroadcast: false,
  transferSession: null,

  setPreflightConnection: (data) =>
    set({
      ...data,
      transferringToBroadcast: true,
    }),

  setTransferringToBroadcast: (value) =>
    set({ transferringToBroadcast: value }),

  clearPreflightConnection: () =>
    set({
      room: null,
      audioTrack: null,
      videoTrack: null,
      streamId: null,
      roomName: null,
      transferringToBroadcast: false,
      transferSession: null,
    }),
}))

const preflightState = {
  token: null as string | null,
  roomName: null as string | null,
  url: null as string | null,
  isVideoEnabled: true,
  isAudioEnabled: true,
  isInBattle: false,
  isInBroadcast: false,
  battlesDisabled: false,
  inTutorial: false,
  livekitRoom: null as Room | null,
  livekitTracks: null as [LocalAudioTrack | null, LocalVideoTrack | null] | null,
  isScreenShareMode: false,
  screenTrack: null as LocalVideoTrack | null,
  transferSession: null as TransferSession | null,
}

export const PreflightStore = {
  setToken(token: string | null, roomName: string | null, url: string | null) {
    preflightState.token = token
    preflightState.roomName = roomName
    preflightState.url = url
  },

  getToken() {
    return { token: preflightState.token, roomName: preflightState.roomName, url: preflightState.url }
  },

  setTrackEnabledStates(isVideoEnabled: boolean, isAudioEnabled: boolean) {
    preflightState.isVideoEnabled = isVideoEnabled
    preflightState.isAudioEnabled = isAudioEnabled
  },

  getTrackEnabledStates() {
    return { isVideoEnabled: preflightState.isVideoEnabled, isAudioEnabled: preflightState.isAudioEnabled }
  },

  setInBattle(inBattle: boolean) {
    preflightState.isInBattle = inBattle
  },

  getInBattle(): boolean {
    return preflightState.isInBattle
  },

  setInBroadcast(inBroadcast: boolean) {
    if (preflightState.isInBroadcast === inBroadcast) return
    preflightState.isInBroadcast = inBroadcast
  },

  getInBroadcast(): boolean {
    return preflightState.isInBroadcast
  },

  setBattlesDisabled(disabled: boolean) {
    preflightState.battlesDisabled = disabled
  },

  getBattlesDisabled(): boolean {
    return preflightState.battlesDisabled
  },

  setInTutorial(inTutorial: boolean) {
    preflightState.inTutorial = inTutorial
  },

  getInTutorial(): boolean {
    return preflightState.inTutorial
  },

  setLivekitRoom(room: Room | null) {
    preflightState.livekitRoom = room
  },

  getLivekitRoom(): Room | null {
    return preflightState.livekitRoom
  },

  setLivekitTracks(tracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null) {
    preflightState.livekitTracks = tracks
  },

  getLivekitTracks(): [LocalAudioTrack | null, LocalVideoTrack | null] | null {
    return preflightState.livekitTracks
  },

  getTracks(): { audio: LocalAudioTrack | null; video: LocalVideoTrack | null; audioTrack: LocalAudioTrack | null; videoTrack: LocalVideoTrack | null } | null {
    if (!preflightState.livekitTracks) return null
    return {
      audio: preflightState.livekitTracks[0],
      video: preflightState.livekitTracks[1],
      audioTrack: preflightState.livekitTracks[0],
      videoTrack: preflightState.livekitTracks[1],
    }
  },

  setScreenShareMode(isScreenShare: boolean) {
    preflightState.isScreenShareMode = isScreenShare
  },

  getScreenShareMode(): boolean {
    return preflightState.isScreenShareMode
  },

  setScreenTrack(track: LocalVideoTrack | null) {
    preflightState.screenTrack = track
  },

  getScreenTrack(): LocalVideoTrack | null {
    return preflightState.screenTrack
  },

  setTransferSession(session: TransferSession) {
    preflightState.transferSession = session
  },

  getTransferSession(): TransferSession | null {
    return preflightState.transferSession
  },

  adoptTransferSession(session: TransferSession) {
    preflightState.transferSession = {
      ...session,
      transitionInProgress: false,
      ownership: 'broadcast-page',
    }
  },

  markTransitionComplete() {
    if (preflightState.transferSession) {
      preflightState.transferSession.transitionInProgress = false
    }
  },

  clearTransferSession() {
    preflightState.transferSession = null
  },

  clear() {
    preflightState.token = null
    preflightState.roomName = null
    preflightState.url = null
    preflightState.isVideoEnabled = true
    preflightState.isAudioEnabled = true
    preflightState.isInBattle = false
    preflightState.isInBroadcast = false
    preflightState.battlesDisabled = false
    preflightState.livekitRoom = null
    preflightState.livekitTracks = null
    preflightState.isScreenShareMode = false
    preflightState.screenTrack = null
    preflightState.transferSession = null
  },
}
